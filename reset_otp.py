"""
Quick script to reset OTP attempts for a locked delivery order.
Run: python reset_otp.py
"""
import sys
import os
if os.getenv("ENVIRONMENT") != "development":
    print("CRITICAL: This script is blocked in non-development environments.")
    sys.exit(1)

sys.path.insert(0, os.path.dirname(__file__))

from config.firebase_config import db

ORDER_ID = "2VGxyp4HxRKPNbVvmO23"  # The locked order

def reset_otp_lock(order_id):
    ref = db.collection("deliveryAssignments").document(order_id)
    doc = ref.get()
    if not doc.exists:
        print(f"ERROR: deliveryAssignment '{order_id}' not found.")
        return

    data = doc.to_dict()
    current_attempts = data.get("otp_attempts", 0)
    current_status = data.get("status", "unknown")

    print(f"Order ID      : {order_id}")
    print(f"Current status: {current_status}")
    print(f"OTP attempts  : {current_attempts}  ->  resetting to 0")

    ref.update({"otp_attempts": 0})
    print("✅ OTP attempts reset successfully. Delivery boy can try again.")

reset_otp_lock(ORDER_ID)
