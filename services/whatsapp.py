import os
import requests

# These will point to our new local Node.js service
WHATSAPP_NODE_SERVICE_URL = os.getenv("WHATSAPP_NODE_SERVICE_URL", "http://localhost:3001").strip()
INTERNAL_WHATSAPP_API_TOKEN = os.getenv("INTERNAL_WHATSAPP_API_TOKEN", "local_dev_secret_123").strip()

WHATSAPP_TEMPLATES = {
    "delivery_assigned": """
📦 Your PSI Prime order has been assigned to a delivery partner.

Order ID: {order_id}
Delivery Partner: {delivery_boy_name}

Delivery OTP: {otp}

Please share this OTP only after receiving your package.
""",
    "order_packed": """
📦 Your PSI Book Store order #{order_id} has been packed and is getting ready to ship!
""",
    "order_shipped": """
🚚 Good news! Your PSI Prime order #{order_id} has been shipped.
""",
    "out_for_delivery": """
🚚 Your PSI Prime order is now Out for Delivery.

Delivery Executive: {delivery_boy_name}
Phone: {delivery_boy_phone}

Please keep your OTP ready.
""",
    "delivered": """
✅ Your order has been delivered successfully by PSI Prime.

Thank you for shopping with PSI Book Store!
""",
    "failed_attempt": """
⚠️ PSI Prime: We attempted to deliver your order today, but it was unsuccessful.

Reason: {reason}

We will try again or please contact support to reschedule.
""",
    "dboy_new_assignment": """
🚚 PSI Prime - New Delivery Assigned

Customer: {customer_name}
Order ID: {order_id}

Open dashboard to begin delivery.
"""
}

def send_whatsapp_message(phone: str, template_name: str, variables: dict) -> bool:
    """
    Sends a WhatsApp message by pushing it to our persistent Node.js Microservice queue.
    """
    # Clean phone number (remove +, spaces, dashes)
    clean_phone = ''.join(filter(str.isdigit, str(phone)))
    if not clean_phone:
        print("❌ [WhatsApp Error] Invalid phone number provided.")
        return False

    # Automatically prepend "91" if the number does not already start with "91"
    if not clean_phone.startswith("91"):
        clean_phone = "91" + clean_phone

    print(f"[WhatsApp] Routing to Node queue for: {clean_phone}")

    template = WHATSAPP_TEMPLATES.get(template_name)
    if not template:
        print(f"❌ [WhatsApp Error] Template '{template_name}' not found.")
        return False
        
    try:
        message = template.format(**variables)
    except KeyError as e:
        print(f"❌ [WhatsApp Error] Missing variable {e} for template '{template_name}'")
        return False

    payload = {
        "phone": clean_phone,
        "message": message.strip(),
        "orderId": variables.get("order_id", "system"),
        "type": template_name
    }

    headers = {
        "x-api-secret-token": INTERNAL_WHATSAPP_API_TOKEN,
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(f"{WHATSAPP_NODE_SERVICE_URL}/api/whatsapp/send-message", headers=headers, json=payload, timeout=10)
        response.raise_for_status()
        print(f"✅ [WhatsApp] Successfully queued message in Node.js for {clean_phone}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"❌ [WhatsApp API Error] Node service failed for {clean_phone}: {e}")
        return False
