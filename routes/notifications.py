from flask import Blueprint, jsonify, request
from config.firebase_config import db
from routes.auth import token_required
from datetime import datetime

notifications_bp = Blueprint("notifications", __name__)

@notifications_bp.route("/notifications", methods=["GET"])
@token_required
def get_user_notifications(current_user):
    user_id = current_user.get("uid")
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    try:
        # Get last 20 notifications
        docs = db.collection("notifications")\
            .where("user_id", "==", user_id)\
            .order_by("timestamp", direction="DESCENDING")\
            .limit(20)\
            .stream()
            
        notifications = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            notifications.append(data)
            
        return jsonify({"success": True, "notifications": notifications}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@notifications_bp.route("/notifications/mark-read", methods=["POST"])
@token_required
def mark_notifications_read(current_user):
    user_id = current_user.get("uid")
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    try:
        data = request.get_json(silent=True) or {}
        notification_id = data.get("notification_id")
        
        if notification_id:
            # Mark specific one as read
            db.collection("notifications").document(notification_id).update({"read": True})
        else:
            # Mark all for this user as read
            unread = db.collection("notifications")\
                .where("user_id", "==", user_id)\
                .where("read", "==", False)\
                .stream()
            
            batch = db.batch()
            for doc in unread:
                batch.update(doc.reference, {"read": True})
            batch.commit()
            
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
