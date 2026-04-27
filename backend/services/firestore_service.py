from config.firebase_config import db
from datetime import datetime

# ➕ Add document
def add_document(collection, data):
    data["created_at"] = datetime.utcnow()
    doc_ref = db.collection(collection).add(data)
    return {"id": doc_ref[1].id, **data}


# 📄 Get all documents
def get_all(collection):
    docs = db.collection(collection).stream()
    return [{**doc.to_dict(), "id": doc.id} for doc in docs]


# ❌ Delete document
def delete_document(collection, doc_id):
    db.collection(collection).document(doc_id).delete()
    return {"message": "Deleted successfully"}


# ✏️ Update document
def update_document(collection, doc_id, data):
    db.collection(collection).document(doc_id).update(data)
    return {"message": "Updated successfully"}


# 📊 Simple analytics (basic version)
def get_analytics():
    def safe_count(collection):
        try:
            return db.collection(collection).count().get()[0][0].value
        except Exception:
            return len(get_all(collection))

    books = safe_count("books")
    ebooks = safe_count("ebooks")
    users = safe_count("users")
    orders = safe_count("orders")

    return {
        "total_books": books + ebooks,
        "total_ebooks": ebooks,
        "total_users": users,
        "total_orders": orders
    }
    
# 🔍 Query collection with filters
def query_collection(collection, category=None, type_filter=None, order_by="created_at", order_direction="DESC", limit=None):
    query = db.collection(collection)
    if category:
        query = query.where("category", "==", category)
    if type_filter:
        query = query.where("type", "==", type_filter)
    if order_by:
        direction = "DESCENDING" if order_direction == "DESC" else "ASCENDING"
        query = query.order_by(order_by, direction=direction)
    if limit:
        query = query.limit(limit)
    docs = query.stream()
    return [{**doc.to_dict(), "id": doc.id} for doc in docs]

# 📦 Get orders of a specific user
def get_user_orders(user_id):
    docs = db.collection("orders").where("user_id", "==", user_id).stream()
    orders = []
    for doc in docs:
        payload = {**(doc.to_dict() or {}), "id": doc.id}
        payload.setdefault("address", None)
        orders.append(payload)
    return orders


def _order_has_ebook(order, ebook_id):
    if not order or not ebook_id:
        return False

    target = str(ebook_id)

    direct = order.get("ebook_id") or order.get("ebookId")
    if direct is not None and str(direct) == target:
        return True

    items = order.get("items") or []
    if not isinstance(items, list):
        return False

    for item in items:
        if not isinstance(item, dict):
            continue

        purchased_ebook_id = (
            item.get("ebook_id")
            or item.get("ebookId")
            or item.get("id")
            or item.get("product_id")
        )
        if purchased_ebook_id is not None and str(purchased_ebook_id) == target:
            return True

    return False


def has_paid_ebook_purchase(user_id, ebook_id):
    if not user_id or not ebook_id:
        return False

    target = str(ebook_id)

    # Preferred: indexed lookup on dedicated fields (newer ebook orders store ebook_id).
    try:
        query = (
            db.collection("orders")
            .where("user_id", "==", user_id)
            .where("ebook_id", "==", target)
            .where("status", "==", "paid")
            .limit(1)
        )
        for _doc in query.stream():
            return True
    except Exception:
        # Firestore may require a composite index; fall back to a broader query.
        pass

    # Back-compat: some orders store payment_status instead of status.
    try:
        query = (
            db.collection("orders")
            .where("user_id", "==", user_id)
            .where("ebook_id", "==", target)
            .where("payment_status", "==", "paid")
            .limit(1)
        )
        for _doc in query.stream():
            return True
    except Exception:
        pass

    # Fallback: fetch paid orders for user and inspect items.
    had_query_error = False
    for status_field in ("status", "payment_status"):
        try:
            query = (
                db.collection("orders")
                .where("user_id", "==", user_id)
                .where(status_field, "==", "paid")
            )
            for doc in query.stream():
                order = doc.to_dict() or {}
                if _order_has_ebook(order, target):
                    return True
        except Exception:
            had_query_error = True

    if not had_query_error:
        return False

    # Last resort: use existing helper (may be slower depending on data size).
    orders = get_user_orders(user_id) or []
    for order in orders:
        status = (order.get("status") or order.get("payment_status") or "").lower()
        if status != "paid":
            continue
        if _order_has_ebook(order, target):
            return True
    return False


def get_document(collection, doc_id):
    doc = db.collection(collection).document(doc_id).get()
    if not doc.exists:
        return None
    return {**(doc.to_dict() or {}), "id": doc.id}


def set_document(collection, doc_id, data, *, merge=True):
    db.collection(collection).document(doc_id).set(data, merge=merge)
    return {"message": "Saved successfully", "id": doc_id}
