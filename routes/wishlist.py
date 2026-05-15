from flask import Blueprint, jsonify, request
from services.firestore_service import add_document, get_all, delete_document, query_collection
from routes.auth import token_required_email as token_required
from datetime import datetime

wishlist_bp = Blueprint("wishlist", __name__)

@wishlist_bp.route("/toggle", methods=["POST"])
@token_required
def toggle_wishlist(email):
    try:
        data = request.get_json() or {}
        book_id = data.get("book_id")
        if not book_id:
            return jsonify({"success": False, "message": "book_id required"}), 400

        # Check if already in wishlist
        existing = [w for w in (get_all("wishlist") or []) if w.get("user_id") == email and w.get("book_id") == str(book_id)]
        
        if existing:
            # Remove
            for item in existing:
                delete_document("wishlist", item["id"])
            return jsonify({"success": True, "action": "removed"}), 200
        else:
            # Add
            payload = {
                "user_id": email,
                "book_id": str(book_id),
                "created_at": datetime.utcnow()
            }
            add_document("wishlist", payload)
            return jsonify({"success": True, "action": "added"}), 201
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@wishlist_bp.route("/", methods=["GET"])
@token_required
def get_wishlist(email):
    try:
        # Get wishlist entries for user
        wish_entries = [w for w in (get_all("wishlist") or []) if w.get("user_id") == email]
        wish_book_ids = [w.get("book_id") for w in wish_entries]
        
        # Get all books to find details
        # In a real app, we would query by multiple IDs, but since our get_all is fast:
        all_books = get_all("books") or []
        wishlist_books = [b for b in all_books if str(b.get("id")) in wish_book_ids]
        
        return jsonify(wishlist_books), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
