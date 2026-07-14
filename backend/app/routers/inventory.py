from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import datetime
from ..database import get_db
from ..models import User, Inventory, Product
from ..schemas import InventoryOut, InventoryUpdate
from ..auth import RoleChecker
from ..ml_services import ml_platform
from .orders import retrain_ml_models_task

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

@router.get("", response_model=List[InventoryOut])
def get_inventory(current_user: User = Depends(RoleChecker(["chef", "admin"])), db: Session = Depends(get_db)):
    results = db.query(
        Inventory.product_id,
        Product.product_name,
        Product.category,
        Inventory.stock_level,
        Inventory.reorder_point,
        Inventory.last_updated
    ).join(Product, Inventory.product_id == Product.product_id).all()
    
    return [
        InventoryOut(
            product_id=r[0],
            product_name=r[1],
            category=r[2],
            stock_level=r[3],
            reorder_point=r[4],
            last_updated=r[5]
        ) for r in results
    ]

@router.put("/{product_id}", response_model=InventoryOut)
def update_stock(product_id: int, update: InventoryUpdate, background_tasks: BackgroundTasks, current_user: User = Depends(RoleChecker(["chef", "admin"])), db: Session = Depends(get_db)):
    inv = db.query(Inventory).filter(Inventory.product_id == product_id).first()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory record not found"
        )
    
    inv.stock_level = update.stock_level
    inv.last_updated = datetime.datetime.utcnow()
    db.commit()

    ml_platform.mark_retrain_requested()
    background_tasks.add_task(retrain_ml_models_task)

    product = db.query(Product).filter(Product.product_id == product_id).first()
    return InventoryOut(
        product_id=inv.product_id,
        product_name=product.product_name,
        category=product.category,
        stock_level=inv.stock_level,
        reorder_point=inv.reorder_point,
        last_updated=inv.last_updated
    )

@router.get("/low-stock", response_model=List[InventoryOut])
def get_low_stock(current_user: User = Depends(RoleChecker(["chef", "admin"])), db: Session = Depends(get_db)):
    results = db.query(
        Inventory.product_id,
        Product.product_name,
        Product.category,
        Inventory.stock_level,
        Inventory.reorder_point,
        Inventory.last_updated
    ).join(Product, Inventory.product_id == Product.product_id)\
     .filter(Inventory.stock_level <= Inventory.reorder_point).all()
    
    return [
        InventoryOut(
            product_id=r[0],
            product_name=r[1],
            category=r[2],
            stock_level=r[3],
            reorder_point=r[4],
            last_updated=r[5]
        ) for r in results
    ]
