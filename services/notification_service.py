import threading
import time
from datetime import datetime
from flask import current_app, has_request_context, request
from config.firebase_config import db
from services.whatsapp_service import WhatsAppService
from services.email_service import EmailService
from firebase_admin import auth as firebase_auth
from utils.logger import get_logger
from utils.constants import NotificationStatus, NotificationChannel

logger = get_logger("notification_service")

# Centralized Templates
TEMPLATES = {
    "otp_message": "Your PSI Book Store OTP is {otp}. Valid for 60 minutes. Do not share this with anyone.",
    "delivery_assigned_customer": "🚚 Your PSI order #{order_id} has been assigned to {dboy_name} ({dboy_phone}). OTP: {otp}. Tracking: {tracking_url}",
    "delivery_assigned_dboy": "📦 PSI Book Store - New Delivery: Order #{order_id} for {customer_name}. Address: {address}. Phone: {customer_phone}",
    "out_for_delivery": "🚚 Your PSI order #{order_id} is out for delivery with {dboy_name}. Please keep your OTP ready.",
    "delivered": "✅ Order #{order_id} has been delivered by PSI Book Store. Thank you for shopping with us!",
    "failed_attempt": "⚠️ PSI delivery attempt for order #{order_id} failed. Reason: {reason}. We will try again soon.",
    "delivery_credentials": "Welcome to PSI Book Store Delivery Team! 📦 Your login credentials: \nEmail: {email}\nPassword: {password}\nLogin at: {login_link}\n\nPlease change your password after logging in."
}


def get_delivery_creds_html(context):
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fa;">
    <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%); padding: 0; text-align: center;">
            <img src="https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80" alt="PSI Book Store Banner" style="width: 100%; max-width: 600px; height: auto; display: block;">
            <div style="padding: 20px;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -1px;">PSI BOOK STORE</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 0; font-weight: 500; font-size: 14px;">Delivery Team Onboarding</p>
            </div>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
            <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px; font-weight: 700;">Welcome, {context.get('name', 'Delivery Partner')}!</h2>
            <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                We are excited to have you on board. Your delivery partner account has been successfully created. Please use the temporary credentials below to access your dashboard.
            </p>
            
            <!-- Credentials Card -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; color: #94a3b8; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Email Address</label>
                    <div style="color: #0f172a; font-size: 16px; font-weight: 600;">{context.get('email')}</div>
                </div>
                <div>
                    <label style="display: block; color: #94a3b8; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Temporary Password</label>
                    <div style="color: #6366f1; font-size: 20px; font-weight: 800; letter-spacing: 1px;">{context.get('password')}</div>
                </div>
            </div>
            
            <!-- Action Button -->
            <div style="text-align: center; margin-bottom: 30px;">
                <a href="{context.get('login_link')}" style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.2);">Access Dashboard</a>
            </div>
            
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; text-align: center; margin: 0;">
                For security reasons, please change your password immediately after your first login.
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; 2026 PSI Book Store. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""

def get_order_notification_html(n_type, context):
    titles = {
        "otp_message": "Security Verification",
        "delivery_assigned_customer": "Delivery Partner Assigned",
        "delivery_assigned_dboy": "New Mission Assigned",
        "out_for_delivery": "Order Out for Delivery",
        "delivered": "Package Delivered!",
        "failed_attempt": "Delivery Attempt Failed"
    }
    
    emojis = {
        "otp_message": "🔐",
        "delivery_assigned_customer": "🤝",
        "delivery_assigned_dboy": "📦",
        "out_for_delivery": "🚚",
        "delivered": "🎁",
        "failed_attempt": "⚠️"
    }

    title = titles.get(n_type, "Order Update")
    emoji = emojis.get(n_type, "🔔")
    message = TEMPLATES.get(n_type, "").format(**context)
    order_id = context.get("order_id", "N/A")
    
    # Custom colors based on type
    color = "#6366f1" # default indigo
    if n_type == "delivered": color = "#10b981" # emerald
    if n_type == "failed_attempt": color = "#ef4444" # red

    tracking_btn = ""
    if "tracking_url" in context:
        tracking_btn = f"""
        <div style="text-align: center; margin-top: 30px;">
            <a href="{context['tracking_url']}" style="display: inline-block; background-color: {color}; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Track Live Location</a>
        </div>
        """

    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, {color} 0%, #4f46e5 100%); padding: 40px 20px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 15px;">{emoji}</div>
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">{title}</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 13px; font-weight: 600;">ORDER #{order_id}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 35px;">
            <div style="background-color: #f1f5f9; border-radius: 20px; padding: 30px; text-align: center;">
                <p style="color: #334155; font-size: 18px; line-height: 1.6; margin: 0; font-weight: 600;">
                    {message}
                </p>
            </div>
            
            {tracking_btn}

            <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid #f1f5f9; text-align: center;">
                <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0;">
                    Thank you for choosing <b>PSI Book Store</b>. We are committed to providing you with the best literary experience.
                </p>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 25px; text-align: center;">
            <p style="color: #cbd5e1; font-size: 11px; margin: 0; text-transform: uppercase; tracking: 1px; font-weight: 700;">
                &copy; 2026 PSI Book Store &bull; Logistics Division
            </p>
        </div>
    </div>
