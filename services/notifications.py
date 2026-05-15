from services.whatsapp import send_whatsapp_message

def send_notification(user_id: str, email: str, phone: str, event_type: str, context: dict):
    """
    Central dispatcher for all notifications (Email, WhatsApp, Push).
    Route messages to the correct service based on event_type.
    """
    # 1. Dispatch WhatsApp Messages
    whatsapp_template = None
    
    if event_type == "order_assigned":
        whatsapp_template = "delivery_assigned"
    elif event_type == "out_for_delivery":
        whatsapp_template = "out_for_delivery"
    elif event_type == "delivered":
        whatsapp_template = "delivered"
    elif event_type == "failed_delivery":
        whatsapp_template = "failed_attempt"
    elif event_type == "dboy_new_assignment":
        whatsapp_template = "dboy_new_assignment"

    if whatsapp_template and phone:
        send_whatsapp_message(phone, whatsapp_template, context)

    # 2. Future: Dispatch Emails
    # if email:
    #     send_email(email, event_type, context)
        
    # 3. Future: Dispatch Push Notifications
    # send_push_notification(user_id, event_type, context)
