import argparse
import getpass
import sys

from dotenv import load_dotenv
from firebase_admin import auth as firebase_auth
from firebase_admin import firestore

from config.firebase_config import db


def _parse_args():
    parser = argparse.ArgumentParser(
        description="Create or reset a Firebase user account for website login."
    )
    parser.add_argument("--email", required=True, help="User email address.")
    parser.add_argument("--password", help="User password. If omitted, you will be prompted.")
    parser.add_argument("--name", default="User", help="Display name for new users.")
    parser.add_argument(
        "--role",
        choices=("user", "admin", "deliveryBoy"),
        default="user",
        help="Firestore role to store for this user.",
    )
    return parser.parse_args()


def main():
    load_dotenv()
    args = _parse_args()

    email = args.email.strip().lower()
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

        collection = "deliveryBoys" if args.role == "deliveryBoy" else "users"
        db.collection(collection).document(user.uid).set(
            {
                "uid": user.uid,
                "email": email,
                "name": args.name or user.display_name or "User",
                "role": args.role,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )

        print(f"Firebase Auth user {action}: {email}")
        print(f"UID: {user.uid}")
        print(f'Firestore {collection}/{user.uid} role set to "{args.role}".')
        return 0
    except Exception as exc:
        print(f"ERROR: Failed to create/update user: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
