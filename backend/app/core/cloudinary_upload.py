import os
import asyncio
import cloudinary
import cloudinary.uploader
from fastapi import UploadFile, HTTPException
import logging

logger = logging.getLogger(__name__)

cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True,
)

ALLOWED_IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}


async def upload_image_to_cloudinary(file: UploadFile, folder: str, public_id: str) -> str:
    """Upload an IMAGE to Cloudinary and return the secure URL. PDFs are NOT handled here."""
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ALLOWED_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail=f"File type {ext} not allowed. Only images accepted.")

    contents = await file.read()

    def _do_upload():
        return cloudinary.uploader.upload(
            contents,
            folder=folder,
            public_id=f"{public_id}{ext}",
            resource_type='image',
            overwrite=True,
        )

    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, _do_upload)
        return result['secure_url']
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
