from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class QuoteRequestCreate(BaseModel):
    customer_notes: Optional[str] = None


class QuoteRequestResponse(BaseModel):
    id: str
    customer_id: str
    villa_id: Optional[str] = None
    customer_name: Optional[str] = None
    villa_name: Optional[str] = None
    status: str                             # pending | reviewed | quoted | accepted
    customer_notes: Optional[str] = None
    admin_notes: Optional[str] = None
    quoted_price: Optional[float] = None
    selection_snapshot: Optional[dict] = None
    requested_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None

    class Config:
        populate_by_name = True


class QuoteStatusUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None
    quoted_price: Optional[float] = None
