from flask import Blueprint, request, jsonify, current_app
from services.firestore_service import add_document, delete_document, update_document, get_analytics, get_all, get_document, set_document
from datetime import datetime
from services.cloudinary_service import upload_image, upload_pdf
from routes.auth import token_required, admin_required  # Reuse auth decorators
from utils.logger import get_logger

logger = get_logger("admin")

admin_bp = Blueprint("admin", __name__)

@admin_bp.route("/add-book", methods=["POST"])
@token_required
@admin_required
def add_book(current_user):
    logger.info(f"Adding new book, requested by {current_user.get('email')}")

    data = request.get_json()
    title = data.get("title")
    author = (data.get("author") or "").strip()
    if not author:
        author = "Unknown Author"
    price = data.get("price")
    image_url = data.get("image")

    logger.debug(f"Book data: {title}, price: {price}")

    if not title or not price or not image_url:
        return jsonify({"error": "Missing required fields"}), 400

    data = {
        "title": title,
        "author": author,
        "price": float(price),
        "description": data.get("description", ""),
        "category": data.get("category", ""),
        "image_url": image_url
    }

    logger.info(f"Saving book '{title}' to Firestore")
    return jsonify(add_document("books", data))


@admin_bp.route("/books/<doc_id>", methods=["PUT", "OPTIONS"])
@token_required
@admin_required
def update_book(current_user, doc_id):
    if request.method == "OPTIONS":
        return "", 200

    # Support both JSON and Form Data (for image uploads)
    if request.content_type and 'multipart/form-data' in request.content_type:
        payload = request.form.to_dict()
        if 'file' in request.files:
            file = request.files['file']
            try:
                img_url = upload_image(file)
                payload['image_url'] = img_url
            except Exception as e:
                return jsonify({"error": f"Image upload failed: {str(e)}"}), 500
    else:
        payload = request.get_json(silent=True) or {}

    update_payload = {}

    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if not title:
            return jsonify({"error": "Title is required"}), 400
        update_payload["title"] = title

    if "author" in payload:
        author = (payload.get("author") or "").strip() or "Unknown Author"
        update_payload["author"] = author

    if "price" in payload:
        price = payload.get("price")
        if price is None or price == "":
            return jsonify({"error": "Price is required"}), 400
        try:
            update_payload["price"] = float(price)
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid price"}), 400

    if "description" in payload:
        update_payload["description"] = payload.get("description", "")

    if "category" in payload:
        update_payload["category"] = payload.get("category", "")

    image_url = payload.get("image_url")
    if image_url is None and "image" in payload:
        image_url = payload.get("image")
    if image_url is not None:
        update_payload["image_url"] = image_url

    if not update_payload:
        return jsonify({"error": "No fields to update"}), 400

    update_document("books", doc_id, update_payload)
    return jsonify({"message": "Book updated successfully"}), 200

@admin_bp.route("/books/<doc_id>", methods=["DELETE", "OPTIONS"])
@token_required
@admin_required
def delete_book(current_user, doc_id):
    if request.method == "OPTIONS":
        return "", 200
    return jsonify(delete_document("books", doc_id))


@admin_bp.route("/update-ebook/<doc_id>", methods=["PUT", "OPTIONS"])
@token_required
@admin_required
def update_ebook(current_user, doc_id):
    if request.method == "OPTIONS":
        return "", 200

    payload = request.get_json(silent=True) or {}

    update_payload = {}

    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if not title:
            return jsonify({"error": "Title is required"}), 400
        update_payload["title"] = title

    if "author" in payload:
        author = (payload.get("author") or "").strip() or "Unknown Author"
        update_payload["author"] = author

    if "price" in payload:
        price = payload.get("price")
        if price is None or price == "":
            return jsonify({"error": "Price is required"}), 400
        try:
            update_payload["price"] = float(price)
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid price"}), 400

    if "description" in payload:
        update_payload["description"] = payload.get("description", "")

    if "category" in payload:
        update_payload["category"] = payload.get("category", "")

    pdf_url = payload.get("pdf_url")
    if pdf_url is None and "pdfUrl" in payload:
        pdf_url = payload.get("pdfUrl")
    if pdf_url is not None:
        update_payload["pdf_url"] = pdf_url

    image_url = payload.get("image_url")
    if image_url is None and "image" in payload:
        image_url = payload.get("image")
    if image_url is not None:
        update_payload["image_url"] = image_url

    if not update_payload:
        return jsonify({"error": "No fields to update"}), 400

    update_document("ebooks", doc_id, update_payload)
    return jsonify({"message": "Ebook updated successfully"}), 200


@admin_bp.route("/ebooks/<doc_id>", methods=["DELETE", "OPTIONS"])
@token_required
@admin_required
def delete_ebook(current_user, doc_id):
    if request.method == "OPTIONS":
        return "", 200
    return jsonify(delete_document("ebooks", doc_id))

