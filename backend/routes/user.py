from flask import Blueprint, jsonify, request

from services.firestore_service import has_paid_ebook_purchase

from .orders import token_required

user_bp = Blueprint("user", __name__)


@user_bp.route("/has-purchased/<ebook_id>", methods=["GET", "OPTIONS"])
@token_required
def has_purchased(email, ebook_id):
    if request.method == "OPTIONS":
        return jsonify({"purchased": False}), 200

    purchased = has_paid_ebook_purchase(email, ebook_id)
    return jsonify({"purchased": bool(purchased)}), 200
