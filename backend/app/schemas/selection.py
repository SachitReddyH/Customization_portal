from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime


class SelectionItem(BaseModel):
    category_id: str
    sub_section: Optional[str] = None       # "individual"|"package" or "sanitaryware"|"cp_fittings"
    option_id: str
    location_id: Optional[str] = None       # for room-specific options
    selection_type: Literal["standard", "upgrade"] = "standard"
    customer_notes: Optional[str] = None
    selected_at: Optional[datetime] = None


class SelectionUpsert(BaseModel):
    """Add or update a single selection item."""
    category_id: str
    sub_section: Optional[str] = None
    option_id: str
    location_id: Optional[str] = None
    selection_type: Literal["standard", "upgrade"] = "standard"
    customer_notes: Optional[str] = None


class SelectionRemove(BaseModel):
    """Remove a selection by option_id (+ location_id for room-specific)."""
    option_id: str
    location_id: Optional[str] = None


class CustomerSelectionsResponse(BaseModel):
    id: str
    customer_id: str
    villa_id: Optional[str] = None
    status: str
    selections: List[SelectionItem] = []
    total_estimated_price: Optional[float] = None
    admin_notes: Optional[str] = None
    submitted_at: Optional[datetime] = None
    last_updated: Optional[datetime] = None

    class Config:
        populate_by_name = True
