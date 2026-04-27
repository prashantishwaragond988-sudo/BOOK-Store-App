import html
from flask import Blueprint, current_app, jsonify, request
from typing import Optional, Tuple
from flask_mail import Message
from firebase_admin import auth as firebase_auth
from firebase_admin import firestore

from config.firebase_config import db
from extensions import mail
from otp_store import otp_store
import os


otp_auth_bp = Blueprint("otp_auth", __name__)

def _otp_email_html(otp: str, *, logo_url: Optional[str] = None) -> str:
    otp_raw = str(otp)
    otp_raw_escaped = html.escape(otp_raw)
    logo_url_escaped = html.escape((logo_url or "").strip())
    logo_block = (
        f"""
                <div style="text-align:center;">
                  <img src="{logo_url_escaped}" alt="Bookstore" style="width:120px;max-width:120px;height:auto;display:inline-block;margin-bottom:15px;" />
                </div>
"""
        if logo_url_escaped
        else ""
    )
    return f"""\
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bookstore OTP Verification</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0b1220;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0b1220;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;background-color:#ffffff;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,0.45);">
            <tr>
              <td style="padding:28px 24px 8px 24px;font-family:Arial,Helvetica,sans-serif;">
{logo_block}
                <div style="text-align:center;font-size:22px;font-weight:800;color:#ff7a00;line-height:1.2;">
                  Verify Your Email
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 24px 6px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                <div style="text-align:center;font-size:14px;line-height:1.5;color:#374151;">
                  Use the OTP below to verify your email address:
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:14px 24px 10px 24px;font-family:Arial,Helvetica,sans-serif;">
                <div style="display:inline-block;font-size:34px;font-weight:800;letter-spacing:10px;white-space:nowrap;color:#111827;padding:12px 16px;border-radius:12px;background-color:#fff7ed;border:1px solid #fed7aa;">
                  {otp_raw_escaped}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 24px 18px 24px;font-family:Arial,Helvetica,sans-serif;">
                <div style="text-align:center;font-size:13px;line-height:1.5;color:#6b7280;">
                  Valid for 5 minutes
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px 22px 24px;font-family:Arial,Helvetica,sans-serif;border-top:1px solid #e5e7eb;">
                <div style="font-size:12px;line-height:1.6;color:#6b7280;">
                  If you didn't request this code, you can safely ignore this email. For your security, do not share your OTP with anyone.
                </div>
                <div style="margin-top:10px;font-size:12px;line-height:1.6;color:#9ca3af;">
                  (c) Bookstore
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def _json(success: bool, message: str, *, status_code: int = 200, **extra):
    payload = {"success": success, "message": message, **extra}
    return jsonify(payload), status_code


def _get_json():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _validate_email(email: str) -> bool:
    if not email:
        return False
    email = email.strip()
    # Basic check; for stricter validation consider a dedicated validator.
    return "@" in email and "." in email


def _send_otp_email(email: str) -> Tuple[bool, str]:
    if not current_app.config.get("MAIL_USERNAME") or not current_app.config.get("MAIL_PASSWORD"):
        return False, "SMTP not configured"

    max_per_day = int(current_app.config.get("OTP_MAX_PER_DAY", 3))
    if not otp_store.can_send_today(email, max_per_day=max_per_day):
        return False, "Limit reached"

    otp = otp_store.generate_otp()
    otp_store.set_otp(email, otp, ttl_seconds=int(current_app.config["OTP_TTL_SECONDS"]))

    try:
        msg = Message(subject="Verify Your Email", recipients=[email])
        msg.html = _otp_email_html(otp, logo_url=current_app.config.get("OTP_EMAIL_LOGO_URL"))
        mail.send(msg)
    except Exception:
        otp_store.clear_otp(email)
        return False, "Email send failure"

    otp_store.record_sent_today(email)
    return True, "OTP sent"


@otp_auth_bp.route("/send-otp", methods=["POST"])
def send_otp():
    data = _get_json()
    email = (data.get("email") or "").strip()
    if not _validate_email(email):
        return _json(False, "Invalid email", status_code=400)

    ok, message = _send_otp_email(email)
    if not ok:
        if message == "SMTP not configured":
            return _json(False, message, status_code=500)
        if message == "Limit reached":
            return _json(False, message, status_code=429)
        return _json(False, message, status_code=502)
    return _json(True, message)


@otp_auth_bp.route("/resend-otp", methods=["POST"])
def resend_otp():
    # Same behavior as /send-otp, but provided as a separate endpoint for frontend clarity.
    data = _get_json()
    email = (data.get("email") or "").strip()
    if not _validate_email(email):
        return _json(False, "Invalid email", status_code=400)

    ok, message = _send_otp_email(email)
    if not ok:
        if message == "SMTP not configured":
            return _json(False, message, status_code=500)
        if message == "Limit reached":
            return _json(False, message, status_code=429)
        return _json(False, message, status_code=502)
    return _json(True, message)


@otp_auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = _get_json()
    email = (data.get("email") or "").strip()
    otp = (data.get("otp") or "").strip()
    if not _validate_email(email) or not otp:
        return _json(False, "Invalid input", status_code=400)

    ok, reason = otp_store.verify_otp(
        email,
        otp,
        verified_ttl_seconds=int(current_app.config["VERIFIED_TTL_SECONDS"]),
    )
    if not ok:
        status = 400 if reason == "Invalid OTP" else 410
        return _json(False, reason, status_code=status)

    return _json(True, "OTP verified")


@otp_auth_bp.route("/register", methods=["POST"])
def register():
    data = _get_json()
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip()

    if not _validate_email(email) or not password or len(password) < 6 or not name:
        return _json(False, "Invalid input", status_code=400)

    if not otp_store.is_verified(email):
        return _json(False, "Email not verified", status_code=403)

    # Prevent duplicates before creating.
    try:
        firebase_auth.get_user_by_email(email)
        return _json(False, "User already exists", status_code=409)
    except firebase_auth.UserNotFoundError:
        pass
    except Exception:
        return _json(False, "Firebase lookup failed", status_code=502)

    try:
        user_record = firebase_auth.create_user(
            email=email,
            password=password,
            display_name=name,
        )
    except firebase_auth.EmailAlreadyExistsError:
        return _json(False, "User already exists", status_code=409)
    except Exception:
        return _json(False, "Firebase user creation failed", status_code=502)

    # Store additional profile in Firestore (no password stored here).
    try:
        doc_ref = db.collection("users").document(user_record.uid)

        role = "user"
        try:
            existing = doc_ref.get()
            if existing.exists:
                existing_role = (existing.to_dict() or {}).get("role")
                if existing_role in ("admin", "user"):
                    role = existing_role
        except Exception:
            # If role lookup fails, default to "user" without blocking registration.
            role = "user"

        doc_ref.set(
            {
                "uid": user_record.uid,
                "email": email,
                "name": name,
                "role": role,
                "createdAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
    except Exception:
        # User exists in Auth even if this write fails.
        otp_store.clear_verification(email)
        return _json(True, "Registration successful", status_code=201, uid=user_record.uid, warning="Firestore write failed")

    otp_store.clear_verification(email)
    return _json(True, "Registration successful", status_code=201, uid=user_record.uid)
