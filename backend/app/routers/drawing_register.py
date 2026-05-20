from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from app.database import get_db
from app.core.deps import get_current_user, require_drawing_access
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional
import os, shutil, uuid

router = APIRouter(prefix="/drawing-register", tags=["drawing-register"])

ALLOWED_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.pdf'}
STATIC_ROOT  = os.path.join(os.path.dirname(__file__), '..', '..', 'static')
PLAN_DIR     = os.path.join(STATIC_ROOT, 'drawing_register')


def _plan_doc(plan: Optional[dict], uploader_name: Optional[str] = None) -> Optional[dict]:
    if not plan:
        return None
    return {
        "url":            plan.get("url"),
        "uploaded_at":    plan.get("uploaded_at").isoformat() if plan.get("uploaded_at") else None,
        "uploaded_by_name": uploader_name or plan.get("uploaded_by_name"),
    }


async def _enrich_register(db, doc: dict) -> dict:
    """Add villa info and uploader names to a register document."""
    villa = None
    if doc.get("villa_id"):
        try:
            villa = await db.villas.find_one({"_id": ObjectId(str(doc["villa_id"]))})
        except Exception:
            pass

    async def uploader_name(user_id):
        if not user_id:
            return None
        try:
            u = await db.users.find_one({"_id": ObjectId(str(user_id))})
            return u.get("full_name") if u else None
        except Exception:
            return None

    std = doc.get("standard_plan") or {}
    upd = doc.get("updated_plan") or {}

    return {
        "id":           str(doc["_id"]),
        "villa_id":     str(doc["villa_id"]) if doc.get("villa_id") else None,
        "villa_number": villa.get("villa_number") if villa else None,
        "villa_name":   villa.get("villa_name") if villa else None,
        "villa_type":   villa.get("villa_type") if villa else None,
        "standard_plan": _plan_doc(std or None, await uploader_name(std.get("uploaded_by"))),
        "updated_plan":  _plan_doc(upd or None, await uploader_name(upd.get("uploaded_by"))),
        "updated_at":   doc.get("updated_at").isoformat() if doc.get("updated_at") else None,
    }


@router.get("/")
async def list_drawing_register(user=Depends(require_drawing_access)):
    """List all villas with their drawing register status."""
    db = get_db()
    villas = await db.villas.find().sort("villa_number", 1).to_list(length=None)
    result = []
    for villa in villas:
        villa_id = villa["_id"]
        doc = await db.drawing_register.find_one({"villa_id": villa_id})
        if not doc:
            doc = {
                "_id": ObjectId(),
                "villa_id": villa_id,
                "standard_plan": None,
                "updated_plan":  None,
                "updated_at":    None,
            }
        enriched = await _enrich_register(db, doc)
        result.append(enriched)
    return result


@router.get("/my")
async def my_drawing_register(user=Depends(get_current_user)):
    """Return floor plans for the current user's villa (any authenticated user)."""
    db = get_db()
    villa_id = user.get("villa_id")
    if not villa_id:
        return {"standard_plan": None, "updated_plan": None}

    doc = await db.drawing_register.find_one({"villa_id": villa_id})
    if not doc:
        return {"standard_plan": None, "updated_plan": None}

    std = doc.get("standard_plan") or {}
    upd = doc.get("updated_plan") or {}
    return {
        "standard_plan": _plan_doc(std or None),
        "updated_plan":  _plan_doc(upd or None),
    }


@router.post("/{villa_id}/upload")
async def upload_floor_plan(
    villa_id: str,
    plan_type: str = Form(...),   # "standard" | "updated"
    file: UploadFile = File(...),
    user=Depends(require_drawing_access),
):
    if plan_type not in ("standard", "updated"):
        raise HTTPException(status_code=400, detail="plan_type must be 'standard' or 'updated'")

    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail="Only jpg, jpeg, png, webp, pdf allowed")

    db = get_db()
    villa = await db.villas.find_one({"_id": ObjectId(villa_id)})
    if not villa:
        raise HTTPException(status_code=404, detail="Villa not found")

    os.makedirs(PLAN_DIR, exist_ok=True)
    filename  = f"{villa_id}_{plan_type}{ext}"
    dest      = os.path.join(PLAN_DIR, filename)
    with open(dest, 'wb') as f:
        shutil.copyfileobj(file.file, f)

    url  = f"/static/drawing_register/{filename}"
    now  = datetime.now(timezone.utc)
    plan_field = "standard_plan" if plan_type == "standard" else "updated_plan"

    plan_data = {
        "url":         url,
        "uploaded_at": now,
        "uploaded_by": user["_id"],
    }

    existing = await db.drawing_register.find_one({"villa_id": villa["_id"]})
    if existing:
        await db.drawing_register.update_one(
            {"villa_id": villa["_id"]},
            {"$set": {plan_field: plan_data, "updated_at": now}},
        )
    else:
        await db.drawing_register.insert_one({
            "villa_id":      villa["_id"],
            "standard_plan": plan_data if plan_type == "standard" else None,
            "updated_plan":  plan_data if plan_type == "updated" else None,
            "updated_at":    now,
        })

    doc = await db.drawing_register.find_one({"villa_id": villa["_id"]})
    return await _enrich_register(db, doc)
