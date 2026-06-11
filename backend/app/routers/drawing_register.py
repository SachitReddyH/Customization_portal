from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response
from app.database import get_db
from app.core.deps import get_current_user, require_read_access
from bson import ObjectId, Binary
from datetime import datetime, timezone
from typing import Optional
import os

router = APIRouter(prefix="/drawing-register", tags=["drawing-register"])

ALLOWED_EXTS  = {'.jpg', '.jpeg', '.png', '.webp', '.pdf'}
VALID_PLAN_TYPES = {"standard", "updated", "signed_off"}


def _plan_doc(plan: Optional[dict], uploader_name: Optional[str] = None) -> Optional[dict]:
    if not plan:
        return None
    return {
        "url":              plan.get("url", "db"),
        "is_pdf":           plan.get("is_pdf", False),
        "uploaded_at":      plan.get("uploaded_at").isoformat() if plan.get("uploaded_at") else None,
        "uploaded_by_name": uploader_name,
    }


# ── List all villas ────────────────────────────────────────────────────────────

@router.get("/")
async def list_drawing_register(user=Depends(require_read_access)):
    """List all villas with their drawing register status."""
    db = get_db()

    villas    = await db.villas.find().sort("villa_number", 1).to_list(length=None)
    reg_docs  = await db.drawing_register.find(
        {}, {"standard_plan.data": 0, "updated_plan.data": 0, "signed_off_plan.data": 0}
    ).to_list(length=None)
    customers = await db.users.find(
        {"role": "customer", "villa_id": {"$ne": None}}
    ).to_list(length=None)

    reg_map      = {str(d["villa_id"]): d for d in reg_docs}
    customer_map = {str(c["villa_id"]): c for c in customers if c.get("villa_id")}

    uploader_ids = set()
    for d in reg_docs:
        for key in ("standard_plan", "updated_plan", "signed_off_plan"):
            p = d.get(key) or {}
            if p.get("uploaded_by"):
                uploader_ids.add(p["uploaded_by"])

    user_map = {}
    if uploader_ids:
        uploaders = await db.users.find({"_id": {"$in": list(uploader_ids)}}).to_list(length=None)
        user_map = {str(u["_id"]): u.get("full_name", "") for u in uploaders}

    result = []
    for villa in villas:
        vid      = str(villa["_id"])
        reg      = reg_map.get(vid)
        std      = (reg.get("standard_plan")   or {}) if reg else {}
        upd      = (reg.get("updated_plan")    or {}) if reg else {}
        sgn      = (reg.get("signed_off_plan") or {}) if reg else {}
        customer = customer_map.get(vid)

        result.append({
            "villa_id":        vid,
            "villa_number":    villa.get("villa_number"),
            "villa_name":      villa.get("villa_name"),
            "villa_type":      villa.get("villa_type"),
            "customer_name":   customer.get("full_name") if customer else None,
            "customer_email":  customer.get("email") if customer else None,
            "standard_plan":   _plan_doc(std or None, user_map.get(str(std.get("uploaded_by", "")))),
            "updated_plan":    _plan_doc(upd or None, user_map.get(str(upd.get("uploaded_by", "")))),
            "signed_off_plan": _plan_doc(sgn or None, user_map.get(str(sgn.get("uploaded_by", "")))),
            "updated_at":      reg["updated_at"].isoformat() if reg and reg.get("updated_at") else None,
        })

    return result


# ── Customer: get own floor plan info ─────────────────────────────────────────

@router.get("/my")
async def my_drawing_register(user=Depends(get_current_user)):
    db = get_db()
    floor_plan_viewed           = bool(user.get("floor_plan_viewed", False))
    space_customisation_skipped = bool(user.get("space_customisation_skipped", False))
    villa_id = user.get("villa_id")

    if not villa_id:
        return {"standard_plan": None, "updated_plan": None,
                "floor_plan_viewed": floor_plan_viewed,
                "space_customisation_skipped": space_customisation_skipped}

    doc = await db.drawing_register.find_one(
        {"villa_id": villa_id},
        {"standard_plan.data": 0, "updated_plan.data": 0, "signed_off_plan.data": 0}
    )
    if not doc:
        return {"standard_plan": None, "updated_plan": None,
                "floor_plan_viewed": floor_plan_viewed,
                "space_customisation_skipped": space_customisation_skipped}

    std = doc.get("standard_plan") or {}
    upd = doc.get("updated_plan")  or {}
    return {
        "standard_plan":               _plan_doc(std or None),
        "updated_plan":                _plan_doc(upd or None),
        "floor_plan_viewed":           floor_plan_viewed,
        "space_customisation_skipped": space_customisation_skipped,
    }


# ── Customer: view own floor plan PDF ─────────────────────────────────────────

