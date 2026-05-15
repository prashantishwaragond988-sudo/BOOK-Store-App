from enum import Enum

class DeliveryStatus(Enum):
    ASSIGNED = "assigned"
    PICKED_UP = "picked_up"
    OUT_FOR_DELIVERY = "out_for_delivery"
    NEAR_CUSTOMER = "near_customer"
    DELIVERED = "delivered"
    FAILED = "failed"

    @classmethod
    def list(cls):
        return [c.value for c in cls]

class NotificationStatus(Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"

class NotificationChannel(Enum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"
