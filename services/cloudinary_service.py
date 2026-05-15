import cloudinary
import cloudinary.uploader
import os
from dotenv import load_dotenv

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

def upload_image(file, folder="aurora_assets"):
    result = cloudinary.uploader.upload(file, folder=folder)
    return result["secure_url"]

def upload_pdf(file):
    result = cloudinary.uploader.upload(
        file,
        resource_type="auto",
        access_mode="public",
    )
    return result["secure_url"]