</body>
</html>
"""

class NotificationService:
    @staticmethod
    def save_in_app_notification(recipient_email, title, message, n_type, order_id=None):
        """Save notification to notifications collection for in-app display."""
        try:
            if not recipient_email: return
            
            # Find user by email
            users = db.collection("users").where("email", "==", recipient_email).limit(1).stream()
            user_id = None
            for doc in users:
                user_id = doc.id
                break
            
            if not user_id:
                # Fallback: check if the recipient_email is actually a uid
                try:
                    user_record = firebase_auth.get_user(recipient_email)
                    user_id = user_record.uid
                except:
                    pass

            if user_id:
                db.collection("notifications").add({
                    "user_id": user_id,
                    "title": title,
                    "message": message,
                    "type": n_type,
                    "order_id": order_id,
                    "read": False,
                    "timestamp": datetime.utcnow()
                })
        except Exception as e:
            logger.error(f"Failed to save in-app notification: {e}")

    @staticmethod
    def log_notification(recipient, channel, provider, status, n_type, order_id=None, error=None, request_id=None):
        """Audit logging to Firestore."""
        try:
            log_data = {
                "recipient": recipient,
                "channel": channel,
                "provider": provider,
                "status": status,
                "type": n_type,
                "order_id": order_id or "system",
                "error_message": str(error) if error else None,
                "request_id": request_id or "system",
                "timestamp": datetime.utcnow()
            }
            db.collection("notification_logs").add(log_data)
        except Exception as e:
            logger.error(f"Failed to write notification log: {e}")

    @staticmethod
    def _send_async(app_context, fn, *args, **kwargs):
        """Helper to run tasks in background with app context."""
        def wrapper():
            with app_context:
                try:
                    fn(*args, **kwargs)
                except Exception as e:
                    logger.error(f"Async notification task failed: {e}")
        
        thread = threading.Thread(target=wrapper, daemon=True)
        thread.start()

    @staticmethod
    def dispatch(recipient_email, recipient_phone, n_type, context, order_id=None, use_whatsapp=True, use_email=True, html_body=None):
        """
        Main entry point for sending notifications.
        Always attempts to send via BOTH channels if requested, independently.
        """
        # Safely get app object.
        try:
            app = current_app._get_current_object()
        except RuntimeError:
            from app import app as flask_app
            app = flask_app

        request_id = "system"
        try:
            if has_request_context():
                request_id = getattr(request, "request_id", "no-id")
        except:
            pass
        
        # Determine Title for in-app
        titles = {
            "otp_message": "Security Verification",
            "delivery_assigned_customer": "Delivery Partner Assigned",
            "delivery_assigned_dboy": "New Mission Assigned",
            "out_for_delivery": "Order Out for Delivery",
            "delivered": "Package Delivered!",
            "failed_attempt": "Delivery Attempt Failed"
        }
        title = titles.get(n_type, "Order Update")
        message = TEMPLATES.get(n_type, "").format(**context)

        # 0. Save In-App Notification (Synchronous or fast)
        if recipient_email:
            NotificationService.save_in_app_notification(recipient_email, title, message, n_type, order_id)
        
        def task():
            results = {"whatsapp": "skipped", "email": "skipped"}
            
            # 1. WhatsApp Channel
            if use_whatsapp and recipient_phone:
                try:
                    msg = TEMPLATES.get(n_type, "").format(**context)
                    success = WhatsAppService.send_message(recipient_phone, msg, order_id)
                    results["whatsapp"] = "sent" if success else "failed"
                    NotificationService.log_notification(
                        recipient_phone, "whatsapp", "node_service", 
                        "sent" if success else "failed", n_type, order_id, 
                        None if success else "WA_SEND_FAIL", request_id
                    )
                except Exception as e:
                    logger.error(f"WhatsApp dispatch crashed: {e}")
                    results["whatsapp"] = f"error: {str(e)}"
                    NotificationService.log_notification(
                        recipient_phone, "whatsapp", "node_service", 
                        "failed", n_type, order_id, f"CRASH: {str(e)}", request_id
                    )

            # 2. Email Channel
            if use_email and recipient_email:
                try:
                    subject = f"Notification: {n_type.replace('_', ' ').title()}"
                    
                    # Generate HTML body if not provided
                    final_html = html_body
                    if not final_html:
                        if n_type == "delivery_credentials":
                            final_html = get_delivery_creds_html(context)
                        else:
                            final_html = get_order_notification_html(n_type, context)
                            
                    success = EmailService.send_email(recipient_email, subject, final_html)
                    results["email"] = "sent" if success else "failed"
                    NotificationService.log_notification(
                        recipient_email, "email", "flask_mail", 
                        "sent" if success else "failed", n_type, order_id, 
                        None if success else "EMAIL_SEND_FAIL", request_id
                    )
                except Exception as e:
                    logger.error(f"Email dispatch crashed: {e}")
                    results["email"] = f"error: {str(e)}"
                    NotificationService.log_notification(
                        recipient_email, "email", "flask_mail", 
                        "failed", n_type, order_id, f"CRASH: {str(e)}", request_id
                    )

            logger.info(f"Dispatch completed for {n_type}. Results: {results}")
            return results

        NotificationService._send_async(app.app_context(), task)