@router.get("/view-plan/{plan_type}")
async def view_floor_plan(plan_type: str, user=Depends(get_current_user)):
    if plan_type not in ("standard", "updated"):
        raise HTTPException(status_code=400, detail="plan_type must be 'standard' or 'updated'")

    db = get_db()
    villa_id = user.get("villa_id")
    if not villa_id:
        raise HTTPException(status_code=404, detail="No villa assigned")

    doc = await db.drawing_register.find_one({"villa_id": villa_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No floor plans found")

    plan = doc.get(f"{plan_type}_plan") or {}
    data = plan.get("data")
    if not data:
        raise HTTPException(status_code=404, detail="Plan not uploaded yet")

    return Response(
        content=bytes(data),
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=floor_plan.pdf"},
    )


# ── Admin/staff: view any villa's floor plan PDF ───────────────────────────────

@router.get("/{villa_id}/view-plan/{plan_type}")
async def admin_view_floor_plan(villa_id: str, plan_type: str, user=Depends(require_read_access)):
    if plan_type not in VALID_PLAN_TYPES:
        raise HTTPException(status_code=400, detail="Invalid plan_type")

    db = get_db()
    doc = await db.drawing_register.find_one({"villa_id": ObjectId(villa_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="No floor plans found")

    plan = doc.get(f"{plan_type}_plan") or {}
    data = plan.get("data")
    if not data:
        raise HTTPException(status_code=404, detail="Plan not uploaded yet")

    return Response(
        content=bytes(data),
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=floor_plan.pdf"},
    )


# ── Skip space customisation ──────────────────────────────────────────────────

@router.post("/skip-space-customisation")
async def skip_space_customisation(user=Depends(get_current_user)):
    db = get_db()
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"space_customisation_skipped": True,
                  "space_customisation_skipped_at": datetime.now(timezone.utc)}},
    )
    return {"space_customisation_skipped": True}


# ── Mark floor plan viewed ────────────────────────────────────────────────────

@router.post("/mark-viewed")
async def mark_floor_plan_viewed(user=Depends(get_current_user)):
    db = get_db()
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"floor_plan_viewed": True,
                  "floor_plan_viewed_at": datetime.now(timezone.utc)}},
    )
    return {"floor_plan_viewed": True}


# ── Remove floor plan ─────────────────────────────────────────────────────────

@router.delete("/{villa_id}/plan/{plan_type}", status_code=200)
async def remove_floor_plan(villa_id: str, plan_type: str, user=Depends(get_current_user)):
    if plan_type not in VALID_PLAN_TYPES:
        raise HTTPException(status_code=400, detail="Invalid plan_type")

    role = user.get("role")
    # CRM admin can only manage signed_off
    if role == "crm_admin" and plan_type != "signed_off":
        raise HTTPException(status_code=403, detail="CRM admin can only manage signed-off floor plans")
    if role not in ("admin", "design_admin", "crm_admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    db = get_db()
    plan_field = f"{plan_type}_plan"
    result = await db.drawing_register.find_one_and_update(
        {"villa_id": ObjectId(villa_id)},
        {"$set": {plan_field: None, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="No drawing register entry found for this villa")

    return {"removed": True, "plan_type": plan_type}


# ── Upload floor plan ─────────────────────────────────────────────────────────

@router.post("/{villa_id}/upload")
async def upload_floor_plan(
    villa_id: str,
    plan_type: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    if plan_type not in VALID_PLAN_TYPES:
        raise HTTPException(status_code=400, detail="plan_type must be 'standard', 'updated', or 'signed_off'")

    role = user.get("role")
    # CRM admin can only upload signed_off plans
    if role == "crm_admin" and plan_type != "signed_off":
        raise HTTPException(status_code=403, detail="CRM admin can only upload signed-off floor plans")
    if role not in ("admin", "design_admin", "crm_admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail="Only jpg, jpeg, png, webp, pdf allowed")

    db = get_db()
    villa = await db.villas.find_one({"_id": ObjectId(villa_id)})
    if not villa:
        raise HTTPException(status_code=404, detail="Villa not found")

    contents = await file.read()
    is_pdf   = ext == ".pdf"
    now      = datetime.now(timezone.utc)

    plan_field = f"{plan_type}_plan"
    plan_data  = {
        "url":         "db",
        "is_pdf":      is_pdf,
        "data":        Binary(contents),
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
            "villa_id":        villa["_id"],
            "standard_plan":   plan_data if plan_type == "standard"   else None,
            "updated_plan":    plan_data if plan_type == "updated"    else None,
            "signed_off_plan": plan_data if plan_type == "signed_off" else None,
            "updated_at":      now,
        })

    doc = await db.drawing_register.find_one(
        {"villa_id": villa["_id"]},
        {"standard_plan.data": 0, "updated_plan.data": 0, "signed_off_plan.data": 0}
    )
    std = (doc.get("standard_plan")   or {}) if doc else {}
    upd = (doc.get("updated_plan")    or {}) if doc else {}
    sgn = (doc.get("signed_off_plan") or {}) if doc else {}

    uploader_name = user.get("full_name")

    return {
        "villa_id":        str(villa["_id"]),
        "villa_number":    villa.get("villa_number"),
        "villa_name":      villa.get("villa_name"),
        "villa_type":      villa.get("villa_type"),
        "standard_plan":   _plan_doc(std or None, uploader_name if plan_type == "standard"   else None),
        "updated_plan":    _plan_doc(upd or None, uploader_name if plan_type == "updated"    else None),
        "signed_off_plan": _plan_doc(sgn or None, uploader_name if plan_type == "signed_off" else None),
        "updated_at":      now.isoformat(),
    }
