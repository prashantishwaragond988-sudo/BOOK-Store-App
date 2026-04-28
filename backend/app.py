import os
import sys
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Fix import path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from config.app_config import Config
from extensions import mail

# Import routes
from routes.products import products_bp
from routes.admin import admin_bp
from routes.orders import orders_bp
from routes.webhook import webhook_bp
from routes.user import user_bp
from routes.otp_auth import otp_auth_bp
from routes.contact import contact_bp


def create_app():
    # 👇 IMPORTANT: add build folder here
    # Disable Flask's built-in static route at `/<path:filename>` because it conflicts with
    # SPA catch-all patterns. We serve the exported frontend manually from `build/`.
    app = Flask(__name__, static_folder=None)
    build_dir = os.path.join(CURRENT_DIR, "build")
    # Be forgiving about trailing slashes so API calls like `/products/books/` don't fall through to the SPA.
    app.url_map.strict_slashes = False

    load_dotenv()
    app.config.from_object(Config)

    # CORS (can keep or remove later)
    cors_origins = app.config.get("CORS_ORIGINS", "*")
    CORS(app, resources={r"/*": {"origins": cors_origins}})

    # Mail
    mail.init_app(app)

    app.config["OTP_EMAIL_LOGO_URL"] = os.getenv("OTP_EMAIL_LOGO_URL")

    # 🔗 Register API routes
    app.register_blueprint(products_bp, url_prefix="/products")
    app.register_blueprint(admin_bp, url_prefix="/admin")
    app.register_blueprint(orders_bp, url_prefix="/orders")
    app.register_blueprint(webhook_bp)
    app.register_blueprint(user_bp, url_prefix="/api/user")
    app.register_blueprint(otp_auth_bp)
    app.register_blueprint(contact_bp)

    api_prefixes = (
        "/products",
        "/orders",
        "/admin",
        "/webhook",
        "/api",
        "/send-otp",
        "/resend-otp",
        "/verify-otp",
        "/register",
        "/contact",
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
