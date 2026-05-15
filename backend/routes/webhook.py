from flask import Blueprint, request

from services.firestore_service import get_all, get_document, update_document

webhook_bp = Blueprint("webhook", __name__)


@webhook_bp.route("/webhook", methods=["POST"])
def cashfree_webhook():
    # TODO: Verify Cashfree webhook signature / secret before trusting payload.
    data = request.json
    print("Webhook received:", data)

    if not isinstance(data, dict):
        return {"status": "ok"}, 200

    if data.get("type") != "PAYMENT_SUCCESS_WEBHOOK":
        return {"status": "ok"}, 200

    order_id = (((data.get("data") or {}).get("order") or {}).get("order_id"))
    if not order_id:
        return {"status": "ok"}, 200

    print("Payment success for:", order_id)

    try:
        # Try doc-id lookup first (if you stored order_id as the Firestore doc id)
        direct = get_document("orders", order_id)
        if direct and direct.get("id"):
            update_document("orders", direct["id"], {"payment_status": "paid", "status": "paid"})
            return {"status": "ok"}, 200

        # Fallback: scan orders collection for a matching order_id field
        orders = get_all("orders") or []
        match = next(
            (
                o
                for o in orders
                if o.get("order_id") == order_id
                or o.get("orderId") == order_id
                or o.get("cashfree_order_id") == order_id
            ),
            None,
        )
        if match and match.get("id"):
            update_document("orders", match["id"], {"payment_status": "paid", "status": "paid"})
    except Exception as e:
        print("Webhook processing error:", str(e))

    return {"status": "ok"}, 200
