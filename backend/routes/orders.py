import os
import time

import re

import requests

from datetime import datetime
from functools import wraps

from flask import Blueprint, jsonify, request
from firebase_admin import auth as firebase_auth

from services.firestore_service import (
    add_document,
    delete_document,
    get_all,
    get_document,
    get_user_orders,
    set_document,
    update_document,
)

orders_bp = Blueprint("orders", __name__)





def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200

        auth_header = request.headers.get('Authorization')

        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'message': 'Token missing'}), 401

        token = auth_header.split(' ')[1]

        try:
            decoded = firebase_auth.verify_id_token(token)
            uid = decoded.get("uid")
            email = decoded.get("email")
            if not email and uid:
                user_record = firebase_auth.get_user(uid)
                email = user_record.email

            if not email:
                return jsonify({'message': 'Invalid token'}), 401
        except Exception:
            return jsonify({'message': 'Invalid token'}), 401

        return f(email, *args, **kwargs)

    return decorated


def _to_int(value, *, default=None):
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_float(value, *, default=None):
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _get_user_cart(email):
    return [item for item in (get_all("cart") or []) if item.get("user_email") == email]


@orders_bp.route("/cart/add", methods=["POST"])
@token_required
def add_to_cart(email):
    data = request.get_json(silent=True) or {}
    product_id = data.get("product_id")
    if not product_id:
        return jsonify({"message": "product_id required"}), 400

    quantity = _to_int(data.get("quantity", 1), default=None)
    if quantity is None or quantity < 1:
        return jsonify({"message": "quantity must be a positive integer"}), 400

    item_type = data.get("type", "book")

    user_cart = _get_user_cart(email)
    existing = next(
        (
            item
            for item in user_cart
            if item.get("product_id") == product_id and item.get("type", "book") == item_type
        ),
        None,
    )

    if existing and existing.get("id"):
        new_quantity = (_to_int(existing.get("quantity", 1), default=1) or 1) + quantity
        update_document("cart", existing["id"], {"quantity": new_quantity})
        existing["quantity"] = new_quantity
        return jsonify({"message": "Cart updated", "item": existing}), 200

    cart_data = {
        "user_email": email,
        "product_id": product_id,
        "quantity": quantity,
        "type": item_type,
    }
    result = add_document("cart", cart_data)
    return jsonify(result), 201


@orders_bp.route("/cart", methods=["GET"])
@token_required
def get_cart(email):
    return jsonify(_get_user_cart(email))


@orders_bp.route("/cart/update/<cart_id>", methods=["PUT"])
@token_required
def update_cart(email, cart_id):
    data = request.get_json(silent=True) or {}
    quantity = _to_int(data.get("quantity"), default=None)
    if quantity is None or quantity < 1:
        return jsonify({"message": "quantity must be a positive integer"}), 400

    user_cart = _get_user_cart(email)
    cart_item = next((item for item in user_cart if item.get("id") == cart_id), None)
    if not cart_item:
        return jsonify({"message": "Cart item not found"}), 404

    update_document("cart", cart_id, {"quantity": quantity})
    return jsonify({"message": "Cart updated"}), 200


@orders_bp.route("/cart/remove/<cart_id>", methods=["DELETE"])
@token_required
def remove_from_cart(email, cart_id):
    user_cart = _get_user_cart(email)
    cart_item = next((item for item in user_cart if item.get("id") == cart_id), None)
    if not cart_item:
        return jsonify({"message": "Cart item not found"}), 404

    delete_document("cart", cart_id)
    return jsonify({"message": "Item removed"}), 200


