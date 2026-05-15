from flask import Blueprint, request, jsonify
from services.firestore_service import add_document, delete_document, update_document, get_analytics, get_all, get_document
from datetime import datetime
from services.cloudinary_service import upload_image, upload_pdf
from functools import wraps
from routes.auth import token_required, admin_required  # Reuse auth decorators

admin_bp = Blueprint("admin", __name__)

@admin_bp.route("/add-book", methods=["POST"])
def add_book():
    print("➡️ Request received")

    data = request.get_json()
    title = data.get("title")
    price = data.get("price")
    image_url = data.get("image")

    print("Title:", title)
    print("Price:", price)
    print("Image URL:", image_url)

    if not title or not price or not image_url:
        return jsonify({"error": "Missing required fields"}), 400

    data = {
        "title": title,
        "price": float(price),
        "description": data.get("description", ""),
        "category": data.get("category", ""),
        "image_url": image_url
    }

    print("Saving to Firestore...")
    return jsonify(add_document("books", data))

@admin_bp.route("/books/<doc_id>", methods=["DELETE", "OPTIONS"])
@token_required
@admin_required
def delete_book(current_user, doc_id):
    if request.method == "OPTIONS":
        return "", 200
    return jsonify(delete_document("books", doc_id))

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
