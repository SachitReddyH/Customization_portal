from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class QuoteRequestCreate(BaseModel):
    customer_notes: Optional[str] = None


class ItemPrice(BaseModel):
    option_id: str
    location_id: Optional[str] = None
    price: float


class QuoteRequestResponse(BaseModel):
    id: str
    customer_id: str
    villa_id: Optional[str] = None
    customer_name: Optional[str] = None
    villa_name: Optional[str] = None
    status: str                             # pending | reviewed | quoted | accepted | rejected
    notification_type: Optional[str] = None # new | updated | None (None = seen by admin)
    customer_notes: Optional[str] = None

    quoted_price: Optional[float] = None
    item_prices: Optional[List[dict]] = None        # per-line-item prices set by admin
    customer_notification: Optional[str] = None     # 'quoted' | None  (customer-facing bell)
    selection_snapshot: Optional[List[dict]] = None
    requested_at: datetime
    updated_at: Optional[datetime] = None           # set when customer updates an existing request
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    accepted_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class QuoteStatusUpdate(BaseModel):
    status: str

    quoted_price: Optional[float] = None
    item_prices: Optional[List[ItemPrice]] = None  # per-line-item prices
