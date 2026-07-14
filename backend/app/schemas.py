from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import date, datetime

# ==============================================================================
# AUTH SCHEMAS
# ==============================================================================

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str # admin, chef, customer

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: str
    customer_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

# ==============================================================================
# MENU / INVENTORY SCHEMAS
# ==============================================================================

class ProductOut(BaseModel):
    product_id: int
    product_name: str
    category: str
    unit_price: float

    class Config:
        from_attributes = True

class InventoryOut(BaseModel):
    product_id: int
    product_name: str
    category: str
    stock_level: int
    reorder_point: int
    last_updated: datetime

    class Config:
        from_attributes = True

class InventoryUpdate(BaseModel):
    stock_level: int

# ==============================================================================
# ORDER SCHEMAS
# ==============================================================================

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int

class OrderCreate(BaseModel):
    store_id: int
    order_channel: str # Dine-In, Drive-Thru, Mobile App, Delivery, Kiosk
    items: List[OrderItemCreate]

class OrderItemOut(BaseModel):
    order_item_id: int
    product_id: int
    product_name: Optional[str] = None
    quantity: int
    unit_price: float
    line_total: float

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        data = super().from_orm(obj)
        if not data.product_name and hasattr(obj, "product_name"):
            data.product_name = obj.product_name
        return data

class OrderOut(BaseModel):
    order_id: int
    customer_id: int
    store_id: int
    order_date: date
    order_channel: str
    status: str
    total_amount: float
    created_at: Optional[datetime] = None
    items: List[OrderItemOut]

    class Config:
        from_attributes = True

# ==============================================================================
# ANALYTICS & CHAT SCHEMAS
# ==============================================================================

class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