@admin_bp.route("/add-category", methods=["POST"])
@token_required
@admin_required
def add_category(current_user):
    data = request.get_json()
    name = data.get("name")
    if not name:
        return jsonify({"message": "Name required"}), 400
    data = {
        "name": name,
        "created_at": datetime.utcnow()
    }
    return jsonify(add_document("categories", data))

@admin_bp.route("/add-ebook", methods=["POST"])
@token_required
@admin_required
def add_ebook(current_user):
    try:
        data = request.get_json()
        print("Incoming data:", data)

        if not data:
            return jsonify({"error": "No data received"}), 400

        title = data.get("title")
        author = (data.get("author") or "").strip() or "Unknown Author"
        price = data.get("price")
        image_url = data.get("image")
        pdf_url = data.get("pdf_url")

        if price is None:
            return jsonify({"error": "Price missing"}), 400

        try:
            price = float(price)
        except Exception:
            return jsonify({"error": "Invalid price"}), 400

        if not title or not image_url or not pdf_url:
            return jsonify({"error": "Missing required fields"}), 400

        ebook_data = {
            "title": title,
            "author": author,
            "price": price,
            "image_url": image_url,
            "pdf_url": pdf_url,
            "description": data.get("description", ""),
            "category": data.get("category", ""),
        }

        result = add_document("ebooks", ebook_data)
        print("Saved to Firestore:", result)

        return jsonify({
            "success": True,
            "data": result,
        }), 201
    except Exception as e:
        print("ERROR add_ebook:", str(e))
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/delete/<collection>/<doc_id>", methods=["DELETE", "OPTIONS"])
@token_required
@admin_required
def delete(current_user, collection, doc_id):
    if request.method == "OPTIONS":
        return "", 200
    return jsonify(delete_document(collection, doc_id))

@admin_bp.route("/update/<collection>/<doc_id>", methods=["PUT"])
@token_required
@admin_required
def update_price(current_user, collection, doc_id):
    data = request.json
    new_price = data.get("price")
    if new_price is None:
        return jsonify({"message": "Price required"}), 400
    return jsonify(update_document(collection, doc_id, {"price": float(new_price)}))

@admin_bp.route("/analytics", methods=["GET"])
@token_required
@admin_required
def analytics(current_user):
    return jsonify(get_analytics())

@admin_bp.route("/users", methods=["GET"])
@token_required
@admin_required
def get_users(current_user):
    return jsonify(get_all("users"))

ORDER_STATUSES = ["Pending", "Confirmed", "Packed", "Shipped", "Out for Delivery", "Delivered"]

STATUS_TRANSITIONS = {
    "Pending": ["Confirmed"],
    "Confirmed": ["Packed"],
    "Packed": ["Shipped"],
    "Shipped": ["Out for Delivery"],
    "Out for Delivery": ["Delivered"],
    "Delivered": [],
}

@admin_bp.route("/orders", methods=["GET"])
@token_required
@admin_required
def get_all_orders(current_user):
    return jsonify(get_all("orders"))


@admin_bp.route("/update-order-status", methods=["POST", "OPTIONS"])
@token_required
@admin_required
def update_order_status(current_user):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    data = request.get_json(silent=True) or {}
    order_id = data.get("order_id")
    new_status = data.get("status")

    if not order_id or not new_status:
        return jsonify({"success": False, "message": "order_id and status are required"}), 400

    if new_status not in ORDER_STATUSES:
        return jsonify({"success": False, "message": f"Invalid status. Allowed: {ORDER_STATUSES}"}), 400

    order = get_document("orders", order_id)
    if not order:
        return jsonify({"success": False, "message": "Order not found"}), 404

    current_status = order.get("order_status", "Pending")

    if new_status == current_status:
        return jsonify({"success": True, "message": "No change in status"}), 200

    allowed_next = STATUS_TRANSITIONS.get(current_status, [])
    if new_status not in allowed_next:
        return jsonify({
            "success": False,
            "message": f"Invalid transition: {current_status} → {new_status}"
        }), 400

    update_payload = {"order_status": new_status}

    # Maintain status history
    history = order.get("status_history") or []
    if not isinstance(history, list):
        history = []
    history.append({
        "status": new_status,
        "timestamp": datetime.utcnow().isoformat(),
        "updated_by": current_user,
    })
    update_payload["status_history"] = history

    update_document("orders", order_id, update_payload)

    # Sync status to order_tracking for single source of truth
    try:
        from services.firestore_service import set_document
        set_document("order_tracking", order_id, {"status": new_status}, merge=True)
    except Exception as e:
        print(f"[WARN] Failed to sync order_tracking for {order_id}: {e}")

    print(f"[ADMIN UPDATE] order_id={order_id} | old_status={current_status} | new_status={new_status}")

    return jsonify({
        "success": True,
        "message": f"Order status updated to {new_status}",
        "data": {
            "order_id": order_id,
            "status": new_status,
            "status_history": history,
        }
    }), 200


