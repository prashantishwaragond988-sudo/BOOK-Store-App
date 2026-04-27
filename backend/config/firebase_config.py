import os
import json

import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# Resolve backend directory (this file is in backend/config/, so go up one level)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv()


def _load_firebase_credentials():
    """Load Firebase credentials with multiple fallback strategies for local and Render."""

    # 1️⃣ JSON string from environment (Render recommended)
    credentials_env = os.getenv("FIREBASE_CREDENTIALS", "").strip()
    if credentials_env:
        try:
            credentials_dict = json.loads(credentials_env)
            if isinstance(credentials_dict, dict):
                return credentials.Certificate(credentials_dict)
        except json.JSONDecodeError:
            # It's a file path, not raw JSON
            cred_path = credentials_env
            if not os.path.isabs(cred_path):
                cred_path = os.path.join(BASE_DIR, cred_path)
            if os.path.exists(cred_path):
                return credentials.Certificate(cred_path)

    # 2️⃣ Explicit key path from environment
    key_path_env = os.getenv("FIREBASE_KEY_PATH", "").strip()
    if key_path_env:
        cred_path = key_path_env
        if not os.path.isabs(cred_path):
            cred_path = os.path.join(BASE_DIR, cred_path)
        if os.path.exists(cred_path):
            return credentials.Certificate(cred_path)

    # 3️⃣ Default fallback: serviceAccountKey.json in backend directory
    default_path = os.path.join(BASE_DIR, "serviceAccountKey.json")
    if os.path.exists(default_path):
        return credentials.Certificate(default_path)

    raise RuntimeError(
        "Missing Firebase credentials. Set FIREBASE_CREDENTIALS to the service-account JSON or a valid path, "
        "set FIREBASE_KEY_PATH, or place serviceAccountKey.json in the backend directory."
    )


try:
    cred = _load_firebase_credentials()

    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)

    db = firestore.client()
except Exception as e:
    raise RuntimeError(f"🔥 Firebase initialization failed: {e}") from e

def init_firebase():
    cred_path = os.path.join(BASE_DIR, "serviceAccountKey.json")

    if not os.path.exists(cred_path):
        raise RuntimeError(f"Firebase credentials file not found at: {cred_path}")

    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)

    return firestore.client()

db = init_firebase()