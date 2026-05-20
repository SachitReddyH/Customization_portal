from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from app.database import get_db
from app.core.deps import get_current_user, require_drawing_access
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional
import os, shutil

router = APIRouter(prefix="/drawing-register", tags=["drawing-register"])

ALLOWED_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.pdf'}
STATIC_ROOT  = os.path.join(os.path.dirname(__file__), '..', '..', 'static')
PLAN_DIR     = os.path.join(STATIC_ROOT, 'drawing_register')


def _plan_doc(plan: Optional[dict], uploader_name: Optional[str] = None) -> Optional[dict]:
    if not plan:
        return None
    return {
        "url":              plan.get("url"),
        "uploaded_at":      plan.get("uploaded_at").isoformat() if plan.get("uploaded_at") else None,
        "uploaded_by_name": uploader_name,
    }


@router.get("/")
async def list_drawing_register(user=Depends(require_drawing_access)):
    """List all villas with their drawing register status — 2 bulk queries total."""
    db = get_db()

    # Single query: all villas
    villas = await db.villas.find().sort("villa_number", 1).to_list(length=None)

    # Single query: all existing register docs
    reg_docs = await db.drawing_register.find().to_list(length=None)
    reg_map = {str(d["villa_id"]): d for d in reg_docs}

    # Collect uploader IDs and fetch names in one query
    uploader_ids = set()
    for d in reg_docs:
        std = d.get("standard_plan") or {}
        upd = d.get("updated_plan") or {}
        if std.get("uploaded_by"):
            uploader_ids.add(std["uploaded_by"])
        if upd.get("uploaded_by"):
            uploader_ids.add(upd["uploaded_by"])

    user_map = {}
    if uploader_ids:
        users = await db.users.find(
            {"_id": {"$in": list(uploader_ids)}}
        ).to_list(length=None)
        user_map = {str(u["_id"]): u.get("full_name", "") for u in users}

    result = []
    for villa in villas:
        vid     = str(villa["_id"])
        reg     = reg_map.get(vid)
        std     = (reg.get("standard_plan") or {}) if reg else {}
        upd     = (reg.get("updated_plan")  or {}) if reg else {}

        std_by  = str(std.get("uploaded_by", ""))
        upd_by  = str(upd.get("uploaded_by", ""))

        result.append({
            "villa_id":      vid,
            "villa_number":  villa.get("villa_number"),
            "villa_name":    villa.get("villa_name"),
            "villa_type":    villa.get("villa_type"),
            "standard_plan": _plan_doc(std or None, user_map.get(std_by)),
            "updated_plan":  _plan_doc(upd or None, user_map.get(upd_by)),
            "updated_at":    reg["updated_at"].isoformat() if reg and reg.get("updated_at") else None,
        })

    return result


@router.get("/my")
async def my_drawing_register(user=Depends(get_current_user)):
    """Return floor plans for the current user's villa."""
    db = get_db()
    villa_id = user.get("villa_id")
    if not villa_id:
        return {"standard_plan": None, "updated_plan": None}

    doc = await db.drawing_register.find_one({"villa_id": villa_id})
    if not doc:
        return {"standard_plan": None, "updated_plan": None}

    std = doc.get("standard_plan") or {}
    upd = doc.get("updated_plan")  or {}
    return {
        "standard_plan": _plan_doc(std or None),
        "updated_plan":  _plan_doc(upd or None),
    }


@router.post("/{villa_id}/upload")
async def upload_floor_plan(
    villa_id: str,
    plan_type: str = Form(...),
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
    filename = f"{villa_id}_{plan_type}{ext}"
    dest     = os.path.join(PLAN_DIR, filename)
    with open(dest, 'wb') as f:
        shutil.copyfileobj(file.file, f)

    url        = f"/static/drawing_register/{filename}"
    now        = datetime.now(timezone.utc)
    plan_field = "standard_plan" if plan_type == "standard" else "updated_plan"
    plan_data  = {"url": url, "uploaded_at": now, "uploaded_by": user["_id"]}

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

    # Return updated entry for this villa only
    doc    = await db.drawing_register.find_one({"villa_id": villa["_id"]})
    std    = (doc.get("standard_plan") or {}) if doc else {}
    upd    = (doc.get("updated_plan")  or {}) if doc else {}

    uploader_name = None
    by_id = (std if plan_type == "standard" else upd).get("uploaded_by")
    if by_id:
        u = await db.users.find_one({"_id": by_id})
        uploader_name = u.get("full_name") if u else None

    return {
        "villa_id":      str(villa["_id"]),
        "villa_number":  villa.get("villa_number"),
        "villa_name":    villa.get("villa_name"),
        "villa_type":    villa.get("villa_type"),
        "standard_plan": _plan_doc(std or None, uploader_name if plan_type == "standard" else None),
        "updated_plan":  _plan_doc(upd or None, uploader_name if plan_type == "updated" else None),
        "updated_at":    now.isoformat(),
    }
