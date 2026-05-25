import os
import re
import time
import asyncio
import urllib.request
import cloudinary
import cloudinary.uploader
from cloudinary.utils import private_download_url
from fastapi import UploadFile, HTTPException
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
        raise HTTPException(status_code=400, detail=f"File type {ext} not allowed")

    contents = await file.read()

    # PDFs use 'raw', images use 'image'
    resource_type = 'raw' if ext == '.pdf' else 'image'

    # Include extension in public_id so Cloudinary URL preserves it
    public_id_with_ext = f"{public_id}{ext}"

    def _do_upload():
        return cloudinary.uploader.upload(
            contents,
            folder=folder,
            public_id=public_id_with_ext,
            resource_type=resource_type,
            overwrite=True,
        )

    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, _do_upload)
        return result['secure_url']
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


def fetch_cloudinary_pdf(stored_url: str) -> bytes:
    """
    Fetch a PDF stored in Cloudinary using an authenticated API download URL.
    This bypasses CDN delivery restrictions ('Blocked for delivery') entirely
    by going through Cloudinary's signed API endpoint instead of the public CDN.
    """
    # Parse resource_type and public_id from the stored CDN URL
    # URL format: https://res.cloudinary.com/{cloud}/raw/upload/v{ver}/{folder}/{file.pdf}
    match = re.search(
        r'res\.cloudinary\.com/[^/]+/(raw|image)/upload/(?:v\d+/)?(.+)$',
        stored_url
    )
    if not match:
        # Fallback: try fetching the URL directly
        req = urllib.request.Request(stored_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read()

    resource_type = match.group(1)
    full_path = match.group(2)  # e.g. "drawing_register/villa_42_standard.pdf"

    # Split into public_id and format (extension)
    if '.' in full_path.split('/')[-1]:
        public_id, fmt = full_path.rsplit('.', 1)
    else:
        public_id, fmt = full_path, 'pdf'

    # Generate a signed API download URL valid for 5 minutes
    # This uses api.cloudinary.com (not CDN) so delivery blocks don't apply
    download_url = private_download_url(
        public_id,
        fmt,
        resource_type=resource_type,
        expires_at=int(time.time()) + 300,
    )

    logger.info(f"Fetching PDF via Cloudinary API: {download_url[:80]}...")
    req = urllib.request.Request(download_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()
