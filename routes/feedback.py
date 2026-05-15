from flask import Blueprint, jsonify, request
from config.firebase_config import db
from routes.auth import token_required
from datetime import datetime

feedback_bp = Blueprint("feedback", __name__)

@feedback_bp.route("/delivery-feedback", methods=["POST"])
@token_required
def submit_delivery_feedback(current_user):
    try:
        data = request.get_json(silent=True) or {}
        order_id = data.get("order_id")
        delivery_rating = data.get("delivery_rating")
        store_rating = data.get("store_rating")
        feedback_text = data.get("feedback_text", "")
        
        if not order_id:
            return jsonify({"success": False, "message": "order_id is required"}), 400

        # Save feedback
        db.collection("order_feedback").add({
            "order_id": order_id,
            "user_id": current_user.get("uid"),
            "delivery_rating": delivery_rating,
            "store_rating": store_rating,
            "feedback_text": feedback_text,
            "timestamp": datetime.utcnow()
        })
        
        # Also update order doc to show feedback given
        db.collection("orders").document(order_id).update({"feedback_given": True})
        
        return jsonify({"success": True, "message": "Feedback submitted"}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
