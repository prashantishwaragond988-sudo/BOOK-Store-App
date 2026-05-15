import os
from utils.logger import get_logger

logger = get_logger("env_validator")

REQUIRED_ENV_VARS = [
    "FIREBASE_CREDENTIALS",
    "FLASK_SECRET_KEY",
    "MAIL_USERNAME",
    "MAIL_PASSWORD",
    "WHATSAPP_NODE_SERVICE_URL",
    "INTERNAL_WHATSAPP_API_TOKEN"
]

def validate_env():
    """
    Validates that all required environment variables are present.
    Fails fast by exiting the process if any are missing.
    """
    missing = []
    for var in REQUIRED_ENV_VARS:
        if not os.getenv(var):
            missing.append(var)
    
    if missing:
        logger.error(f"CRITICAL: Missing required environment variables: {', '.join(missing)}")
        logger.error("Server startup aborted.")
        # Exit with error code to prevent broken deployment
        import sys
        sys.exit(1)
    
    logger.info("Environment variables validated successfully.")
