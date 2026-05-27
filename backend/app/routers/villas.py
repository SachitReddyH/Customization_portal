from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.core.deps import get_current_user, require_admin
from app.schemas.villa import VillaResponse, VillaUpdate
from bson import ObjectId
from typing import List

router = APIRouter(prefix="/villas", tags=["villas"])


def _fmt(villa: dict) -> dict:
    villa["id"] = str(villa["_id"])
    return villa


@router.get("/", response_model=List[VillaResponse])
async def list_villas(user=Depends(get_current_user)):
    db = get_db()
    if user["role"] in ("admin", "crm_admin", "design_admin", "guest_admin"):
        cursor = db.villas.find().sort("villa_number", 1)
        villas = await cursor.to_list(length=None)
    else:
        # Customer sees only their villa
        if not user.get("villa_id"):
            return []
        villa = await db.villas.find_one({"_id": ObjectId(user["villa_id"])})
        villas = [villa] if villa else []
    return [_fmt(v) for v in villas]


@router.get("/{villa_id}", response_model=VillaResponse)
async def get_villa(villa_id: str, user=Depends(get_current_user)):
    db = get_db()
    villa = await db.villas.find_one({"_id": ObjectId(villa_id)})
    if not villa:
        raise HTTPException(status_code=404, detail="Villa not found")

    # Customers can only view their own villa
    if user["role"] not in ("admin", "crm_admin", "design_admin", "guest_admin") and str(user.get("villa_id")) != villa_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return _fmt(villa)


@router.patch("/{villa_id}", response_model=VillaResponse)
async def update_villa(villa_id: str, payload: VillaUpdate, user=Depends(require_admin)):
    db = get_db()
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")

    result = await db.villas.find_one_and_update(
        {"_id": ObjectId(villa_id)},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Villa not found")
    return _fmt(result)
