import os
from functools import wraps
from typing import Optional

from dotenv import load_dotenv
from flask import jsonify, request
from firebase_admin import auth as firebase_auth

from config.firebase_config import db


load_dotenv()

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()


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
            decoded = firebase_auth.verify_id_token(token)
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
        except Exception:
            return jsonify({"message": "Invalid token"}), 401

        return f(current_user, *args, **kwargs)

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

        if ADMIN_EMAIL and isinstance(email, str) and email.strip().lower() == ADMIN_EMAIL:
            return f(current_user, *args, **kwargs)

        return jsonify({"message": "Admin access required"}), 403

    return decorated