@admin_bp.route("/update-order-timeline", methods=["POST", "OPTIONS"])
@token_required
@admin_required
def update_order_timeline(current_user):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    data = request.get_json(silent=True) or {}
    order_id = data.get("order_id")
    status = data.get("status")
    location = data.get("location")
    message = data.get("message")
    
    if not order_id or not status or not message:
        return jsonify({"success": False, "message": "order_id, status, and message are required"}), 400

    order = get_document("orders", order_id)
    if not order:
        return jsonify({"success": False, "message": "Order not found"}), 404

    tracking = get_document("order_tracking", order_id) or {}
    events = tracking.get("tracking_events", [])
    if not isinstance(events, list):
        events = []

    new_event = {
        "status": status,
        "location": location or "",
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
        "updated_by": current_user,
        "visible_to_user": data.get("visible_to_user", True)
    }
    
    events.append(new_event)

    tracking_payload = {
        "status": status,
        "tracking_events": events,
        "updated_at": datetime.utcnow()
    }
    
    if location:
        tracking_payload["current_location_name"] = location

    set_document("order_tracking", order_id, tracking_payload, merge=True)
    
    # Also update main order status if they pushed a new status
    if status != order.get("order_status"):
        update_document("orders", order_id, {"order_status": status})

    print(f"[ADMIN TIMELINE UPDATE] order_id={order_id} | status={status} | location={location}")

    # Async Notification Dispatch
    customer_phone = order.get("phone") or order.get("location", {}).get("phone")
    customer_email = order.get("user_id")
    
    if status in ["Packed", "Shipped"]:
        from services.notification_service import NotificationService
        n_type = "order_packed" if status == "Packed" else "order_shipped"
        try:
            NotificationService.dispatch(
                recipient_email=customer_email,
                recipient_phone=customer_phone,
                n_type=n_type,
                context={"order_id": order_id},
                order_id=order_id
            )
        except Exception as e:
            logger.error(f"Failed to dispatch timeline notification: {e}")

    return jsonify({
        "success": True,
        "message": "Tracking timeline updated",
        "data": new_event
    }), 200


@admin_bp.route("/upload-pdf", methods=["POST"])
@token_required
@admin_required
def upload_pdf_route(current_user):
    if 'pdf' not in request.files:
        return jsonify({"error": "No PDF file provided"}), 400
    
    file = request.files['pdf']
    if file.filename == '':
        return jsonify({"error": "No PDF file selected"}), 400
    
    try:
        pdf_url = upload_pdf(file)
        print(f"PDF uploaded: {pdf_url}")
        pdf_download = (
            pdf_url.replace("/upload/", "/upload/fl_attachment/") if "/upload/" in pdf_url else pdf_url
        )
        return jsonify({
            "pdf_url": pdf_url,
            "pdf_download": pdf_download
        })
    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({"error": str(e)}), 500

import requests
import os

@admin_bp.route("/whatsapp/status", methods=["GET"])
@token_required
@admin_required
def get_whatsapp_status(current_user):
    node_url = current_app.config.get("WHATSAPP_NODE_SERVICE_URL")
    node_token = current_app.config.get("INTERNAL_WHATSAPP_API_TOKEN")
    
    meta_token = current_app.config.get("WHATSAPP_ACCESS_TOKEN")
    meta_phone_id = current_app.config.get("WHATSAPP_PHONE_NUMBER_ID")

    status_data = {
        "node_service": {"status": "unconfigured"},
        "meta_api": {"status": "unconfigured"}
    }

    # 1. Check Node Service
    if node_url:
        try:
            response = requests.get(
                f"{node_url}/api/whatsapp/status",
                headers={"x-api-secret-token": node_token},
                timeout=3
            )
            if response.status_code == 200:
                status_data["node_service"] = response.json()
            else:
                status_data["node_service"] = {"status": "error", "message": f"HTTP {response.status_code}"}
        except Exception:
            status_data["node_service"] = {"status": "disconnected"}

        try:
            metrics_response = requests.get(
                f"{node_url}/metrics",
                headers={"x-api-secret-token": node_token},
                timeout=3
            )
            if metrics_response.status_code == 200:
                status_data["node_service"]["metrics"] = metrics_response.json()
        except Exception:
            pass

    # 2. Check Meta API
    if meta_token and meta_phone_id:
        status_data["meta_api"] = {"status": "configured", "phone_id": meta_phone_id}
    
    # Unified status for UI compatibility
    if status_data["meta_api"]["status"] == "configured":
        status_data["status"] = "connected" # Meta takes precedence as it's more stable
        status_data["active_provider"] = "meta_cloud_api"
    else:
        status_data["status"] = status_data["node_service"].get("status", "disconnected")
        status_data["active_provider"] = "node_puppeteer"

    return jsonify(status_data), 200
