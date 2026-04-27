import os
import sys
from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

from config.app_config import Config
from extensions import mail

# Fix import path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CURRENT_DIR)

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
    app = Flask(__name__, static_folder="build", static_url_path="/")

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

    # 🌐 Serve React frontend
    @app.route("/")
    def serve():
        return send_from_directory(app.static_folder, "index.html")

    @app.route("/<path:path>")
    def static_files(path):
        file_path = os.path.join(app.static_folder, path)

        if os.path.exists(file_path):
            # If a directory is requested (e.g. /books or /books/), serve its index.html.
            if os.path.isdir(file_path):
                index_path = os.path.join(file_path, "index.html")
                if os.path.exists(index_path):
                    rel_index = os.path.join(path.rstrip("/\\"), "index.html")
                    return send_from_directory(app.static_folder, rel_index)

            return send_from_directory(app.static_folder, path)

        # Frontend routing fallback
        return send_from_directory(app.static_folder, "index.html")

    return app


# 👇 This is REQUIRED for Render
app = create_app()
