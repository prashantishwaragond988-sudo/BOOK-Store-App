from flask import Blueprint, jsonify, request, current_app

def _get_app_url() -> str:
    url = (current_app.config.get("NEXT_PUBLIC_APP_URL") or "").strip()
    if url:
        return url.rstrip("/")
    return "http://localhost:3001"
import secrets
from datetime import datetime
from config.firebase_config import db
from routes.auth import token_required, admin_required
from services.firestore_service import (
    add_document,
    get_document,
    set_document,
    update_document,
)
from services.otp_service import OTPService
from services.notification_service import NotificationService
from utils.constants import DeliveryStatus, NotificationChannel
from utils.logger import get_logger

logger = get_logger("delivery")

delivery_bp = Blueprint("delivery", __name__)


# Delivery statuses are now handled via DeliveryStatus enum in utils/constants.py


def _normalize_status(value: str) -> str:
    if not value:
        return ""
    return str(value).strip().lower().replace(" ", "_")


def _require_field(obj: dict, key: str):
    if not isinstance(obj, dict):
        return None
    return obj.get(key)


@delivery_bp.route("/deliveryboy/login", methods=["POST", "OPTIONS"])
def deliveryboy_login():
    # NOTE: Uses Firebase client-side Auth (ID token) in this app.
    # This endpoint is intentionally minimal / compatible: real authentication
    # happens via Firebase Auth in frontend. We keep this route so the UI
    # can call something meaningful and get role validation from backend.
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    return jsonify({
        "success": False,
        "message": "Use Firebase Auth in the frontend. Backend validation is done via Bearer token on delivery routes.",
    }), 400


@delivery_bp.route("/delivery/dashboard", methods=["GET"])
@token_required
def delivery_dashboard(current_user):
    delivery_boy_id = current_user.get("uid")
    if not delivery_boy_id:
        return jsonify({"success": False, "message": "Invalid user"}), 401

    # OPTIMIZATION: Use indexed query instead of get_all()
    assignments_ref = db.collection("deliveryAssignments").where("deliveryBoyId", "==", delivery_boy_id)
    assigned = [doc.to_dict() for doc in assignments_ref.stream()]

    total_assigned = len(assigned)
    active = [
        a for a in assigned
        if a.get("status") in (
            DeliveryStatus.ASSIGNED.value, 
            DeliveryStatus.PICKED_UP.value, 
            DeliveryStatus.OUT_FOR_DELIVERY.value, 
            DeliveryStatus.NEAR_CUSTOMER.value
        )
    ]
    pending = [a for a in assigned if a.get("status") == DeliveryStatus.ASSIGNED.value]
    completed = [a for a in assigned if a.get("status") == DeliveryStatus.DELIVERED.value]
    failed = [a for a in assigned if a.get("status") == DeliveryStatus.FAILED.value]

    today_deliveries = 0
    try:
        today = datetime.utcnow().date()
        for a in assigned:
            dt = a.get("deliveredAt") or a.get("failedAt")
            if isinstance(dt, datetime):
                if dt.date() == today:
                    today_deliveries += 1
    except Exception:
        pass

    return jsonify({
        "success": True,
        "stats": {
            "total_assigned": total_assigned,
            "pending": len(pending),
            "active_deliveries": len(active),
            "delivered": len(completed),
            "failed": len(failed),
            "today_deliveries": today_deliveries,
            "success_rate_percent": int((len(completed) / total_assigned * 100)) if total_assigned > 0 else 0,
        },
    }), 200


@delivery_bp.route("/delivery/orders", methods=["GET"])
@token_required
def delivery_orders(current_user):
    delivery_boy_id = current_user.get("uid")
    if not delivery_boy_id:
        return jsonify({"success": False, "message": "Invalid user"}), 401

    # OPTIMIZATION: Indexed query
    assignments_ref = db.collection("deliveryAssignments").where("deliveryBoyId", "==", delivery_boy_id)
    assigned = [doc.to_dict() for doc in assignments_ref.stream()]

    results = []
    for a in assigned:
        order_id = a.get("orderId") or a.get("order_id")
        order = get_document("orders", order_id)
        
        if not order:
            logger.warning(f"Orphan assignment found for order {order_id}. Cleaning up...")
            try:
                db.collection("deliveryAssignments").document(order_id).delete()
                db.collection("order_tracking").document(order_id).delete()
            except:
                pass
            continue
            
        results.append({
            "assignment": a,
            "order": {
                "id": order_id,
                "user_id": order.get("user_id"),
                "order_status": order.get("order_status"),
                "address": order.get("address"),
                "location": order.get("location"),
                "items": order.get("items"),
                "total_price": order.get("total_price") or order.get("totalPrice") or order.get("total"),
            },
        })

    return jsonify({"success": True, "data": results}), 200


