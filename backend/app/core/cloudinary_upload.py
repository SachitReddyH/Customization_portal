import os
import cloudinary
import cloudinary.uploader
from fastapi import UploadFile
import logging

logger = logging.getLogger(__name__)

cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True,
)

ALLOWED_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.pdf', '.gif'}


async def upload_to_cloudinary(file: UploadFile, folder: str, public_id: str) -> str:
    """Upload a file to Cloudinary and return the secure URL."""
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ALLOWED_EXTS:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"File type {ext} not allowed")

    contents = await file.read()

    # PDFs must use resource_type='raw'; images use 'image'
    resource_type = 'raw' if ext == '.pdf' else 'image'

    # Include extension in public_id so Cloudinary preserves it in the URL
    # e.g. "villa_42_standard.pdf" → .../drawing_register/villa_42_standard.pdf
    public_id_with_ext = f"{public_id}{ext}"

    try:
        result = cloudinary.uploader.upload(
            contents,
            folder=folder,
            public_id=public_id_with_ext,
            resource_type=resource_type,
            overwrite=True,
        )
        return result['secure_url']
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
