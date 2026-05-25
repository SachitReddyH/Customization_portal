import os
import cloudinary
import cloudinary.uploader
from fastapi import UploadFile

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

    result = cloudinary.uploader.upload(
        contents,
        folder=folder,
        public_id=public_id,
        resource_type=resource_type,
        overwrite=True,
    )
    return result['secure_url']
