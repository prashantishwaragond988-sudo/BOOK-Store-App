from flask import Blueprint, jsonify, request
from services.firestore_service import get_all, query_collection

products_bp = Blueprint("products", __name__)

@products_bp.route("/categories", methods=["GET"])
def get_categories():
    return jsonify(get_all("categories"))

@products_bp.route("/books", methods=["GET"])
def get_books():
    category = request.args.get("category")
    book_type = request.args.get("type")
    limit = int(request.args.get("limit", 0)) or None
    order_type = request.args.get("order", "latest")
    return jsonify(query_collection("books", category=category, type_filter=book_type, order_by="created_at" if order_type == "latest" else None, limit=limit))

@products_bp.route("/ebooks", methods=["GET"])
def get_ebooks():
    return jsonify(get_all("ebooks"))
