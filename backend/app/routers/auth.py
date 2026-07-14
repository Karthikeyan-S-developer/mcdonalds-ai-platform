from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db, hash_password, verify_password
from ..models import User, Customer
from ..schemas import UserCreate, UserLogin, UserOut, Token
from ..auth import create_access_token, get_current_user
from ..ml_services import ml_platform
from .orders import retrain_ml_models_task
import datetime

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=UserOut)
def register(user_in: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email is already registered."
        )

    # If user is a customer, create a customer profile
    customer_id = None
    if user_in.role == "customer":
        names = user_in.name.split(" ", 1)
        first_name = names[0]
        last_name = names[1] if len(names) > 1 else ""
        
        customer = Customer(
            first_name=first_name,
            last_name=last_name,
            email=user_in.email,
            city="New York", # Default values
            state="New York",
            signup_date=datetime.date.today(),
            membership_type="None"
        )
        db.add(customer)
        db.flush() # Populate customer_id
        customer_id = customer.customer_id

    hashed = hash_password(user_in.password)
    user = User(
        email=user_in.email,
        password_hash=hashed,
        name=user_in.name,
        role=user_in.role,
        customer_id=customer_id
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    ml_platform.mark_retrain_requested()
    background_tasks.add_task(retrain_ml_models_task)
    return user

@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_in.email).first()
    if not user or not verify_password(login_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserOut)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
