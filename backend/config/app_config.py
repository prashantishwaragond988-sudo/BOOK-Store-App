import os
from dotenv import load_dotenv


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Load backend/.env first (if present), then fall back to process env.
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv()


class Config:
    # Flask
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "change-me")

    # CORS
    # Use "*" for local dev; in production set a specific origin(s).
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

    # SMTP (Gmail)
    MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
    MAIL_USE_TLS = os.getenv("MAIL_USE_TLS", "true").lower() == "true"
    MAIL_USE_SSL = os.getenv("MAIL_USE_SSL", "false").lower() == "true"
    MAIL_USERNAME = os.getenv("MAIL_USERNAME") or os.getenv("EMAIL_USER")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD") or os.getenv("EMAIL_PASS")
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER", MAIL_USERNAME)

    # OTP
    OTP_TTL_SECONDS = int(os.getenv("OTP_TTL_SECONDS", "300"))  # 5 minutes
    VERIFIED_TTL_SECONDS = int(os.getenv("VERIFIED_TTL_SECONDS", "600"))  # 10 minutes
    OTP_MAX_PER_DAY = int(os.getenv("OTP_MAX_PER_DAY", "3"))
    OTP_EMAIL_LOGO_URL = os.getenv("OTP_EMAIL_LOGO_URL", "")

    # Firebase
    # Prefer FIREBASE_CREDENTIALS; support existing FIREBASE_KEY_PATH for compatibility.
    FIREBASE_CREDENTIALS = os.getenv("FIREBASE_CREDENTIALS") or os.getenv("FIREBASE_KEY_PATH")
