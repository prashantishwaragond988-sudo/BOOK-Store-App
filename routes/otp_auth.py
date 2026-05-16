import html
from flask import Blueprint, current_app, jsonify, request
from typing import Optional, Tuple
from flask_mail import Message
from firebase_admin import auth as firebase_auth
from firebase_admin import firestore

from config.firebase_config import db
from extensions import mail, limiter
from services.otp_service import OTPService
from services.notification_service import NotificationService
from utils.constants import NotificationChannel
from utils.logger import get_logger
import os

logger = get_logger("otp_auth")

otp_auth_bp = Blueprint("otp_auth", __name__)

def _otp_email_html(otp: str, *, logo_url: Optional[str] = None) -> str:
    # ... existing template ...
    otp_raw = str(otp)
    otp_raw_escaped = html.escape(otp_raw)
    logo_url_escaped = html.escape((logo_url or "").strip())
    logo_block = (
        f"""
                <div style="text-align:center;margin-bottom:20px;">
                  <img src="{logo_url_escaped}" alt="Bookstore" style="width:80px;max-width:80px;height:auto;display:inline-block;border-radius:12px;" />
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
  </head>
  <body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0f172a;">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:500px;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.3);">
            <!-- Header with Gradient -->
            <tr>
              <td style="background:linear-gradient(135deg, #6366f1 0%, #a855f7 100%);padding:40px 20px;text-align:center;">
                {logo_block}
                <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">Verification Code</h1>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding:40px 30px;text-align:center;">
                <p style="margin:0 0 24px 0;font-size:16px;line-height:24px;color:#475569;">
                  Hello! Use the secure code below to complete your registration and join our community of readers.
                </p>
                
                <div style="background-color:#f8fafc;border:2px solid #e2e8f0;border-radius:16px;padding:24px;display:inline-block;margin-bottom:24px;">
                  <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#1e293b;font-family:monospace;">{otp_raw_escaped}</span>
                </div>
                
                <p style="margin:0;font-size:14px;color:#94a3b8;font-weight:500;">
                  This code expires in <span style="color:#6366f1;">5 minutes</span>
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:0 30px 40px 30px;text-align:center;">
                <div style="border-top:1px solid #f1f5f9;padding-top:24px;">
                  <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">
                    If you didn't request this code, you can safely ignore this email. 
                    For your security, never share this code with anyone.
                  </p>
                  <p style="margin:16px 0 0 0;font-size:12px;color:#64748b;font-weight:600;">
                    &copy; 2026 PSI Book Store. All rights reserved.
                  </p>
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

def _forgot_password_email_html(otp: str, *, logo_url: Optional[str] = None) -> str:
    otp_raw = str(otp)
    otp_raw_escaped = html.escape(otp_raw)
    logo_url_escaped = html.escape((logo_url or "").strip())
    logo_block = (
        f"""
                <div style="text-align:center;margin-bottom:20px;">
                  <img src="{logo_url_escaped}" alt="Bookstore" style="width:80px;max-width:80px;height:auto;display:inline-block;border-radius:12px;" />
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
  </head>
  <body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0f172a;">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:500px;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.3);">
            <!-- Header with Gradient (Red/Orange for Security) -->
            <tr>
              <td style="background:linear-gradient(135deg, #f43f5e 0%, #fb923c 100%);padding:40px 20px;text-align:center;">
                {logo_block}
                <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">Reset Password</h1>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding:40px 30px;text-align:center;">
                <p style="margin:0 0 24px 0;font-size:16px;line-height:24px;color:#475569;">
                  We received a request to reset your password. Use the secure code below to proceed:
                </p>
                
                <div style="background-color:#fff1f2;border:2px solid #fecdd3;border-radius:16px;padding:24px;display:inline-block;margin-bottom:24px;">
                  <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#9f1239;font-family:monospace;">{otp_raw_escaped}</span>
                </div>
                
                <p style="margin:0;font-size:14px;color:#94a3b8;font-weight:500;">
                  This code expires in <span style="color:#f43f5e;">5 minutes</span>
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:0 30px 40px 30px;text-align:center;">
                <div style="border-top:1px solid #f1f5f9;padding-top:24px;">
                  <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">
                    If you didn't request a password reset, please ignore this email or contact support if you have concerns.
                  </p>
                  <p style="margin:16px 0 0 0;font-size:12px;color:#64748b;font-weight:600;">
                    &copy; 2026 PSI Book Store. All rights reserved.
                  </p>
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


@otp_auth_bp.route("/send-otp", methods=["POST"])
@limiter.limit("5 per minute; 20 per hour")
def send_otp():
    try:
        data = _get_json()
        email = (data.get("email") or "").strip()
        if not _validate_email(email):
            return _json(False, "Invalid email", status_code=400)

        otp = OTPService._generate_code()
        html_body = _otp_email_html(otp, logo_url=current_app.config.get("OTP_EMAIL_LOGO_URL"))

        try:
            success, message = OTPService.send_otp(
                identifier=email,
                email=email,
                channel=NotificationChannel.EMAIL,
                html_body=html_body,
                otp_code=otp
            )
        except Exception as e:
            logger.error(f"Error in OTPService.send_otp: {e}", exc_info=True)
            return _json(False, f"OTP Service Error: {str(e)}", status_code=500)
        
        if not success:
            return _json(False, message, status_code=429 if "wait" in message else 500)
        
        return _json(True, message)
    except Exception as e:
        logger.error(f"FATAL ERROR in /send-otp: {str(e)}", exc_info=True)
        return _json(False, f"Server Error: {str(e)}", status_code=500)


@otp_auth_bp.route("/resend-otp", methods=["POST"])
@limiter.limit("5 per minute")
def resend_otp():
    return send_otp()


@otp_auth_bp.route("/verify-otp", methods=["POST"])
@limiter.limit("10 per minute")
def verify_otp():
    data = _get_json()
    email = (data.get("email") or "").strip()
    otp = (data.get("otp") or "").strip()
    if not _validate_email(email) or not otp:
        return _json(False, "Invalid input", status_code=400)

    success, message = OTPService.verify_otp(email, otp)
    if not success:
        status = 400 if "Invalid" in message else 403
        return _json(False, message, status_code=status)

    return _json(True, "OTP verified")


@otp_auth_bp.route("/register", methods=["POST"])
@limiter.limit("5 per hour")
def register():
    data = _get_json()
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip()
    mobile_no = (data.get("mobile_no") or data.get("phone") or "").strip()

    if not name:
        return _json(False, "Name is required", status_code=400)
    
    if not mobile_no:
        return _json(False, "Mobile number is required", status_code=400)

    # We now check verification status in otp_sessions collection
    session_ref = db.collection("otp_sessions").document(email)
    session = session_ref.get()
    if not session.exists or not session.to_dict().get("verified"):
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
                "mobile_no": mobile_no,
                "role": role,
                "createdAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
        # Registration successful
        session_ref.delete()
        return _json(True, "Registration successful", status_code=201, uid=user_record.uid)
    except Exception as e:
        logger.error(f"Firestore registration error: {e}")
        return _json(True, "Registration successful", status_code=201, uid=user_record.uid, warning="Profile data not fully synced")


@otp_auth_bp.route("/send-forgot-otp", methods=["POST"])
@limiter.limit("3 per hour")
def send_forgot_otp():
    data = _get_json()
    email = (data.get("email") or "").strip()
    if not _validate_email(email):
        return _json(False, "Invalid email", status_code=400)

    # Check if user exists
    try:
        firebase_auth.get_user_by_email(email)
    except firebase_auth.UserNotFoundError:
        # For security, we don't reveal if the user exists. 
        # But we also don't want to send an OTP if they don't.
        # Let's just return success but not send the email.
        # Actually, standard practice is to say "If an account exists..."
        return _json(True, "If an account exists with this email, an OTP has been sent.")
    except Exception:
        return _json(False, "Service unavailable", status_code=500)

    # Generate Forgot Password HTML
    otp = OTPService._generate_code()
    html_body = _forgot_password_email_html(otp, logo_url=current_app.config.get("OTP_EMAIL_LOGO_URL"))

    # Use a custom handler for the notification dispatch to use the forgot password template
    success, message = OTPService.send_otp(
        identifier=email,
        email=email,
        channel=NotificationChannel.EMAIL,
        html_body=html_body,
        otp_code=otp
    )

    if not success:
        return _json(False, message, status_code=429 if "wait" in message else 500)
    
    return _json(True, "OTP sent successfully.")


@otp_auth_bp.route("/reset-password", methods=["POST"])
@limiter.limit("5 per hour")
def reset_password():
    data = _get_json()
    email = (data.get("email") or "").strip()
    otp = (data.get("otp") or "").strip()
    new_password = data.get("password") or ""

    if not _validate_email(email) or not otp or not new_password:
        return _json(False, "Invalid input", status_code=400)

    # 1. Check if OTP session is verified
    session_ref = db.collection("otp_sessions").document(email)
    session = session_ref.get()
    
    if not session.exists:
        return _json(False, "No active session found", status_code=404)
        
    session_data = session.to_dict()
    if not session_data.get("verified"):
        return _json(False, "OTP not verified", status_code=403)
        
    # Optional: Verify OTP matches (even if already marked verified)
    actual_hash = OTPService._hash_otp(otp, email)
    if actual_hash != session_data.get("otp_hash"):
        return _json(False, "Invalid OTP for this session", status_code=403)

    # 2. Update Password in Firebase
    try:
        user = firebase_auth.get_user_by_email(email)
        firebase_auth.update_user(user.uid, password=new_password)
        
        # Cleanup session
        db.collection("otp_sessions").document(email).delete()
        
        return _json(True, "Password reset successful")
    except Exception as e:
        logger.error(f"Password reset failed for {email}: {e}")
        return _json(False, "Failed to reset password", status_code=500)