@orders_bp.route("/orders", methods=["POST"])
@token_required
def create_order(email):
    try:
        data = request.get_json(silent=True) or {}
        print(f"[CREATE_ORDER] request.json: {data}")

        location_payload = data.get("location")
        location = None
        if isinstance(location_payload, dict):
            lat = _to_float(location_payload.get("lat"), default=None)
            lng = _to_float(location_payload.get("lng"), default=None)
            if lat is not None and lng is not None:
                location = {"lat": lat, "lng": lng}

        ebook = data.get("ebook")
        user_cart = _get_user_cart(email)

        if not user_cart and not ebook:
            return jsonify({"success": False, "message": "Cart empty"}), 400

        if ebook:
            ebook_id = (
                ebook.get("ebook_id")
                or ebook.get("ebookId")
                or ebook.get("id")
                or data.get("ebook_id")
                or data.get("ebookId")
            )
            if not ebook_id:
                return jsonify({"success": False, "message": "Invalid ebook payload (missing id)"}), 400

            total_price = _to_float(ebook.get("price"), default=0.0) or 0.0
            if total_price <= 0:
                return jsonify({"success": False, "message": "Invalid ebook price"}), 400

            payment_status = data.get("payment_status", "paid")
            order_data = {
                "user_id": email,
                "ebook_id": str(ebook_id),
                "items": [ebook],
                "address": data.get("address") or None,
                "location": location,
                "payment_status": payment_status,
                "status": payment_status,
                "order_status": data.get("order_status") or "Pending",
                "total_price": total_price,
                "totalPrice": total_price,
                "total": total_price,
                "created_at": datetime.utcnow(),
            }
            result = add_document("orders", order_data)
            return jsonify({"success": True, "data": result}), 201

        # Physical book order validations
        address = data.get("address")
        if not address or not isinstance(address, dict):
            return jsonify({"success": False, "message": "Missing address"}), 400
        if not address.get("name") or not address.get("mobile") or not address.get("address"):
            return jsonify({"success": False, "message": "Address must include name, mobile and address"}), 400

        prices = data.get("prices") or {}
        if not isinstance(prices, dict):
            return jsonify({"success": False, "message": "prices must be an object"}), 400

        books = get_all("books") or []
        books_by_id = {book.get("id"): book for book in books if book.get("id")}

        items = []
        total_price = 0.0

        for cart_item in user_cart:
            product_id = cart_item.get("product_id")
            if not product_id:
                continue

            quantity = _to_int(cart_item.get("quantity", 1), default=1) or 1
            if quantity < 1:
                quantity = 1

            book = books_by_id.get(product_id)
            title = (book.get("title") if book else None) or "Unknown Book"
            image_url = (book.get("image_url") if book else None) or ""

            unit_price = prices.get(product_id)
            if unit_price is None and book:
                unit_price = book.get("price")

            unit_price = _to_float(unit_price, default=0.0) or 0.0
            total_price += unit_price * quantity

            items.append(
                {
                    "product_id": product_id,
                    "quantity": quantity,
                    "price": unit_price,
                    "title": title,
                    "image_url": image_url,
                }
            )

        if not items:
            return jsonify({"success": False, "message": "Cart empty"}), 400

        if total_price <= 0:
            return jsonify({"success": False, "message": "Invalid total price"}), 400

        order_data = {
            "user_id": email,
            "items": items,
            "address": address,
            "location": location,
            "payment_status": data.get("payment_status", "paid"),
            "status": data.get("payment_status", "paid"),
            "order_status": data.get("order_status") or "Pending",
            "total_price": total_price,
            "totalPrice": total_price,
            "total": total_price,
            "created_at": datetime.utcnow(),
        }

        result = add_document("orders", order_data)

        for cart_item in user_cart:
            cart_doc_id = cart_item.get("id")
            if cart_doc_id:
                delete_document("cart", cart_doc_id)

        return jsonify({"success": True, "data": result}), 201
    except Exception as e:
        print(f"[CREATE_ORDER] Exception: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@orders_bp.route("/ebook", methods=["POST", "OPTIONS"])
@token_required
def buy_ebook(email):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    data = request.get_json(silent=True) or {}
    ebook_id = data.get("ebookId")
    if not ebook_id:
        return jsonify({"success": False, "message": "ebookId required"}), 400

    price = _to_float(data.get("price", 0), default=0.0) or 0.0

    try:
        ebooks = get_all("ebooks") or []
        ebook = next((e for e in ebooks if e.get("id") == ebook_id), None)
        if not ebook:
            return jsonify({"success": False, "message": "Ebook not found"}), 404

        purchase_data = {
            "user_id": email,
            "ebook_id": ebook_id,
            "ebook_title": ebook.get("title", ""),
            "pdf_url": ebook.get("pdf_url", ""),
            "image_url": ebook.get("image_url", ""),
            "price": price,
            "status": "purchased",
            "created_at": datetime.utcnow(),
        }

        result = add_document("ebook_purchases", purchase_data)
        return jsonify({"success": True, "data": result}), 201
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@orders_bp.route("/my-ebooks", methods=["GET", "OPTIONS"])
@token_required
def my_ebooks(email):
    orders = get_user_orders(email) or []
    purchases = [p for p in (get_all("ebook_purchases") or []) if p.get("user_id") == email]

    all_ebooks = get_all("ebooks") or []
    ebooks_by_id = {e.get("id"): e for e in all_ebooks if e.get("id")}
    ebooks_by_pdf_url = {e.get("pdf_url"): e for e in all_ebooks if e.get("pdf_url")}

    unique = {}

    for order in orders:
        for item in order.get("items", []) or []:
            if not item.get("pdf_url"):
                continue

            ebook_id = item.get("ebook_id") or item.get("id") or item.get("ebookId") or item.get("product_id")
            if ebook_id and ebook_id not in unique:
                unique[ebook_id] = item
                continue

            pdf_url = item.get("pdf_url")
            if pdf_url and pdf_url not in unique:
                unique[pdf_url] = item

    for purchase in purchases:
        ebook_id = purchase.get("ebook_id") or purchase.get("ebookId")
        if ebook_id and ebook_id not in unique:
            unique[ebook_id] = purchase
            continue

        pdf_url = purchase.get("pdf_url")
        if pdf_url and pdf_url not in unique:
            unique[pdf_url] = purchase

    filtered = []
    seen_ebook_ids = set()

    for purchase in unique.values():
        ebook_id = purchase.get("ebook_id") or purchase.get("ebookId")
        ebook = ebooks_by_id.get(ebook_id) if ebook_id else None
        if not ebook:
            ebook = ebooks_by_pdf_url.get(purchase.get("pdf_url"))

        if not ebook or not ebook.get("id"):
            continue

        if ebook["id"] in seen_ebook_ids:
            continue
        seen_ebook_ids.add(ebook["id"])

        filtered.append(
            {
                "id": ebook["id"],
                "title": ebook.get("title", ""),
                "image_url": ebook.get("image_url", ""),
                "pdf_url": ebook.get("pdf_url", ""),
            }
        )

    return jsonify(filtered), 200


@orders_bp.route("/orders", methods=["GET"])
@token_required
def get_orders(email):
    orders = get_user_orders(email) or []
    for order in orders:
        if isinstance(order, dict) and "address" not in order:
            order["address"] = None
    return jsonify(orders), 200


@orders_bp.route("/create-order", methods=["POST"])
@token_required
def create_cashfree_order(email):
    try:
        data = request.get_json(silent=True) or {}
        print(f"[CREATE_CASHFREE_ORDER] request.json: {data}")

        order_amount = _to_float(data.get("order_amount"), default=0.0) or 0.0
        if order_amount <= 0:
            return jsonify({"success": False, "message": "Invalid order amount"}), 400

        customer = data.get("customer_details", {})
        
        raw_id = customer.get("customer_id") or email
        clean_id = re.sub(r'[^a-zA-Z0-9_-]', '', raw_id.split("@")[0])
            
        if not customer.get("customer_phone"):
            return jsonify({"success": False, "message": "Missing customer_phone"}), 400

        order_id = f"order_{int(time.time() * 1000)}"

        payload = {
            "order_id": order_id,
            "order_amount": order_amount,
            "order_currency": "INR",
            
        
            
            "customer_details": {
              "customer_id": clean_id,
              "customer_email": customer.get("customer_email", email),
              "customer_phone": customer.get("customer_phone"),
            },
        }

        headers = {
            "x-api-version": "2022-09-01",
            "x-client-id": os.environ.get("CASHFREE_APP_ID", "YOUR_APP_ID"),
            "x-client-secret": os.environ.get("CASHFREE_SECRET_KEY", "YOUR_SECRET_KEY"),
            "Content-Type": "application/json",
        }

        response = requests.post(
            "https://sandbox.cashfree.com/pg/orders",
            json=payload,
            headers=headers,
        )
        response_data = response.json()
        print(f"[CREATE_CASHFREE_ORDER] Cashfree response: {response.status_code} - {response_data}")

        if response.status_code not in (200, 201):
            return jsonify({
                "success": False,
                "message": response_data.get("message", "Cashfree order creation failed"),
                "cashfree_error": response_data,
            }), response.status_code

        return jsonify({
            "success": True,
            "payment_session_id": response_data.get("payment_session_id"),
            "order_id": order_id,
        }), 200
    except Exception as e:
        print(f"[CREATE_CASHFREE_ORDER] Exception: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@orders_bp.route("/checkout", methods=["POST"])
@token_required
def checkout(email):
    return jsonify(
        {
            "payment_id": "mock_pay_" + str(datetime.utcnow().timestamp()),
            "status": "success",
            "message": "Payment completed",
        }
    ), 200


@orders_bp.route("/orders/<order_id>", methods=["GET"])
@token_required
def get_order_by_id(email, order_id):
    order = get_document("orders", order_id)
    if not order:
        return jsonify({"success": False, "message": "Order not found"}), 404

    if order.get("user_id") != email:
        return jsonify({"success": False, "message": "Order not found"}), 404

    return jsonify({"success": True, "data": order}), 200


@orders_bp.route("/orders/<order_id>/tracking", methods=["GET"])
@token_required
def get_order_tracking(email, order_id):
    order = get_document("orders", order_id)
    if not order or order.get("user_id") != email:
        return jsonify({"success": False, "message": "Order not found"}), 404

    # Single source of truth: order_status from orders collection
    order_status = order.get("order_status", "Pending")

    tracking = get_document("order_tracking", order_id)

    if not tracking:
        tracking = {
            "status": order_status,
            "processing_days": 1,
            "shipping_days": 4,
            "lat": 28.6139,
            "lng": 77.2090,
            "updated_at": datetime.utcnow(),
        }
        set_document("order_tracking", order_id, tracking, merge=True)
        tracking = {**tracking, "id": order_id}

    created_at = order.get("created_at")
    if isinstance(created_at, datetime):
        order_date = created_at.isoformat()
    elif created_at is None:
        order_date = None
    else:
        order_date = str(created_at)

    response = {
        "order_id": order_id,
        "status": order_status,
        "processing_days": _to_int(tracking.get("processing_days"), default=1) or 1,
        "shipping_days": _to_int(tracking.get("shipping_days"), default=4) or 4,
        "lat": _to_float(tracking.get("lat"), default=28.6139) or 28.6139,
        "lng": _to_float(tracking.get("lng"), default=77.2090) or 77.2090,
        "updated_at": tracking.get("updated_at"),
        "order_date": order_date,
    }

    print(f"[TRACK API] order_id={order_id} | returned_status={order_status}")

    return jsonify({"success": True, "data": response}), 200


@orders_bp.route("/admin/orders", methods=["GET"])
def get_all_orders():
    orders = get_all("orders") or []
    return jsonify(orders), 200
