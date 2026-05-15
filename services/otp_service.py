import hashlib
import hmac
import secrets
import os
from datetime import datetime, timedelta, timezone
from firebase_admin import firestore
from config.firebase_config import db
from utils.logger import get_logger
from services.notification_service import NotificationService
from utils.constants import NotificationChannel

logger = get_logger("otp_service")

OTP_SECRET = os.getenv("OTP_SECRET", "production_secret_do_not_share_123").encode()
OTP_EXPIRY_MINUTES = 60  # Increased to 60 mins for delivery compatibility
OTP_COOLDOWN_SECONDS = 30
OTP_MAX_ATTEMPTS = 5

class OTPService:
    @staticmethod
    def _generate_code(length=6):
        """Generates a secure numeric OTP."""
        return "".join(secrets.choice("0123456789") for _ in range(length))

    @staticmethod
    def _hash_otp(otp, identifier):
        """HMAC-SHA256 for secure OTP hashing."""
        message = f"{identifier}:{otp}".encode()
        return hmac.new(OTP_SECRET, message, hashlib.sha256).hexdigest()

    @staticmethod
    def send_otp(identifier, email=None, phone=None, html_body=None, otp_code=None, channel=None):
        """
        Generates and sends a new OTP to both WhatsApp and Email.
        """
        now = datetime.now(timezone.utc)
        doc_ref = db.collection("otp_sessions").document(identifier)
        
        # Check for existing session and cooldown
        snap = doc_ref.get()
        if snap.exists:
            data = snap.to_dict()
            cooldown_until = data.get("cooldown_until")
            if cooldown_until and now < cooldown_until:
                wait_secs = int((cooldown_until - now).total_seconds())
                return False, f"Please wait {wait_secs} seconds before resending."

        # Generate new OTP or use provided
        otp = otp_code if otp_code else OTPService._generate_code()
        otp_hash = OTPService._hash_otp(otp, identifier)
        
        expires_at = now + timedelta(minutes=OTP_EXPIRY_MINUTES)
        cooldown_until = now + timedelta(seconds=OTP_COOLDOWN_SECONDS)

        # Determine active channels
        use_email = (channel == NotificationChannel.EMAIL) or (channel is None)
        use_whatsapp = (channel == NotificationChannel.WHATSAPP) or (channel is None)
        
        active_channels = []
        if use_email: active_channels.append("email")
        if use_whatsapp: active_channels.append("whatsapp")

        session_data = {
            "identifier": identifier,
            "channels": active_channels,
            "otp_hash": otp_hash,
            "status": "pending",
            "attempts": 0,
            "max_attempts": OTP_MAX_ATTEMPTS,
            "verified": False,
            "locked": False,
            "cooldown_until": cooldown_until,
            "expires_at": expires_at,
            "created_at": now,
            "updated_at": now
        }

        # Save session
        doc_ref.set(session_data)

        # Dispatch notification
        NotificationService.dispatch(
            recipient_email=email,
            recipient_phone=phone,
            n_type="otp_message",
            context={"otp": otp},
            html_body=html_body,
            use_email=use_email,
            use_whatsapp=use_whatsapp
        )

        logger.info(f"OTP sent to {identifier} via WhatsApp & Email")
        return True, "OTP sent successfully."

    @staticmethod
    def verify_otp(identifier, entered_otp):
        """
        Atomic verification using Firestore transaction.
        """
        transaction = db.transaction()
        doc_ref = db.collection("otp_sessions").document(identifier)

        @firestore.transactional
        def _verify(transaction, doc_ref):
            snap = doc_ref.get(transaction=transaction)
            if not snap.exists:
                return False, "No active session found."

            data = snap.to_dict()
            now = datetime.now(timezone.utc)

            if data.get("locked"):
                return False, "Account locked due to too many failed attempts."
            
            if data.get("verified"):
                return False, "OTP already used."

            if now > data.get("expires_at"):
                return False, "OTP has expired."

            # Verify hash
            expected_hash = data.get("otp_hash")
            actual_hash = OTPService._hash_otp(entered_otp, identifier)

            if actual_hash == expected_hash:
                # SUCCESS
                transaction.update(doc_ref, {
                    "verified": True,
                    "status": "verified",
                    "updated_at": now
                })
                # In production, we might delete the session immediately
                # transaction.delete(doc_ref) 
                return True, "Verified"
            else:
                # FAILURE
                attempts = data.get("attempts", 0) + 1
                update_payload = {
                    "attempts": attempts,
                    "updated_at": now
                }
                
                if attempts >= data.get("max_attempts", 5):
                    update_payload["locked"] = True
                    transaction.update(doc_ref, update_payload)
                    return False, "Too many attempts. Verification locked."
                
                transaction.update(doc_ref, update_payload)
                remaining = data.get("max_attempts", 5) - attempts
                return False, f"Invalid OTP. {remaining} attempt(s) remaining."

        try:
            success, message = _verify(transaction, doc_ref)
            return success, message
        except Exception as e:
            logger.error(f"Transaction failed for {identifier}: {e}")
            return False, "Internal verification error."

    @staticmethod
    def cleanup_expired():
        """Batch deletes expired sessions."""
        now = datetime.now(timezone.utc)
        expired = db.collection("otp_sessions").where("expires_at", "<", now).stream()
        count = 0
        batch = db.batch()
        for doc in expired:
            batch.delete(doc.reference)
            count += 1
            if count >= 500: # Firestore batch limit
                batch.commit()
                batch = db.batch()
                count = 0
        batch.commit()
        logger.info(f"Cleaned up expired OTP sessions.")