@delivery_bp.route("/admin/delivery/assign", methods=["POST", "OPTIONS"])
@token_required
@admin_required
def admin_assign_delivery(current_user):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json(silent=True) or {}
        order_id = data.get("order_id")
        delivery_boy_uid = data.get("delivery_boy_uid")

        if not order_id or not delivery_boy_uid:
            return jsonify({"success": False, "message": "order_id and delivery_boy_uid are required"}), 400

        # 1. Fetch Order and Delivery Boy with validation
        order = get_document("orders", order_id)
        dboy = get_document("deliveryBoys", delivery_boy_uid)

        if not order:
            return jsonify({"success": False, "message": f"Order {order_id} not found"}), 404
        if not dboy:
            return jsonify({"success": False, "message": f"Delivery Boy {delivery_boy_uid} not found"}), 404

        customer_email = order.get("user_id") or order.get("email")
        customer_phone = order.get("address", {}).get("mobile") or order.get("phone")
        dboy_name = dboy.get("name") or "Delivery Partner"
        dboy_phone = dboy.get("phone")
        dboy_email = dboy.get("email")

        # 2. Secure OTP Generation
        try:
            from services.otp_service import OTPService
            otp_code = "".join(secrets.choice("0123456789") for _ in range(6))
            success, otp_msg = OTPService.send_otp(
                identifier=order_id,
                email=customer_email,
                phone=customer_phone,
                otp_code=otp_code
            )
            if not success:
                logger.warning(f"OTP Cooldown active for {order_id}: {otp_msg}")
        except Exception as e:
            logger.error(f"OTP generation failed for {order_id}: {e}")
            otp_code = "Error generating OTP"

        # 3. Create/Update Assignment
        now = datetime.utcnow()
        assignment_payload = {
            "orderId": order_id,
            "customerEmail": customer_email,
            "deliveryBoyId": delivery_boy_uid,
            "status": DeliveryStatus.ASSIGNED.value,
            "assignedAt": now,
            "timeline": [
                {
                    "status": DeliveryStatus.ASSIGNED.value,
                    "timestamp": now.isoformat(),
                    "updatedBy": current_user.get("uid"),
                }
            ],
            "updatedAt": now
        }
        
        set_document("deliveryAssignments", order_id, assignment_payload, merge=True)
        
        # 4. Update Order Tracking with Destination
        tracking_payload = {
            "deliveryBoyId": delivery_boy_uid,
            "status": DeliveryStatus.ASSIGNED.value,
            "updatedAt": now,
            "destination": order.get("location") or order.get("address", {}).get("location") or {}
        }
        set_document("order_tracking", order_id, tracking_payload, merge=True)
        update_document("orders", order_id, {
            "status": DeliveryStatus.ASSIGNED.value, 
            "order_status": DeliveryStatus.ASSIGNED.value,
            "updated_at": now
        })

        # 5. Dispatch Contextual Notifications (Async, wrapped to prevent crash)
        # To Customer
        try:
            NotificationService.dispatch(
                recipient_email=customer_email,
                recipient_phone=customer_phone,
                n_type="delivery_assigned_customer",
                context={
                    "order_id": order_id,
                    "dboy_name": dboy_name,
                    "dboy_phone": dboy_phone or "N/A",
                    "otp": otp_code,
                    "tracking_url": f"{_get_app_url()}/track/{order_id}"
                },
                order_id=order_id
            )
        except Exception as e:
            logger.error(f"Customer assignment notification failed: {e}")

        # To Delivery Boy
        try:
            NotificationService.dispatch(
                recipient_email=dboy_email,
                recipient_phone=dboy_phone,
                n_type="delivery_assigned_dboy",
                context={
                    "order_id": order_id,
                    "customer_name": order.get("address", {}).get("name", "Customer"),
                    "address": order.get("address", {}).get("address", "N/A"),
                    "customer_phone": customer_phone or "N/A"
                },
                order_id=order_id
            )
        except Exception as e:
            logger.error(f"Delivery boy assignment notification failed: {e}")

        return jsonify({"success": True, "message": "Delivery assigned successfully"}), 200

    except Exception as e:
        logger.error(f"Critical error in admin_assign_delivery: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@delivery_bp.route("/delivery/orders/<order_id>/status", methods=["POST", "OPTIONS"])
@token_required
def delivery_update_status(current_user, order_id):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    delivery_boy_uid = current_user.get("uid")
    data = request.get_json(silent=True) or {}
    next_status = data.get("status")

    if next_status not in DeliveryStatus.list():
        return jsonify({"success": False, "message": "Invalid status"}), 400

    assignment = get_document("deliveryAssignments", order_id)
    if not assignment or assignment.get("deliveryBoyId") != delivery_boy_uid:
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    now = datetime.utcnow()
    timeline = assignment.get("timeline") or []
    timeline.append({
        "status": next_status,
        "timestamp": now.isoformat(),
        "updatedBy": delivery_boy_uid,
    })

    update_payload = {
        "status": next_status,
        "timeline": timeline,
        "updatedAt": now
    }
    update_document("deliveryAssignments", order_id, update_payload)

    # Sync into order_tracking with event
    tracking_update = {
        "status": next_status,
        "updatedAt": now
    }
    # Atomically add to tracking_events if possible, or just merge
    tracking_doc = get_document("order_tracking", order_id)
    if tracking_doc:
        events = tracking_doc.get("tracking_events") or []
        events.append({
            "status": next_status,
            "message": f"Order status updated to {next_status}",
            "timestamp": now.isoformat()
        })
        tracking_update["tracking_events"] = events
    
    set_document("order_tracking", order_id, tracking_update, merge=True)
    
    update_document("orders", order_id, {"status": next_status, "order_status": next_status, "updated_at": now})

    return jsonify({"success": True, "message": "Status updated"}), 200

@delivery_bp.route("/delivery/orders/<order_id>/start", methods=["POST", "OPTIONS"])
@token_required
def start_delivery(current_user, order_id):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    delivery_boy_uid = current_user.get("uid")
    assignment = get_document("deliveryAssignments", order_id)
    
    if not assignment or assignment.get("deliveryBoyId") != delivery_boy_uid:
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    now = datetime.utcnow()
    status = DeliveryStatus.OUT_FOR_DELIVERY.value
    
    timeline = assignment.get("timeline") or []
    timeline.append({
        "status": status,
        "timestamp": now.isoformat(),
        "updatedBy": delivery_boy_uid,
    })

    update_document("deliveryAssignments", order_id, {
        "status": status,
        "delivery_started_at": now,
        "timeline": timeline,
        "updatedAt": now
    })

    # Sync into order_tracking with event
    tracking_update = {
        "status": status,
        "updatedAt": now
    }
    tracking_doc = get_document("order_tracking", order_id)
    if tracking_doc:
        events = tracking_doc.get("tracking_events") or []
        events.append({
            "status": status,
            "message": "Courier is on the way to your address",
            "timestamp": now.isoformat()
        })
        tracking_update["tracking_events"] = events
        
    set_document("order_tracking", order_id, tracking_update, merge=True)
    update_document("orders", order_id, {"status": status, "order_status": status, "updated_at": now})

    # Notify Customer (Dual Channel)
    try:
        order = get_document("orders", order_id) or {}
        dboy = get_document("deliveryBoys", delivery_boy_uid) or {}
        customer_email = order.get("user_id") or order.get("email")
        customer_phone = order.get("address", {}).get("mobile") or order.get("phone")

        NotificationService.dispatch(
            recipient_email=customer_email,
            recipient_phone=customer_phone,
            n_type="out_for_delivery",
            context={
                "order_id": order_id,
                "dboy_name": dboy.get("name", "Delivery Partner"),
                "dboy_phone": dboy.get("phone", "N/A")
            },
            order_id=order_id
        )
    except Exception as e:
        logger.error(f"Out for delivery notification failed: {e}")

    return jsonify({"success": True, "message": "Delivery started"}), 200


@delivery_bp.route("/delivery/orders/<order_id>/verify-otp", methods=["POST", "OPTIONS"])
@token_required
def verify_delivery_otp(current_user, order_id):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    delivery_boy_uid = current_user.get("uid")
    data = request.get_json(silent=True) or {}
    entered_otp = data.get("otp")

    if not entered_otp:
        return jsonify({"success": False, "message": "OTP is required"}), 400

    # 1. Atomic Verification via OTPService
    success, message = OTPService.verify_otp(order_id, entered_otp)
    
    if not success:
        logger.warning(f"OTP Verification Failed for order {order_id}: {message}")
        return jsonify({"success": False, "message": message}), 400 if "Invalid" in message else 403

    # 2. Verification Success -> Finalize Delivery
    now = datetime.utcnow()
    assignment = get_document("deliveryAssignments", order_id)
    if not assignment:
        return jsonify({"success": False, "message": "Assignment not found"}), 404

    # Update Assignment Timeline
    timeline = assignment.get("timeline") or []
    timeline.append({
        "status": DeliveryStatus.DELIVERED.value,
        "timestamp": now.isoformat(),
        "updatedBy": delivery_boy_uid,
    })

    update_document("deliveryAssignments", order_id, {
        "status": DeliveryStatus.DELIVERED.value,
        "deliveredAt": now,
        "timeline": timeline,
        "updatedAt": now
    })

    # Update Order and Tracking
    set_document("order_tracking", order_id, {
        "status": DeliveryStatus.DELIVERED.value,
        "updatedAt": now
    }, merge=True)
    update_document("orders", order_id, {
        "order_status": DeliveryStatus.DELIVERED.value,
        "status": DeliveryStatus.DELIVERED.value,
        "updated_at": now
    })

    # 3. Final Notification (Dual Channel)
    try:
        order = get_document("orders", order_id) or {}
        customer_email = order.get("user_id") or order.get("email")
        customer_phone = order.get("address", {}).get("mobile") or order.get("phone")
        
        NotificationService.dispatch(
            recipient_email=customer_email,
            recipient_phone=customer_phone,
            n_type="delivered",
            context={"order_id": order_id},
            order_id=order_id
        )
    except Exception as e:
        logger.error(f"Delivered notification failed: {e}")

    return jsonify({"success": True, "message": "Delivery completed successfully"}), 200


@delivery_bp.route("/delivery/orders/<order_id>/fail", methods=["POST", "OPTIONS"])
@token_required
def fail_delivery(current_user, order_id):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    delivery_boy_uid = current_user.get("uid")
    data = request.get_json(silent=True) or {}
    reason = data.get("note", "No reason provided")

    assignment = get_document("deliveryAssignments", order_id)
    if not assignment or assignment.get("deliveryBoyId") != delivery_boy_uid:
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    now = datetime.utcnow()
    status = DeliveryStatus.FAILED.value
    
    timeline = assignment.get("timeline") or []
    timeline.append({
        "status": status,
        "timestamp": now.isoformat(),
        "updatedBy": delivery_boy_uid,
        "reason": reason
    })

    update_document("deliveryAssignments", order_id, {
        "status": status,
        "failedAt": now,
        "timeline": timeline,
        "updatedAt": now
    })

    # Sync into order_tracking with event
    tracking_update = {
        "status": status,
        "updatedAt": now
    }
    tracking_doc = get_document("order_tracking", order_id)
    if tracking_doc:
        events = tracking_doc.get("tracking_events") or []
        events.append({
            "status": status,
            "message": "Courier is on the way to your address",
            "timestamp": now.isoformat()
        })
        tracking_update["tracking_events"] = events
        
    set_document("order_tracking", order_id, tracking_update, merge=True)
    update_document("orders", order_id, {"status": status, "order_status": status, "updated_at": now})

    # Notify Customer (Dual Channel)
    try:
        order = get_document("orders", order_id) or {}
        customer_email = order.get("user_id") or order.get("email")
        customer_phone = order.get("address", {}).get("mobile") or order.get("phone")

        NotificationService.dispatch(
            recipient_email=customer_email,
            recipient_phone=customer_phone,
            n_type="failed_attempt",
            context={
                "order_id": order_id,
                "reason": reason
            },
            order_id=order_id
        )
    except Exception as e:
        logger.error(f"Failed delivery notification failed: {e}")

    return jsonify({"success": True, "message": "Delivery marked as failed"}), 200


@delivery_bp.route("/delivery/orders/<order_id>", methods=["GET"])
@token_required
def delivery_order_details(current_user, order_id):
    delivery_boy_uid = current_user.get("uid")
    assignment = get_document("deliveryAssignments", order_id)
    if not assignment:
        return jsonify({"success": False, "message": "Assignment not found"}), 404

    if assignment.get("deliveryBoyId") != delivery_boy_uid and current_user.get("role") != "admin":
        return jsonify({"success": False, "message": "Not assigned"}), 403

    order = get_document("orders", order_id) or {}
    return jsonify({"success": True, "data": {"assignment": assignment, "order": order}}), 200


@delivery_bp.route("/delivery/orders/<order_id>/location", methods=["POST", "OPTIONS"])
@token_required
def update_delivery_location(current_user, order_id):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    delivery_boy_uid = current_user.get("uid")
    data = request.get_json(silent=True) or {}
    lat = data.get("lat")
    lng = data.get("lng")

    if lat is None or lng is None:
        return jsonify({"success": False, "message": "lat and lng are required"}), 400

    assignment = get_document("deliveryAssignments", order_id)
    if not assignment or assignment.get("deliveryBoyId") != delivery_boy_uid:
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    now = datetime.utcnow()
    # Update tracking doc with real GPS coordinates
    set_document("order_tracking", order_id, {
        "delivery_lat": lat,
        "delivery_lng": lng,
        "updatedAt": now
    }, merge=True)

    return jsonify({"success": True}), 200

