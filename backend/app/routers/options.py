"""
Options browsing router.

Navigation rules:
- CAT002 (Flooring) and CAT003 (Bathroom) → room_based
    GET /options/{category_id}/floors                  → list floors
    GET /options/{category_id}/floors/{floor}/rooms    → list rooms in floor
    GET /options/{category_id}/rooms/{location_id}     → options for that room
    GET /options/{category_id}/packages                → flooring packages (CAT002 only)
- All other categories → direct
    GET /options/{category_id}                         → all options flat
"""
from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.core.deps import get_current_user
from app.schemas.option import OptionResponse
from typing import List, Optional

router = APIRouter(prefix="/options", tags=["options"])

ROOM_BASED_CATS = {"CAT002", "CAT003"}


def _fmt(opt: dict) -> dict:
    opt["id"] = str(opt["_id"])
    return opt


# ── Direct categories (CAT001, CAT004–CAT008) ──────────────────────────────

@router.get("/{category_id}", response_model=List[OptionResponse])
async def get_options_direct(
    category_id: str,
    sub_section: Optional[str] = None,
    user=Depends(get_current_user),
):
    """
    Returns all options for a category.
    For room_based categories (CAT002/CAT003), returns ALL options
    (useful for admin views). Frontend should use /floors endpoint for guided flow.
    Optional ?sub_section= filter for flooring (individual|package)
    and bathroom (sanitaryware|cp_fittings).
    """
    db = get_db()
    query: dict = {"category_id": category_id, "is_active": True}
    if sub_section:
        query["sub_section"] = sub_section
    cursor = db.customization_options.find(query).sort("sort_order", 1)
    opts = await cursor.to_list(length=None)
    return [_fmt(o) for o in opts]


# ── Room-based navigation (CAT002 Flooring, CAT003 Bathroom) ───────────────

@router.get("/{category_id}/floors")
async def get_floors(category_id: str, user=Depends(get_current_user)):
    """Returns distinct floors that have at least one upgradeable option."""
    if category_id not in ROOM_BASED_CATS:
        raise HTTPException(status_code=400, detail="This category does not use room-based navigation")

    db = get_db()
    sub = "individual" if category_id == "CAT002" else None
    query: dict = {"category_id": category_id, "is_active": True, "has_upgrade": True}
    if sub:
        query["sub_section"] = sub

    floors = await db.customization_options.distinct("floor", query)

    # Order by floor, exclude non-floor pseudo-values
    floor_order = {"Ground Floor": 1, "First Floor": 2, "Second Floor": 3}
    valid = [f for f in floors if f and f in floor_order]
    return {"floors": sorted(valid, key=lambda x: floor_order[x])}


@router.get("/{category_id}/floors/{floor}/rooms")
async def get_rooms_in_floor(
    category_id: str, floor: str, user=Depends(get_current_user)
):
    """Returns distinct rooms within a floor that have at least one upgradeable option."""
    if category_id not in ROOM_BASED_CATS:
        raise HTTPException(status_code=400, detail="This category does not use room-based navigation")

    db = get_db()
    sub = "individual" if category_id == "CAT002" else None
    # Only include rooms that have at least one upgradeable option
    query: dict = {"category_id": category_id, "floor": floor, "is_active": True, "has_upgrade": True}
    if sub:
        query["sub_section"] = sub

    cursor = db.customization_options.find(
        query,
        {"location_id": 1, "floor": 1, "space": 1, "room_code": 1}
    )
    opts = await cursor.to_list(length=None)

    # Deduplicate by location_id, preserving first-seen order
    seen: dict = {}
    for o in opts:
        loc = o.get("location_id")
        if loc and loc not in seen:
            seen[loc] = {
                "location_id": loc,
                "floor": o.get("floor"),
                "space": o.get("space"),
                "room_code": o.get("room_code"),
            }
    return {"rooms": list(seen.values())}


@router.get("/{category_id}/rooms/{location_id}", response_model=List[OptionResponse])
async def get_options_for_room(
    category_id: str,
    location_id: str,
    sub_section: Optional[str] = None,
    user=Depends(get_current_user),
):
    """Returns all options for a specific room in a category."""
    db = get_db()
    query: dict = {"category_id": category_id, "location_id": location_id, "is_active": True}
    if sub_section:
        query["sub_section"] = sub_section
    cursor = db.customization_options.find(query).sort("sort_order", 1)
    opts = await cursor.to_list(length=None)
    return [_fmt(o) for o in opts]


@router.get("/{category_id}/packages", response_model=List[OptionResponse])
async def get_flooring_packages(category_id: str, user=Depends(get_current_user)):
    """Returns flooring package options (CAT002 only)."""
    if category_id != "CAT002":
        raise HTTPException(status_code=400, detail="Packages only available for Flooring category")
    db = get_db()
    cursor = db.customization_options.find(
        {"category_id": "CAT002", "sub_section": "package", "is_active": True}
    ).sort("sort_order", 1)
    opts = await cursor.to_list(length=None)
    return [_fmt(o) for o in opts]
