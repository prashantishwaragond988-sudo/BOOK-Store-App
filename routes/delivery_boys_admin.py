from flask import Blueprint, jsonify, request, current_app
from firebase_admin import auth as firebase_auth
from datetime import datetime
import secrets
import html
from config.firebase_config import db
from routes.auth import token_required, admin_required
from services.firestore_service import set_document, get_document
from services.notification_service import NotificationService
from utils.logger import get_logger

logger = get_logger("delivery_boys_admin")

admin_delivery_boys_bp = Blueprint("admin_delivery_boys", __name__)




def _generate_delivery_code(prefix: str = "DB"):
    # Unique code for human-friendly display.
    # Use a short crypto-random token.
    return f"{prefix}-{secrets.token_hex(4).upper()}"


def _make_temp_password(length: int = 12):
    # Firebase requires minimum 6 chars.
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _get_app_url() -> str:
    url = (current_app.config.get("NEXT_PUBLIC_APP_URL") or "").strip()
    if url:
        return url.rstrip("/")
    return "http://localhost:3001"



@admin_delivery_boys_bp.route("/admin/deliveryboys/create", methods=["POST", "OPTIONS"])
@token_required
@admin_required
def create_delivery_boy(current_user):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    email = (data.get("email") or "").strip().lower()
    vehicle_type = (data.get("vehicle_type") or "").strip()

    if not name or not phone or not email:
        return jsonify({"success": False, "message": "name, phone, email are required"}), 400

    logger.info(f"Admin {current_user.get('uid')} creating delivery boy: {email}")

    temp_password = _make_temp_password()
    delivery_code = _generate_delivery_code()

    try:
        # Check existing
        try:
            firebase_auth.get_user_by_email(email)
            return jsonify({"success": False, "message": "User already exists"}), 409
        except firebase_auth.UserNotFoundError:
            pass

        user_record = firebase_auth.create_user(
            email=email,
            password=temp_password,
            display_name=name,
        )
        uid = user_record.uid

        # Set Custom Claims for security
        firebase_auth.set_custom_user_claims(uid, {"role": "deliveryBoy"})

        # Persist profile
        set_document(
            "deliveryBoys",
            uid,
            {
                "uid": uid,
                "role": "deliveryBoy",
                "name": name,
                "phone": phone,
                "vehicleType": vehicle_type,
                "active": True,
                "createdAt": datetime.utcnow(),
            },
            merge=False,
        )

        # Notify via Email and WhatsApp
        app_url = _get_app_url()
        try:
            NotificationService.dispatch(
                recipient_email=email,
                recipient_phone=phone,
                n_type="delivery_credentials",
                context={
                    "name": name,
                    "email": email,
                    "password": temp_password,
                    "login_link": f"{app_url}/delivery/login"
                }
            )
        except Exception as e:
            logger.error(f"Failed to dispatch delivery credentials: {e}")

        return jsonify({
            "success": True,
            "message": "Delivery boy created and credentials sent.",
            "data": {"uid": uid}
        }), 201

    except Exception as e:
        logger.error(f"Failed to create delivery boy: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@admin_delivery_boys_bp.route("/admin/deliveryboys/toggle", methods=["POST", "OPTIONS"])
@token_required
@admin_required
def toggle_delivery_boy(current_user):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    data = request.get_json(silent=True) or {}
    uid = data.get("uid")
    active = data.get("active")

    if not uid or active is None:
        return jsonify({"success": False, "message": "uid and active are required"}), 400

    try:
        set_document(
            "deliveryBoys",
            uid,
            {"active": bool(active), "updatedAt": datetime.utcnow()},
            merge=True,
        )
        return jsonify({"success": True, "message": "Updated"}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@admin_delivery_boys_bp.route("/admin/deliveryboys/reset-password", methods=["POST", "OPTIONS"])
@token_required
@admin_required
def reset_delivery_boy_password(current_user):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    data = request.get_json(silent=True) or {}
    uid = data.get("uid")

    if not uid:
        return jsonify({"success": False, "message": "uid is required"}), 400

    try:
        snap = None
        # Delivery boys profile keyed by uid
        try:
            from services.firestore_service import get_document
            snap = get_document("deliveryBoys", uid)
        except Exception:
            snap = None

        email = (snap or {}).get("email")
        if not email:
            return jsonify({"success": False, "message": "Delivery boy email not found"}), 404

        temp_password = _make_temp_password()
        firebase_auth.update_user(uid, password=temp_password)

        app_url = _get_app_url()
        login_link = f"{app_url}/delivery/login"
        snap_name = (snap or {}).get("name") or "Delivery"
        snap_phone = (snap or {}).get("phone")
        
        try:
            NotificationService.dispatch(
                recipient_email=email,
                recipient_phone=snap_phone,
                n_type="delivery_credentials",
                context={
                    "name": snap_name,
                    "email": email,
                    "password": temp_password,
                    "login_link": login_link
                }
            )
            dispatch_status = "sent"
        except Exception as e:
            logger.error(f"Failed to dispatch reset credentials: {e}")
            dispatch_status = "failed"

        return jsonify({
            "success": True,
            "dispatchStatus": dispatch_status,
            "data": {
                "uid": uid,
                "email": email,
                "temporaryPassword": temp_password,
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@admin_delivery_boys_bp.route("/admin/logistics/fleet-status", methods=["GET"])
@token_required
@admin_required
def get_fleet_status(current_user):
    try:
        from services.firestore_service import get_all
        boys = get_all("deliveryBoys")
        total = len(boys)
        active = len([b for b in boys if b.get("active")])
        
        # Get pending orders count
        orders = get_all("orders")
        pending_deliveries = len([o for o in orders if o.get("order_status") in ["Packed", "Shipped", "Out for Delivery"]])

        return jsonify({
            "status": "connected",
            "total_agents": total,
            "active_agents": active,
            "pending_deliveries": pending_deliveries,
            "system_health": "good"
        }), 200
    except Exception as e:
        logger.error(f"Fleet status error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
