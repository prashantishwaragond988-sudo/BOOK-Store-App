import os
import requests
from utils.logger import get_logger

logger = get_logger("whatsapp_service")

WHATSAPP_NODE_SERVICE_URL = os.getenv("WHATSAPP_NODE_SERVICE_URL", "http://localhost:3001").strip()
INTERNAL_WHATSAPP_API_TOKEN = os.getenv("INTERNAL_WHATSAPP_API_TOKEN", "local_dev_secret_123").strip()

# Meta API Config
META_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
META_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN")
META_API_URL = f"https://graph.facebook.com/v17.0/{META_PHONE_NUMBER_ID}/messages" if META_PHONE_NUMBER_ID else None

class WhatsAppService:
    @staticmethod
    def send_message(phone: str, message: str, order_id: str = "system") -> bool:
        """
        Sends a WhatsApp message via the Node.js microservice.
        """
        clean_phone = ''.join(filter(str.isdigit, str(phone)))
        if not clean_phone:
            logger.error("Invalid phone number provided.")
            return False

        if not clean_phone.startswith("91"):
            clean_phone = "91" + clean_phone

        payload = {
            "phone": clean_phone,
            "message": message.strip(),
            "orderId": order_id
        }

        headers = {
            "x-api-secret-token": INTERNAL_WHATSAPP_API_TOKEN,
            "Content-Type": "application/json"
        }

        try:
            response = requests.post(
                f"{WHATSAPP_NODE_SERVICE_URL}/api/whatsapp/send-message",
                headers=headers,
                json=payload,
                timeout=10
            )
            response.raise_for_status()
            logger.info(f"Successfully queued WhatsApp for {clean_phone}")
            return True
        except Exception as e:
            logger.warning(f"Node WhatsApp service failed for {clean_phone}: {e}. Attempting Meta API...")
            return WhatsAppService.send_via_meta(clean_phone, message)

    @staticmethod
    def send_via_meta(phone: str, message: str) -> bool:
        """
        Sends a WhatsApp message via Meta Cloud API.
        Note: Requires pre-approved templates for production.
        This implementation uses the 'text' message type for simplicity.
        """
        if not META_ACCESS_TOKEN or not META_API_URL:
            logger.error("Meta WhatsApp API not configured.")
            return False

        headers = {
            "Authorization": f"Bearer {META_ACCESS_TOKEN}",
            "Content-Type": "application/json"
        }

        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "text",
            "text": {"body": message}
        }

        try:
            response = requests.post(META_API_URL, headers=headers, json=payload, timeout=10)
            response.raise_for_status()
            logger.info(f"Successfully sent Meta WhatsApp to {phone}")
            return True
        except Exception as e:
            logger.error(f"Meta WhatsApp API failed for {phone}: {e}")
            return False
