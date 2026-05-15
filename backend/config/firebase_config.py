import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv()

cred_path = os.getenv("FIREBASE_CREDENTIALS") or os.getenv("FIREBASE_KEY_PATH")
if not cred_path:
    raise RuntimeError(
        "Missing Firebase credentials path. Set FIREBASE_CREDENTIALS (recommended) or FIREBASE_KEY_PATH."
    )

# Allow relative paths in env to work regardless of current working directory.
if cred_path and not os.path.isabs(cred_path):
    cred_path = os.path.join(BASE_DIR, cred_path)
cred = credentials.Certificate(cred_path)

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()
