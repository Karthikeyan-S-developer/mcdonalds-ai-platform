from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import datetime
from ..database import get_db, sync_new_order_to_dw, SessionLocal
from ..models import User, Order, OrderItem, Product, Inventory, Customer
from ..schemas import OrderCreate, OrderOut
from ..auth import get_current_user, RoleChecker
from ..ml_services import ml_platform

router = APIRouter(prefix="/api/orders", tags=["orders"])

# Background task for ML retraining
def retrain_ml_models_task():
    db = SessionLocal()
    try:
        ml_platform.retrain_all(db)
    finally:
        db.close()

@router.post("", response_model=OrderOut)
def create_order(order_in: OrderCreate, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "customer" or not current_user.customer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can place orders."
        )

    # 1. Verify products and check inventory
    total_amount = 0.0
    items_to_create = []

    # Get a new order_id
    max_order = db.query(func.max(Order.order_id)).scalar()
    new_order_id = (max_order or 0) + 1

    max_item_id = db.query(func.max(OrderItem.order_item_id)).scalar()
    current_item_id = (max_item_id or 0) + 1

    for item_in in order_in.items:
        product = db.query(Product).filter(Product.product_id == item_in.product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {item_in.product_id} not found."
            )
        
        # Decrement stock in Inventory
        inv = db.query(Inventory).filter(Inventory.product_id == item_in.product_id).first()
        if inv:
            inv.stock_level = max(0, inv.stock_level - item_in.quantity)
            inv.last_updated = datetime.datetime.utcnow()

        line_total = round(product.unit_price * item_in.quantity, 2)
        total_amount += line_total

        order_item = OrderItem(
            order_item_id=current_item_id,
            order_id=new_order_id,
            product_id=item_in.product_id,
            quantity=item_in.quantity,
            unit_price=product.unit_price,
            line_total=line_total
        )
        items_to_create.append(order_item)
        current_item_id += 1

    # 2. Save Order
    order = Order(
        order_id=new_order_id,
        customer_id=current_user.customer_id,
        store_id=order_in.store_id,
        order_date=datetime.date.today(),
        order_channel=order_in.order_channel,
        status="pending",
        total_amount=round(total_amount, 2)
    )
    db.add(order)
    
    for item in items_to_create:
        db.add(item)
    
    db.commit()
    db.refresh(order)

    # 3. Incremental ETL sync to FactSales
    try:
        sync_new_order_to_dw(db, order.order_id)
    except Exception as e:
        print(f"Error syncing new order to DW: {e}")

    # 4. Trigger ML Model retraining in background
    ml_platform.mark_retrain_requested()
    background_tasks.add_task(retrain_ml_models_task)

    return order

@router.get("", response_model=List[OrderOut])
def get_orders(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "customer":
        return db.query(Order).filter(Order.customer_id == current_user.customer_id).order_by(Order.order_id.desc()).all()
    elif current_user.role in ["chef", "admin"]:
        return db.query(Order).order_by(Order.order_id.desc()).limit(100).all()
    return []

@router.post("/{order_id}/confirm", response_model=OrderOut)
def customer_confirm_delivery(order_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Customer confirms they received their order — marks it as 'closed'."""
    if current_user.role != "customer" or not current_user.customer_id:
        raise HTTPException(status_code=403, detail="Only customers can confirm delivery.")
    order = db.query(Order).filter(
        Order.order_id == order_id,
        Order.customer_id == current_user.customer_id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or does not belong to you.")
    if order.status != "completed":
        raise HTTPException(status_code=400, detail="Order is not yet ready for delivery confirmation.")
    order.status = "closed"
    db.commit()
    db.refresh(order)
    return order

@router.get("/queue", response_model=List[OrderOut])
def get_chef_queue(current_user: User = Depends(RoleChecker(["chef", "admin"])), db: Session = Depends(get_db)):
    # Get active orders: pending or preparing
    return db.query(Order).filter(Order.status.in_(["pending", "preparing"])).order_by(Order.created_at.asc()).all()

@router.put("/{order_id}/status", response_model=OrderOut)
def update_order_status(order_id: int, new_status: str, background_tasks: BackgroundTasks, current_user: User = Depends(RoleChecker(["chef", "admin"])), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )
    
    if new_status not in ["pending", "preparing", "completed", "closed"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid order status"
        )
        
    order.status = new_status
    db.commit()
    db.refresh(order)

    # Trigger ML models updates if order changes status
    ml_platform.mark_retrain_requested()
    background_tasks.add_task(retrain_ml_models_task)

    return order
