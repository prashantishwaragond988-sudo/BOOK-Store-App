import argparse
import getpass
import os
import sys

from dotenv import load_dotenv
from firebase_admin import auth as firebase_auth
from firebase_admin import firestore

from config.firebase_config import db


def _admin_emails():
    return [
        email.strip().lower()
        for email in os.getenv("ADMIN_EMAIL", "").split(",")
        if email.strip()
    ]


def _parse_args():
    parser = argparse.ArgumentParser(
        description="Create or repair a Firebase admin account for the web admin panel."
    )
    parser.add_argument("--email", help="Admin email. Defaults to first ADMIN_EMAIL in backend/.env.")
    parser.add_argument("--password", help="Admin password. If omitted, you will be prompted.")
    parser.add_argument("--name", default="Admin", help="Display name for newly created admin users.")
    return parser.parse_args()


def main():
    load_dotenv()
    args = _parse_args()

    email = (args.email or (_admin_emails()[0] if _admin_emails() else "")).strip().lower()
    if not email:
        print("ERROR: Provide --email or set ADMIN_EMAIL in backend/.env.")
        return 1

    password = args.password or getpass.getpass(f"Password for {email}: ")
    if len(password) < 6:
        print("ERROR: Firebase passwords must be at least 6 characters.")
        return 1

    try:
        try:
            user = firebase_auth.get_user_by_email(email)
            firebase_auth.update_user(
                user.uid,
                password=password,
                display_name=args.name or user.display_name,
                disabled=False,
            )
            action = "updated"
        except firebase_auth.UserNotFoundError:
            user = firebase_auth.create_user(
                email=email,
                password=password,
                display_name=args.name,
                disabled=False,
            )
            action = "created"

        db.collection("users").document(user.uid).set(
            {
                "uid": user.uid,
                "email": email,
                "name": args.name or user.display_name or "Admin",
                "role": "admin",
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )

        print(f"Admin {action}: {email}")
        print(f"UID: {user.uid}")
        print('Firestore users/{uid} role set to "admin".')
        return 0
    except Exception as exc:
        print(f"ERROR: Failed to create/update admin: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
