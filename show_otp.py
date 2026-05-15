"""
Fetch current OTP for locked delivery orders (dev only).
Run: python show_otp.py
"""
import sys, os
if os.getenv("ENVIRONMENT") != "development":
    print("CRITICAL: This script is blocked in non-development environments.")
    sys.exit(1)

sys.path.insert(0, os.path.dirname(__file__))
from config.firebase_config import db

ORDER_IDS = ["2VGxyp4HxRKPNbVvmO23", "MMrXw3oTlKT6GkP5nTgU"]

for order_id in ORDER_IDS:
    ref = db.collection("deliveryAssignments").document(order_id)
    doc = ref.get()
    if not doc.exists:
        print(f"[{order_id}] NOT FOUND")
        continue
    data = doc.to_dict()
    print(f"\n=== Order: {order_id} ===")
    print(f"  Status       : {data.get('status')}")
    print(f"  OTP attempts : {data.get('otp_attempts', 0)}")
    print(f"  OTP (raw)    : {data.get('raw_otp_dev_only', 'NOT STORED')}")
    print(f"  OTP expires  : {data.get('otp_expires_at')}")
    print(f"  Customer     : {data.get('customerEmail')}")
    
    # Also reset attempts for both
    ref.update({"otp_attempts": 0})
    print(f"  >> Attempts reset to 0")
