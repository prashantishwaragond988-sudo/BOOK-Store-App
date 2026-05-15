from flask_mail import Message
from flask import render_template, current_app
from extensions import mail
from utils.logger import get_logger

logger = get_logger("email_service")

class EmailService:
    @staticmethod
    def send_email(recipient: str, subject: str, body_html: str) -> bool:
        """
        Sends an email using Flask-Mail.
        """
        if not recipient:
            logger.error("No recipient provided for email.")
            return False

        try:
            msg = Message(
                subject=subject,
                recipients=[recipient],
                html=body_html
            )
            mail.send(msg)
            logger.info(f"Successfully sent email to {recipient}")
            return True
        except Exception as e:
            logger.error(f"Email service failed for {recipient}: {e}")
            return False

    @staticmethod
    def send_template_email(recipient: str, subject: str, template_name: str, **context) -> bool:
        """
        Sends a templated email.
        """
        try:
            # Note: Assuming templates are in 'templates/' directory
            html = render_template(template_name, **context)
            return EmailService.send_email(recipient, subject, html)
        except Exception as e:
            logger.error(f"Failed to render/send template email to {recipient}: {e}")
            return False
