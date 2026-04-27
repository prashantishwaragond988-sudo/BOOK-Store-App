import html

from flask import Blueprint, jsonify, request, current_app
from flask_mail import Message

from extensions import mail


contact_bp = Blueprint("contact", __name__)

ADMIN_EMAIL = "psibookstore93@gmail.com"


def _as_str(value) -> str:
    return (value or "").strip() if isinstance(value, str) else str(value or "").strip()


def _is_valid_email(email: str) -> bool:
    email = (email or "").strip()
    if not email or len(email) > 254:
        return False
    return "@" in email and "." in email


def _contact_admin_html(*, name: str, email: str, message: str) -> str:
    name_escaped = html.escape(name)
    email_escaped = html.escape(email)
    message_escaped = html.escape(message).replace("\n", "<br/>")
    return f"""\
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>New Contact Message</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0b1220;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0b1220;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,0.45);">
            <tr>
              <td style="padding:22px 22px 10px 22px;font-family:Arial,Helvetica,sans-serif;">
                <div style="font-size:18px;font-weight:800;color:#ff7a00;line-height:1.2;">
                  New Contact Message
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 22px 18px 22px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                <div style="font-size:13px;line-height:1.6;color:#374151;">
                  <div><strong>Name:</strong> {name_escaped}</div>
                  <div><strong>Email:</strong> {email_escaped}</div>
                  <div style="margin-top:10px;"><strong>Message:</strong></div>
                  <div style="margin-top:6px;padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px solid #e5e7eb;color:#111827;">
                    {message_escaped}
                  </div>
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


def _contact_user_reply_html(*, name: str, logo_url: str) -> str:
    name_escaped = html.escape(name)
    logo_url_escaped = html.escape((logo_url or "").strip())
    logo_block = (
        f"""
                <div style="text-align:center;">
                  <img src="{logo_url_escaped}" alt="PSI Bookstore" style="width:120px;max-width:120px;height:auto;display:inline-block;margin-bottom:15px;" />
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
    <title>We received your message</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0b1220;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0b1220;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;background-color:#ffffff;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,0.45);">
            <tr>
              <td style="padding:26px 24px 10px 24px;font-family:Arial,Helvetica,sans-serif;">
{logo_block}
                <div style="text-align:center;font-size:22px;font-weight:800;color:#ff7a00;line-height:1.2;">
                  We received your message
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 24px 18px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                <div style="text-align:center;font-size:14px;line-height:1.6;color:#374151;">
                  Hi {name_escaped},<br/><br/>
                  Thanks for contacting PSI Bookstore. We will respond shortly.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px 22px 24px;font-family:Arial,Helvetica,sans-serif;border-top:1px solid #e5e7eb;">
                <div style="font-size:12px;line-height:1.6;color:#6b7280;">
                  If you didn't submit this request, you can ignore this email.
                </div>
                <div style="margin-top:10px;font-size:12px;line-height:1.6;color:#9ca3af;">
                  (c) PSI Bookstore
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


@contact_bp.route("/contact", methods=["POST"])
def contact():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}

    name = _as_str(data.get("name"))
    email = _as_str(data.get("email"))
    message = _as_str(data.get("message"))

    if not name or not email or not message:
        return jsonify({"success": False, "message": "name, email and message are required"}), 400

    if not _is_valid_email(email):
        return jsonify({"success": False, "message": "invalid email"}), 400

    if len(name) > 100 or len(message) > 4000:
        return jsonify({"success": False, "message": "invalid input"}), 400

    if not current_app.config.get("MAIL_USERNAME") or not current_app.config.get("MAIL_PASSWORD"):
        return jsonify({"success": False, "message": "SMTP not configured"}), 500

    try:
        admin_msg = Message(
            subject="New Contact Message",
            recipients=[ADMIN_EMAIL],
            reply_to=email,
        )
        admin_msg.html = _contact_admin_html(name=name, email=email, message=message)
        mail.send(admin_msg)

        logo_url = current_app.config.get("OTP_EMAIL_LOGO_URL") or ""
        user_msg = Message(subject="We received your message", recipients=[email])
        user_msg.html = _contact_user_reply_html(name=name, logo_url=logo_url)
        mail.send(user_msg)

        return jsonify({"success": True, "message": "Message sent successfully"}), 200
    except Exception:
        return jsonify({"success": False, "message": "Email send failure"}), 502
