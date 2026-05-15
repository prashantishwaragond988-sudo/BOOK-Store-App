import os
from functools import wraps
from typing import Optional

from dotenv import load_dotenv
from flask import jsonify, request
from firebase_admin import auth as firebase_auth

from config.firebase_config import db
from utils.logger import get_logger

logger = get_logger("auth")


load_dotenv()

# Support multiple admin emails separated by comma
ADMIN_EMAILS = [email.strip().lower() for email in os.getenv("ADMIN_EMAIL", "").split(",") if email.strip()]


def _get_bearer_token():
    auth_header = request.headers.get("Authorization") or ""
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header.split(" ", 1)[1].strip() or None


def _sanitize_user(user: dict) -> dict:
    if not isinstance(user, dict):
        return {}
    cleaned = dict(user)
    cleaned.pop("password", None)
    return cleaned


def _load_user_profile(*, uid: Optional[str], email: Optional[str]):
    profile = None

    if uid:
        try:
            snap = db.collection("users").document(uid).get()
            if snap.exists:
                profile = snap.to_dict() or {}
                profile.setdefault("uid", uid)
        except Exception:
            profile = None

    if not profile and email:
        try:
            docs = db.collection("users").where("email", "==", email).limit(1).stream()
            for doc in docs:
                profile = doc.to_dict() or {}
                profile.setdefault("uid", uid)
                profile.setdefault("email", email)
                profile.setdefault("id", doc.id)
                break
        except Exception:
            profile = None

    return _sanitize_user(profile) if profile else None


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == "OPTIONS":
            return "", 200

        token = _get_bearer_token()
        if not token:
            return jsonify({"message": "Token missing"}), 401

        try:
            # Allow 10 seconds of clock skew to prevent "Token used too early" errors
            decoded = firebase_auth.verify_id_token(token, clock_skew_seconds=10)
            uid = decoded.get("uid")
            email = (decoded.get("email") or "").strip().lower() or None

            if not email and uid:
                try:
                    user_record = firebase_auth.get_user(uid)
                    email = (user_record.email or "").strip().lower() or None
                except Exception:
                    email = None

            profile = _load_user_profile(uid=uid, email=email) or {}
            current_user = {
                "uid": uid,
                "email": email,
                **profile,
            }
        except Exception as e:
            logger.warning(f"Auth failed: {e}")
            return jsonify({"message": "Invalid token"}), 401

        return f(current_user, *args, **kwargs)

    return decorated


def token_required_email(f):
    """
    Legacy compatibility decorator that passes email instead of user dict.
    To be phased out in Phase 4.
    """
    @wraps(f)
    @token_required
    def decorated(current_user, *args, **kwargs):
        email = current_user.get("email")
        return f(email, *args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if request.method == "OPTIONS":
            return "", 200

        email = (current_user or {}).get("email")
        role = (current_user or {}).get("role")

        if role == "admin":
            return f(current_user, *args, **kwargs)

        if ADMIN_EMAILS and isinstance(email, str) and email.strip().lower() in ADMIN_EMAILS:
            logger.info(f"Admin access granted to superuser {email}")
            return f(current_user, *args, **kwargs)

        logger.warning(f"Unauthorized admin access attempt: {email} (role: {role})")
        return jsonify({"message": "Admin access required"}), 403

    return decorated
