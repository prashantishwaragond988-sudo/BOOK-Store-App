from flask import Blueprint, jsonify, request
from services.firestore_service import get_all
from routes.auth import token_required_email as token_required
from datetime import datetime

products_bp = Blueprint("products", __name__)

@products_bp.route("/categories", methods=["GET"])
def get_categories():
    try:
        data = get_all("categories", raise_on_error=True) or []
        return jsonify(data), 200
    except (TimeoutError, RuntimeError) as e:
        # Don't let a Firestore connectivity issue hang the request or break the UI.
        print("ERROR in /categories (firestore):", str(e))
        return jsonify([]), 200
    except Exception as e:
        print("ERROR in /categories:", str(e))
        return jsonify({"error": str(e)}), 500

@products_bp.route("/books/<doc_id>", methods=["GET"])
def get_book(doc_id):
    try:
        from services.firestore_service import get_document
        doc = get_document("books", doc_id)
        if not doc:
            return jsonify({"error": "Book not found"}), 404
        return jsonify(doc), 200
    except Exception as e:
        print(f"ERROR in /books/{doc_id}:", str(e))
        return jsonify({"error": str(e)}), 500

@products_bp.route("/books", methods=["GET"])
def get_books():
    try:
        # Always fetch from Firestore without server-side filters; category fields can be stored as
        # strings or references, and strict `.where(...)` filters can accidentally return empty.
        category = request.args.get("category")
        book_type = request.args.get("type")
        try:
            limit = int(request.args.get("limit", 0)) or None
        except (ValueError, TypeError):
            limit = None

        docs = get_all("books", raise_on_error=True) or []

        def _category_matches(value, target: str) -> bool:
            if value is None or not target:
                return False
            # Firestore may store a DocumentReference, dict payload, or plain string.
            doc_id = getattr(value, "id", None)
            if isinstance(doc_id, str) and doc_id:
                return doc_id == target
            if isinstance(value, dict):
                for key in ("id", "category_id", "categoryId", "ref", "path"):
                    v = value.get(key)
                    if isinstance(v, str) and v:
                        if v == target or v.rstrip("/").split("/")[-1] == target:
                            return True
                return False
            if isinstance(value, str):
                return value == target or value.rstrip("/").split("/")[-1] == target
            return False

        result = docs
        if category:
            result = [b for b in result if _category_matches(b.get("category"), category)]
        if book_type:
            result = [b for b in result if str(b.get("type") or "").strip().lower() == str(book_type).strip().lower()]

        if limit:
            result = result[:limit]

        print("Books:", result)
        return jsonify(result), 200
    except (TimeoutError, RuntimeError) as e:
        print("ERROR in /books (firestore):", str(e))
        return jsonify([]), 200
    except Exception as e:
        print("ERROR in /books:", str(e))
        return jsonify({"error": str(e)}), 500

@products_bp.route("/ebooks", methods=["GET"])
def get_ebooks():
    try:
        data = get_all("ebooks", raise_on_error=True) or []
        return jsonify(data), 200
    except (TimeoutError, RuntimeError) as e:
        print("ERROR in /ebooks (firestore):", str(e))
        return jsonify([]), 200
    except Exception as e:
        print("ERROR in /ebooks:", str(e))
        return jsonify({"error": str(e)}), 500
@products_bp.route("/rate", methods=["POST"])
@token_required
def rate_book(email):
    try:
        data = request.get_json() or {}
        book_id = data.get("book_id")
        rating = data.get("rating") # 1-5
        feedback = data.get("feedback", "")
        
        if not book_id or not rating:
            return jsonify({"error": "book_id and rating required"}), 400
            
        from services.firestore_service import db, add_document
        doc_ref = db.collection("books").document(str(book_id))
        doc = doc_ref.get()
        
        if not doc.exists:
            return jsonify({"error": "Book not found"}), 404
            
        book_data = doc.to_dict()
        current_rating = book_data.get("rating", 0)
        review_count = book_data.get("review_count", 0)
        
        # Save review/feedback separately
        add_document("reviews", {
            "user_email": email,
            "book_id": str(book_id),
            "book_title": book_data.get("title", "Unknown"),
            "rating": rating,
            "feedback": feedback,
            "created_at": datetime.utcnow()
        })
        
        # Simple moving average for book doc
        new_review_count = review_count + 1
        new_rating = ((current_rating * review_count) + rating) / new_review_count
        
        doc_ref.update({
            "rating": round(new_rating, 1),
            "review_count": new_review_count
        })
        
        return jsonify({"success": True, "new_rating": round(new_rating, 1)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
