from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import datetime
from ..database import get_db
from ..models import User, FactSales, DimProduct, DimStore, Inventory, Product
from ..auth import get_current_user, RoleChecker
from ..ml_services import ml_platform
from ..gemini_service import gemini_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/kpis")
def get_kpis(current_user: User = Depends(RoleChecker(["admin"])), db: Session = Depends(get_db)):
    # 1. Total revenue
    total_rev = db.query(func.sum(FactSales.line_total)).scalar() or 0.0
    
    # 2. Total order count
    total_orders = db.query(func.count(func.distinct(FactSales.order_id))).scalar() or 0

    # 3. Active users
    total_users = db.query(func.count(User.id)).scalar() or 0

    # 4. Low stock items count
    low_stock_count = db.query(func.count(Inventory.product_id))\
        .filter(Inventory.stock_level <= Inventory.reorder_point).scalar() or 0

    # 5. Revenue by category
    cat_sales = db.query(
        DimProduct.category,
        func.sum(FactSales.line_total)
    ).join(DimProduct, FactSales.product_key == DimProduct.product_key)\
     .group_by(DimProduct.category).all()
    category_revenue = [{"category": row[0], "revenue": round(row[1], 2)} for row in cat_sales]

    # 6. Top 5 selling products
    top_prods = db.query(
        DimProduct.product_name,
        func.sum(FactSales.quantity)
    ).join(DimProduct, FactSales.product_key == DimProduct.product_key)\
     .group_by(DimProduct.product_name)\
     .order_by(func.sum(FactSales.quantity).desc())\
     .limit(5).all()
    top_products = [{"name": row[0], "quantity": int(row[1])} for row in top_prods]

    # 7. Recent 30 days revenue (trend)
    # Get last 30 days of data
    trend_sales = db.query(
        FactSales.date_key,
        func.sum(FactSales.line_total)
    ).group_by(FactSales.date_key)\
     .order_by(FactSales.date_key.desc())\
     .limit(30).all()
    # reverse to chronological order
    trend_sales.reverse()
    revenue_trend = [{"date": row[0], "revenue": round(row[1], 2)} for row in trend_sales]

    return {
        "total_revenue": round(total_rev, 2),
        "total_orders": total_orders,
        "total_users": total_users,
        "low_stock_count": low_stock_count,
        "category_revenue": category_revenue,
        "top_products": top_products,
        "revenue_trend": revenue_trend
    }

@router.get("/ml-predictions")
def get_ml_predictions(current_user: User = Depends(RoleChecker(["admin", "chef"])), db: Session = Depends(get_db)):
    # 7-day revenue forecast
    seven_day_forecast = ml_platform.forecast_sales_7_days()
    
    # Tomorrow demand per category
    tomorrow_demand = ml_platform.predict_tomorrow_demand()

    # Churn risk customers (only for admins)
    high_churn_risk = []
    if current_user.role == "admin":
        high_churn_risk = ml_platform.get_high_churn_risk_customers(db, limit=5)

    # Segment distribution
    segments = ml_platform.get_segment_distributions()

    return {
        "seven_day_forecast": seven_day_forecast,
        "tomorrow_demand": tomorrow_demand,
        "high_churn_risk": high_churn_risk,
        "segments": segments
    }

@router.get("/gemini-insights")
def get_gemini_insights(role: str = "admin", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Prepare statistics
    # Total revenue, orders, active users
    total_rev = db.query(func.sum(FactSales.line_total)).scalar() or 0.0
    total_orders = db.query(func.count(func.distinct(FactSales.order_id))).scalar() or 0
    total_users = db.query(func.count(User.id)).scalar() or 0
    
    # Low stock list
    low_stock_results = db.query(Product.product_name, Inventory.stock_level)\
        .join(Product, Inventory.product_id == Product.product_id)\
        .filter(Inventory.stock_level <= Inventory.reorder_point).all()
    low_stock_items = [{"product_name": row[0], "stock_level": row[1]} for row in low_stock_results]

    # Predictions
    seven_day_forecast = ml_platform.forecast_sales_7_days()
    tomorrow_demand = ml_platform.predict_tomorrow_demand()
    high_churn_risk = ml_platform.get_high_churn_risk_customers(db, limit=3)
    segments = ml_platform.get_segment_distributions()

    stats = {
        "total_revenue": total_rev,
        "total_orders": total_orders,
        "total_users": total_users,
        "low_stock_count": len(low_stock_items),
        "low_stock_items": low_stock_items,
        "tomorrow_demand": tomorrow_demand,
        "seven_day_forecast": seven_day_forecast,
        "high_churn_risk": high_churn_risk,
        "segments": segments
    }

    if role == "chef":
        return {"insights": gemini_service.generate_chef_suggestions(low_stock_items, tomorrow_demand)}
    else:
        # Default to admin
        return {"insights": gemini_service.generate_admin_insights(stats)}

@router.get("/recommendations")
def get_menu_recommendations(product_id: List[int] = Query(default=[]), db: Session = Depends(get_db)):
    """
    Returns recommendations based on items in cart (product_ids passed in URL)
    """
    return ml_platform.recommend_items(db, current_cart_items=product_id, limit=3)

@router.get("/customer-profile")
def get_customer_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "customer" or not current_user.customer_id:
        raise HTTPException(status_code=400, detail="User is not a customer.")
    
    segment = ml_platform.get_customer_segment(current_user.customer_id)
    churn_prob = ml_platform.get_customer_churn_probability(current_user.customer_id)

    # Personalized deals based on segment
    deals = []
    if segment == "Loyal Spender":
        deals = [
            {"title": "Loyal Gold Club Offer", "description": "Free Large Fries with any Burger Combo!", "code": "GOLDENSPENDER"},
            {"title": "McCafe Treats", "description": "Buy 1 Get 1 Free on all Specialty Coffees", "code": "COFFEELOVER"}
        ]
    elif segment == "At Churn Risk":
        deals = [
            {"title": "We Miss You deal!", "description": "Enjoy 30% OFF your entire cart today!", "code": "WELOVEU30"},
            {"title": "Sweet Return Combo", "description": "Free Apple Pie with any McMuffin purchase", "code": "SWEETRETURN"}
        ]
    elif segment == "New/Recent Customer":
        deals = [
            {"title": "Welcome to Golden Arches", "description": "Get a Classic Cheeseburger for only $1.00!", "code": "NEWARCS"},
            {"title": "Breakfast Starter", "description": "Free Hashbrown with any morning beverage", "code": "MORNINGS"}
        ]
    else: # Occasional Buyer
        deals = [
            {"title": "Midweek Saver", "description": "20% OFF any Dinner Combo (after 5 PM)", "code": "MIDWEEK20"},
            {"title": "Snack Attack", "description": "2 Small Fries & Soft Drinks for $4.99", "code": "SNACKATTACK"}
        ]

    return {
        "customer_id": current_user.customer_id,
        "name": current_user.name,
        "segment": segment,
        "churn_probability": round(churn_prob * 100, 1),
        "deals": deals
    }
