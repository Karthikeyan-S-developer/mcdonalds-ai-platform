from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import User, FactSales, Inventory, Product
from ..schemas import ChatMessage, ChatResponse
from ..auth import RoleChecker
from ..gemini_service import gemini_service
from ..ml_services import ml_platform

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])

@router.post("/message", response_model=ChatResponse)
def get_chatbot_message(msg: ChatMessage, current_user: User = Depends(RoleChecker(["admin"])), db: Session = Depends(get_db)):
    # Fetch current metrics to pass to Gemini
    total_rev = db.query(func.sum(FactSales.line_total)).scalar() or 0.0
    total_orders = db.query(func.count(func.distinct(FactSales.order_id))).scalar() or 0
    
    # Low stock list
    low_stock_results = db.query(Product.product_name, Inventory.stock_level)\
        .join(Product, Inventory.product_id == Product.product_id)\
        .filter(Inventory.stock_level <= Inventory.reorder_point).all()
    low_stock_items = [{"product_name": row[0], "stock_level": row[1]} for row in low_stock_results]

    # Predictions
    tomorrow_demand = ml_platform.predict_tomorrow_demand()
    segments = ml_platform.get_segment_distributions()

    stats = {
        "total_revenue": total_rev,
        "total_orders": total_orders,
        "low_stock_count": len(low_stock_items),
        "low_stock_items": low_stock_items,
        "tomorrow_demand": tomorrow_demand,
        "segments": segments
    }

    ai_reply = gemini_service.answer_admin_chat(msg.message, stats)
    return ChatResponse(response=ai_reply)
