from flask import Blueprint, jsonify, request

from services.firestore_service import has_paid_ebook_purchase

from .orders import token_required
from services.cloudinary_service import upload_image
from services.firestore_service import db, get_all, update_document

user_bp = Blueprint("user", __name__)


@user_bp.route("/has-purchased/<ebook_id>", methods=["GET", "OPTIONS"])
@token_required
def has_purchased(email, ebook_id):
    if request.method == "OPTIONS":
        return jsonify({"purchased": False}), 200

    purchased = has_paid_ebook_purchase(email, ebook_id)
    return jsonify({"purchased": bool(purchased)}), 200


@user_bp.route("/theme", methods=["GET", "POST", "OPTIONS"])
@token_required
def user_theme(email):
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    from services.firestore_service import db

    if request.method == "GET":
        try:
            # Try to find user by email since that's what email is in this context
            docs = db.collection("users").where("email", "==", email).limit(1).stream()
            for doc in docs:
                data = doc.to_dict()
                return jsonify({"theme": data.get("theme", "AURORA")}), 200
            return jsonify({"theme": "AURORA"}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        theme = data.get("theme", "AURORA")
        try:
            docs = db.collection("users").where("email", "==", email).limit(1).stream()
            for doc in docs:
                db.collection("users").document(doc.id).update({"theme": theme})
                return jsonify({"success": True, "theme": theme}), 200
            return jsonify({"error": "User not found"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@user_bp.route("/upload-photo", methods=["POST"])
@token_required
def upload_profile_photo(email):
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
            
        safe_email = email.replace('@', '_').replace('.', '_')
        folder = f"aurora_users/{safe_email}"
        photo_url = upload_image(file, folder=folder)
        
        users = db.collection("users").where("email", "==", email).limit(1).stream()
        user_found = False
        for doc in users:
            db.collection("users").document(doc.id).update({"photo_url": photo_url})
            user_found = True
            break
            
        if user_found:
            return jsonify({"success": True, "photo_url": photo_url}), 200
        
        return jsonify({"error": "User not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
