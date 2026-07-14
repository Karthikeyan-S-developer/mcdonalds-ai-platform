import sys
import os

print("--- MCDONALD'S AI PLATFORM VERIFICATION ---")

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    print("Testing backend dependencies...")
    import fastapi
    import uvicorn
    import sqlalchemy
    import pandas
    import numpy
    import sklearn
    import jwt
    import joblib
    print("[OK] All libraries imported successfully!")
except ImportError as e:
    print(f"[FAIL] Library import failed: {e}")
    sys.exit(1)

try:
    print("Initializing database ETL and training models...")
    from backend.app.database import run_etl_pipeline, SessionLocal, engine
    from backend.app.models import Base
    
    source_dir = r"C:\Users\karth\Downloads\PROTO\source_data"
    print(f"Source data directory: {source_dir}")
    
    # Run ETL
    run_etl_pipeline(source_dir)
    print("[OK] Database ETL completed successfully!")
    
    # Verify models can retrain
    print("Training ML Models...")
    from backend.app.ml_services import ml_platform
    db = SessionLocal()
    try:
        success = ml_platform.retrain_all(db)
        if success:
            print("[OK] Machine learning models trained and serialized!")
        else:
            print("[FAIL] ML models training failed!")
            sys.exit(1)
    finally:
        db.close()
        
    print("--- VERIFICATION PASSED ---")
except Exception as e:
    print(f"[FAIL] Verification failed with error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
