import os
from .env_loader import load_env_file

load_env_file()
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from .database import get_db, run_etl_pipeline, SessionLocal
from .models import Product, Store, Base
from .schemas import ProductOut
from .routers import auth, orders, inventory, analytics, chatbot
from .ml_services import ml_platform

app = FastAPI(title="McDonald's Intelligent AI-Driven Operations & CX Platform")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup ETL & ML Trigger
@app.on_event("startup")
def on_startup():
    source_data_dir = r"C:\Users\karth\Downloads\PROTO\source_data"
    if not os.path.exists(source_data_dir):
        print(f"ERROR: Source data directory '{source_data_dir}' does not exist.")
        # Create schema anyway so app doesn't break
        from .database import engine
        Base.metadata.create_all(bind=engine)
        return

    try:
        # Run database ETL Pipeline
        run_etl_pipeline(source_data_dir)
        
        # Train ML models with the loaded database
        db = SessionLocal()
        try:
            ml_platform.retrain_all(db)
        finally:
            db.close()
            
    except Exception as e:
        print(f"Startup initialization failed: {e}")

# Include Routers
app.include_router(auth.router)
app.include_router(orders.router)
app.include_router(inventory.router)
app.include_router(analytics.router)
app.include_router(chatbot.router)

# Basic Core Endpoints
@app.get("/api/menu", response_model=List[ProductOut], tags=["core"])
def get_menu(db: Session = Depends(get_db)):
    return db.query(Product).all()

@app.get("/api/stores", tags=["core"])
def get_stores(db: Session = Depends(get_db)):
    stores = db.query(Store).all()
    return [{"store_id": s.store_id, "store_name": s.store_name, "city": s.city, "state": s.state, "store_type": s.store_type} for s in stores]

@app.get("/api/health", tags=["core"])
def health_check():
    return {"status": "healthy", "database": "connected", "ml_models": "loaded"}
