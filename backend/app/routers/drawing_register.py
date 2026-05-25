from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response
from app.database import get_db
from app.core.deps import get_current_user, require_drawing_access
from app.core.cloudinary_upload import upload_to_cloudinary, fetch_cloudinary_pdf
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional
import os, asyncio

router = APIRouter(prefix="/drawing-register", tags=["drawing-register"])


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
    """List all villas with their drawing register status — 4 bulk queries total."""
    db = get_db()

    # Bulk fetch: villas, register docs, customers
    villas   = await db.villas.find().sort("villa_number", 1).to_list(length=None)
    reg_docs = await db.drawing_register.find().to_list(length=None)
    customers = await db.users.find(
        {"role": "customer", "villa_id": {"$ne": None}}
    ).to_list(length=None)

    reg_map      = {str(d["villa_id"]): d for d in reg_docs}
    # Map villa_id → customer
    customer_map = {str(c["villa_id"]): c for c in customers if c.get("villa_id")}

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
        uploaders = await db.users.find(
            {"_id": {"$in": list(uploader_ids)}}
        ).to_list(length=None)
        user_map = {str(u["_id"]): u.get("full_name", "") for u in uploaders}

    result = []
    for villa in villas:
        vid      = str(villa["_id"])
        reg      = reg_map.get(vid)
        std      = (reg.get("standard_plan") or {}) if reg else {}
        upd      = (reg.get("updated_plan")  or {}) if reg else {}
        std_by   = str(std.get("uploaded_by", ""))
        upd_by   = str(upd.get("uploaded_by", ""))
        customer = customer_map.get(vid)

        result.append({
            "villa_id":       vid,
            "villa_number":   villa.get("villa_number"),
            "villa_name":     villa.get("villa_name"),
            "villa_type":     villa.get("villa_type"),
            "customer_name":  customer.get("full_name") if customer else None,
            "customer_email": customer.get("email") if customer else None,
            "standard_plan":  _plan_doc(std or None, user_map.get(std_by)),
            "updated_plan":   _plan_doc(upd or None, user_map.get(upd_by)),
            "updated_at":     reg["updated_at"].isoformat() if reg and reg.get("updated_at") else None,
        })

    return result


@router.get("/my")
async def my_drawing_register(user=Depends(get_current_user)):
    """Return floor plans for the current user's villa plus viewed status."""
    db = get_db()
    floor_plan_viewed = bool(user.get("floor_plan_viewed", False))
    villa_id = user.get("villa_id")
    if not villa_id:
        return {"standard_plan": None, "updated_plan": None, "floor_plan_viewed": floor_plan_viewed}

    doc = await db.drawing_register.find_one({"villa_id": villa_id})
    if not doc:
        return {"standard_plan": None, "updated_plan": None, "floor_plan_viewed": floor_plan_viewed}

    std = doc.get("standard_plan") or {}
    upd = doc.get("updated_plan")  or {}
    space_customisation_skipped = bool(user.get("space_customisation_skipped", False))
    return {
        "standard_plan":             _plan_doc(std or None),
        "updated_plan":              _plan_doc(upd or None),
        "floor_plan_viewed":         floor_plan_viewed,
        "space_customisation_skipped": space_customisation_skipped,
    }


@router.get("/view-plan/{plan_type}")
async def view_floor_plan(plan_type: str, user=Depends(get_current_user)):
    """Proxy the PDF from Cloudinary so the browser receives correct Content-Type headers."""
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
    url = plan.get("url")
    if not url:
        raise HTTPException(status_code=404, detail="Plan not uploaded yet")

    try:
        loop = asyncio.get_running_loop()
        content = await loop.run_in_executor(None, fetch_cloudinary_pdf, url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch plan: {str(e)}")

    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=floor_plan.pdf"},
    )


@router.post("/skip-space-customisation")
async def skip_space_customisation(user=Depends(get_current_user)):
    """Customer chose to keep standard floor plan and skip Space Customisations."""
    db = get_db()
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"space_customisation_skipped": True, "space_customisation_skipped_at": datetime.now(timezone.utc)}},
    )
    return {"space_customisation_skipped": True}


@router.post("/mark-viewed")
async def mark_floor_plan_viewed(user=Depends(get_current_user)):
    """Record that the customer has viewed their floor plan."""
    db = get_db()
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"floor_plan_viewed": True, "floor_plan_viewed_at": datetime.now(timezone.utc)}},
    )
    return {"floor_plan_viewed": True}


@router.get("/{villa_id}/view-plan/{plan_type}")
async def admin_view_floor_plan(villa_id: str, plan_type: str, user=Depends(require_drawing_access)):
    """Admin/design proxy: fetch PDF from Cloudinary and return with correct headers."""
    if plan_type not in ("standard", "updated"):
        raise HTTPException(status_code=400, detail="plan_type must be 'standard' or 'updated'")

    db = get_db()
    doc = await db.drawing_register.find_one({"villa_id": ObjectId(villa_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="No floor plans found")

    plan = doc.get(f"{plan_type}_plan") or {}
    url = plan.get("url")
    if not url:
        raise HTTPException(status_code=404, detail="Plan not uploaded yet")

    try:
        loop = asyncio.get_running_loop()
        content = await loop.run_in_executor(None, fetch_cloudinary_pdf, url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch plan: {str(e)}")

    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=floor_plan.pdf"},
    )


@router.post("/{villa_id}/upload")
async def upload_floor_plan(
    villa_id: str,
    plan_type: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(require_drawing_access),
):
    if plan_type not in ("standard", "updated"):
        raise HTTPException(status_code=400, detail="plan_type must be 'standard' or 'updated'")

    db = get_db()
    villa = await db.villas.find_one({"_id": ObjectId(villa_id)})
    if not villa:
        raise HTTPException(status_code=404, detail="Villa not found")

    public_id = f"{villa_id}_{plan_type}"
    url = await upload_to_cloudinary(file, folder="drawing_register", public_id=public_id)
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
