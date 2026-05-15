import logging
import os
import sys
from flask import request, has_request_context

# Configure logging format
class SafeFormatter(logging.Formatter):
    def format(self, record):
        if not hasattr(record, "request_id"):
            record.request_id = "system"
        return super().format(record)

log_format = "%(asctime)s - %(name)s - %(levelname)s - [%(request_id)s] - %(message)s"
formatter = SafeFormatter(log_format)

stdout_handler = logging.StreamHandler(sys.stdout)
stdout_handler.setFormatter(formatter)

file_handler = logging.FileHandler("server.log", mode="a")
file_handler.setFormatter(formatter)

root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
# Clear existing handlers to avoid duplicates
root_logger.handlers = [stdout_handler, file_handler]

class RequestIdFilter(logging.Filter):
    def filter(self, record):
        if has_request_context():
            # Try to get request ID from headers or generate one
            request_id = request.headers.get("X-Request-ID") or getattr(request, "request_id", "no-id")
            record.request_id = request_id
        else:
            record.request_id = "system"
        return True

def get_logger(name):
    """Returns a logger instance for the given module name."""
    logger = logging.getLogger(name)
    
    # Add filter if not already present
    if not any(isinstance(f, RequestIdFilter) for f in logger.filters):
        logger.addFilter(RequestIdFilter())
        
    # Set level from environment if needed
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    logger.setLevel(getattr(logging, log_level, logging.INFO))
    return logger
