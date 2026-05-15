import os
import sys
from flask import Flask, jsonify, request, send_from_directory, g
import uuid
from flask_cors import CORS
from dotenv import load_dotenv
from services.firestore_service import get_all
from config.firebase_config import db
from routes.auth import token_required, admin_required
from services.firestore_service import update_document, delete_document

# Fix import path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from config.app_config import Config
from extensions import mail, limiter
from utils.logger import get_logger
from utils.env_validator import validate_env

logger = get_logger("app")

# Import routes
from routes.products import products_bp
from routes.admin import admin_bp
from routes.orders import orders_bp
from routes.webhook import webhook_bp
from routes.delivery import delivery_bp
from routes.delivery_boys_admin import admin_delivery_boys_bp
from routes.deliveryboys_admin_list import admin_delivery_boys_list_bp



from routes.user import user_bp
from routes.otp_auth import otp_auth_bp
from routes.contact import contact_bp
from routes.wishlist import wishlist_bp


def create_app():
    # 👇 IMPORTANT: add build folder here
    # Disable Flask's built-in static route at `/<path:filename>` because it conflicts with
    # SPA catch-all patterns. We serve the exported frontend manually from `build/`.
    app = Flask(__name__, static_folder=None)
    build_dir = os.path.join(CURRENT_DIR, "build")
    # Be forgiving about trailing slashes so API calls like `/products/books/` don't fall through to the SPA.
    app.url_map.strict_slashes = False

    load_dotenv()
    validate_env()
    app.config.from_object(Config)

    CORS(app, resources={r"/*": {"origins": Config.CORS_ORIGINS}})

    # Request ID Middleware
    @app.before_request
    def add_request_id():
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.request_id = request_id
        g.request_id = request_id

    @app.after_request
    def append_request_id(response):
        response.headers["X-Request-ID"] = getattr(request, "request_id", "no-id")
        return response

    # Mail
    mail.init_app(app)

    # Limiter
    limiter.init_app(app)

    app.config["OTP_EMAIL_LOGO_URL"] = os.getenv("OTP_EMAIL_LOGO_URL")

    # 🔗 Register API routes
    app.register_blueprint(products_bp, url_prefix="/products")
    app.register_blueprint(admin_bp, url_prefix="/admin")
    app.register_blueprint(orders_bp, url_prefix="/orders")
    app.register_blueprint(delivery_bp, url_prefix="")
    app.register_blueprint(admin_delivery_boys_bp, url_prefix="")
    app.register_blueprint(admin_delivery_boys_list_bp, url_prefix="")

    app.register_blueprint(webhook_bp)


    from routes.notifications import notifications_bp
    from routes.feedback import feedback_bp
    
    app.register_blueprint(notifications_bp, url_prefix="/api")
    app.register_blueprint(feedback_bp, url_prefix="/api")

    app.register_blueprint(user_bp, url_prefix="/api/user")
    app.register_blueprint(otp_auth_bp)
    app.register_blueprint(contact_bp)
    app.register_blueprint(wishlist_bp, url_prefix="/wishlist")

    api_prefixes = (
        "/products",
        "/orders",
        "/admin",
        "/webhook",
        "/api",
        "/stats",
        "/delete-ebook",
        "/update-ebook",
        "/send-otp",
        "/resend-otp",
        "/verify-otp",
        "/register",
        "/contact",
        "/wishlist",
    )

    def _is_api_path(path: str) -> bool:
        return any(path == prefix or path.startswith(prefix + "/") for prefix in api_prefixes)

    def _wants_json() -> bool:
        best = request.accept_mimetypes.best
        if best != "application/json":
            return False
        return request.accept_mimetypes[best] >= request.accept_mimetypes["text/html"]

    @app.errorhandler(404)
    def _not_found(_err):
        if _is_api_path(request.path) or _wants_json():
            return jsonify({"error": "Not Found", "path": request.path}), 404
        return send_from_directory(build_dir, "index.html")

    @app.errorhandler(405)
    def _method_not_allowed(_err):
        if _is_api_path(request.path) or _wants_json():
            return jsonify({"error": "Method Not Allowed", "path": request.path}), 405
        return send_from_directory(build_dir, "index.html")

    # 🌐 Serve React frontend
    @app.route("/")
    def serve():
        return send_from_directory(build_dir, "index.html")

    @app.route("/books", methods=["GET"])
    def list_books():
        try:
            return jsonify(get_all("books", raise_on_error=True) or []), 200
        except (TimeoutError, RuntimeError) as e:
            logger.warning(f"Firestore timeout/unavailable in /books: {e}")
            return jsonify([]), 200
        except Exception as e:
            logger.error(f"Unexpected error in /books: {e}")
            return jsonify({"error": "Internal server error"}), 500

    @app.route("/ebooks", methods=["GET"])
    def list_ebooks():
        try:
            return jsonify(get_all("ebooks", raise_on_error=True) or []), 200
        except (TimeoutError, RuntimeError) as e:
            print("ERROR in /ebooks (firestore):", str(e))
            return jsonify([]), 200
        except Exception as e:
            print("ERROR in /ebooks:", str(e))
            return jsonify({"error": str(e)}), 500

    @app.route("/stats", methods=["GET"])
    def stats():
        def safe_count(collection_name: str) -> int:
            try:
                return db.collection(collection_name).count().get()[0][0].value
            except Exception:
                return len(get_all(collection_name) or [])

        try:
            books_count = safe_count("books")
            ebooks_count = safe_count("ebooks")
            return (
                jsonify(
                    {
                        "books": books_count,
                        "ebooks": ebooks_count,
                        "total": books_count + ebooks_count,
                    }
                ),
                200,
            )
        except (TimeoutError, RuntimeError) as e:
            print("ERROR in /stats (firestore):", str(e))
            return jsonify({"books": 0, "ebooks": 0, "total": 0}), 200
        except Exception as e:
            print("ERROR in /stats:", str(e))
            return jsonify({"error": str(e)}), 500

    @app.route("/delete-ebook/<doc_id>", methods=["DELETE", "OPTIONS"])
    @token_required
    @admin_required
    def delete_ebook_alias(current_user, doc_id):
        if request.method == "OPTIONS":
            return "", 200
        return jsonify(delete_document("ebooks", doc_id)), 200

    @app.route("/update-ebook/<doc_id>", methods=["PUT", "OPTIONS"])
    @token_required
    @admin_required
    def update_ebook_alias(current_user, doc_id):
        if request.method == "OPTIONS":
            return "", 200
        payload = request.get_json(silent=True) or {}
        update_document("ebooks", doc_id, payload)
        return jsonify({"message": "updated"}), 200

    @app.route("/<path:path>")
    def static_files(path):
        # Never serve SPA HTML for API-like paths (avoids returning `index.html` instead of JSON).
        if _is_api_path(request.path) or _wants_json():
            return jsonify({"error": "Not Found", "path": request.path}), 404

        file_path = os.path.join(build_dir, path)

        if os.path.exists(file_path):
            # If a directory is requested (e.g. /books or /books/), serve its index.html.
            if os.path.isdir(file_path):
                index_path = os.path.join(file_path, "index.html")
                if os.path.exists(index_path):
                    rel_index = os.path.join(path.rstrip("/\\"), "index.html")
                    return send_from_directory(build_dir, rel_index)

            return send_from_directory(build_dir, path)

        # Frontend routing fallback
        return send_from_directory(build_dir, "index.html")

    return app


# 👇 This is REQUIRED for Render
app = create_app()

if __name__ == "__main__":
    # Ensure debug is False in production-like environments
    app.run(debug=False)
