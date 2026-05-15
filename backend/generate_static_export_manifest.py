import argparse
import json
import os
from datetime import datetime, timezone
from typing import Optional


def _list_doc_ids(db, collection_name: str, limit: Optional[int] = None) -> list[str]:
    query = db.collection(collection_name)
    if limit is not None:
        query = query.limit(limit)
    return [doc.id for doc in query.stream()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Next.js static export manifest for dynamic routes.")
    parser.add_argument(
        "--out",
        default=os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "frontend", ".static-export-manifest.json")),
        help="Output path for the manifest JSON (default: ../frontend/.static-export-manifest.json)",
    )
    parser.add_argument("--books-limit", type=int, default=None, help="Optional limit for books IDs.")
    parser.add_argument(
        "--include-orders",
        action="store_true",
        help="Include order IDs (disabled by default to avoid pre-rendering private routes).",
    )
    parser.add_argument("--orders-limit", type=int, default=50, help="Limit for order IDs when --include-orders is set.")

    args = parser.parse_args()

    try:
        from config.firebase_config import db  # noqa: WPS433 (runtime import)
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(f"Failed to initialize Firebase Admin / Firestore: {exc}") from exc

    book_ids = _list_doc_ids(db, "books", limit=args.books_limit)

    order_ids: list[str] = []
    if args.include_orders:
        order_ids = _list_doc_ids(db, "orders", limit=args.orders_limit)

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "bookIds": book_ids,
        "orderIds": order_ids,
    }

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Wrote {out_path} (books={len(book_ids)}, orders={len(order_ids)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
