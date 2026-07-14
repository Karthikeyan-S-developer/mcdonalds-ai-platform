import os
import pandas as pd
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base, User, Store, Product, Customer, Order, OrderItem, Inventory, DimCustomer, DimStore, DimProduct, DimDate, FactSales

# We will save the db in the scratch directory
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mcdonalds.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper for secure password hashing using hashlib if passlib/bcrypt are not pre-installed or to guarantee compatibility
import hashlib
import binascii

def hash_password(password: str) -> str:
    # We will use pbkdf2_hmac with sha256 for a robust, zero-dependency password hash
    salt = b"mcdonalds_secure_salt_12345"
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return binascii.hexlify(dk).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

def run_etl_pipeline(source_data_dir: str):
    db = SessionLocal()
    try:
        # Create all tables if they don't exist
        Base.metadata.create_all(bind=engine)

        # Check if we already have data loaded
        if db.query(Store).count() > 0:
            print("Database already populated. Skipping ETL.")
            return

        print("Starting ETL Ingestion Pipeline...")

        # 1. Read Source CSVs
        stores_df = pd.read_csv(os.path.join(source_data_dir, "stores.csv"))
        products_df = pd.read_csv(os.path.join(source_data_dir, "products.csv"))
        customers_df = pd.read_csv(os.path.join(source_data_dir, "customers.csv"))
        customers_df["membership_type"] = customers_df["membership_type"].fillna("None")
        orders_df = pd.read_csv(os.path.join(source_data_dir, "orders.csv"))
        order_items_df = pd.read_csv(os.path.join(source_data_dir, "order_items.csv"))

        # Convert date columns
        stores_df["opened_date"] = pd.to_datetime(stores_df["opened_date"]).dt.date
        customers_df["signup_date"] = pd.to_datetime(customers_df["signup_date"]).dt.date
        orders_df["order_date"] = pd.to_datetime(orders_df["order_date"]).dt.date

        # 2. Insert into OLTP Tables

        # Stores
        print("Loading stores...")
        for _, row in stores_df.iterrows():
            store = Store(
                store_id=int(row["store_id"]),
                store_name=row["store_name"],
                city=row["city"],
                state=row["state"],
                store_type=row["store_type"],
                opened_date=row["opened_date"]
            )
            db.add(store)
            # Sync to DimStore
            dim_store = DimStore(
                store_key=int(row["store_id"]),
                store_name=row["store_name"],
                city=row["city"],
                state=row["state"],
                store_type=row["store_type"]
            )
            db.add(dim_store)

        # Products & Inventory
        print("Loading products and initializing inventory...")
        for _, row in products_df.iterrows():
            prod_id = int(row["product_id"])
            product = Product(
                product_id=prod_id,
                product_name=row["product_name"],
                category=row["category"],
                unit_price=float(row["unit_price"])
            )
            db.add(product)

            # Sync to DimProduct
            dim_product = DimProduct(
                product_key=prod_id,
                product_name=row["product_name"],
                category=row["category"],
                unit_price=float(row["unit_price"])
            )
            db.add(dim_product)

            # Inventory (Stock levels between 100 and 300, reorder point 30)
            inventory = Inventory(
                product_id=prod_id,
                stock_level=200,
                reorder_point=30
            )
            db.add(inventory)

        # Customers & Users
        print("Loading customers and creating user accounts...")
        customer_pass_hash = hash_password("CustomerPass123")
        for _, row in customers_df.iterrows():
            cust_id = int(row["customer_id"])
            customer = Customer(
                customer_id=cust_id,
                first_name=row["first_name"],
                last_name=row["last_name"],
                email=row["email"],
                city=row["city"],
                state=row["state"],
                signup_date=row["signup_date"],
                membership_type=row["membership_type"]
            )
            db.add(customer)

            # Sync to DimCustomer
            dim_customer = DimCustomer(
                customer_key=cust_id,
                first_name=row["first_name"],
                last_name=row["last_name"],
                email=row["email"],
                city=row["city"],
                state=row["state"],
                membership_type=row["membership_type"],
                signup_date=row["signup_date"]
            )
            db.add(dim_customer)

            # Create User login for this customer
            cust_user = User(
                email=row["email"],
                password_hash=customer_pass_hash,
                name=f"{row['first_name']} {row['last_name']}",
                role="customer",
                customer_id=cust_id
            )
            db.add(cust_user)

        # Seed Default Admin and Chef
        print("Creating admin and chef users...")
        admin_user = User(
            email="admin@mcdonalds.com",
            password_hash=hash_password("AdminPass123"),
            name="Platform Admin",
            role="admin"
        )
        chef_user = User(
            email="chef@mcdonalds.com",
            password_hash=hash_password("ChefPass123"),
            name="Head Chef",
            role="chef"
        )
        db.add(admin_user)
        db.add(chef_user)

        db.commit() # Commit lookups and users first to avoid FK errors

        # Orders & OrderItems
        print("Loading orders and order items...")
        # To compute total amount for orders
        order_totals = order_items_df.groupby("order_id")["line_total"].sum().to_dict()

        for _, row in orders_df.iterrows():
            order_id = int(row["order_id"])
            total = float(order_totals.get(order_id, 0.0))
            order = Order(
                order_id=order_id,
                customer_id=int(row["customer_id"]),
                store_id=int(row["store_id"]),
                order_date=row["order_date"],
                order_channel=row["order_channel"],
                status="closed", # Historical orders are closed
                total_amount=total
            )
            db.add(order)

        for _, row in order_items_df.iterrows():
            item = OrderItem(
                order_item_id=int(row["order_item_id"]),
                order_id=int(row["order_id"]),
                product_id=int(row["product_id"]),
                quantity=int(row["quantity"]),
                unit_price=float(row["unit_price"]),
                line_total=float(row["line_total"])
            )
            db.add(item)

        db.commit()

        # 3. Create DimDate Calendar
        print("Creating DimDate records...")
        min_date = orders_df["order_date"].min()
        max_date = orders_df["order_date"].max()
        # Add buffer for future predictions
        max_date = max_date + datetime.timedelta(days=30)
        
        date_range = pd.date_range(start=min_date, end=max_date)
        for dt in date_range:
            d_date = dt.date()
            date_key = d_date.strftime("%Y-%m-%d")
            dim_date = DimDate(
                date_key=date_key,
                date=d_date,
                day=int(dt.day),
                month=int(dt.month),
                month_name=dt.strftime("%B"),
                quarter=int((dt.month-1)//3 + 1),
                year=int(dt.year),
                day_of_week=int(dt.dayofweek),
                day_name=dt.strftime("%A")
            )
            db.add(dim_date)
        db.commit()

        # 4. Ingest into FactSales (Star Schema)
        print("Populating FactSales warehouse table...")
        # Querying OLTP table data to transform and load
        sales_items = db.query(OrderItem, Order).join(Order, OrderItem.order_id == Order.order_id).all()
        for item, order in sales_items:
            fact = FactSales(
                order_item_id=item.order_item_id,
                order_id=item.order_id,
                customer_key=order.customer_id,
                store_key=order.store_id,
                product_key=item.product_id,
                date_key=order.order_date.strftime("%Y-%m-%d"),
                quantity=item.quantity,
                unit_price=item.unit_price,
                line_total=item.line_total,
                order_channel=order.order_channel
            )
            db.add(fact)
        db.commit()

        print("ETL Ingestion Pipeline completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"ETL Ingestion Pipeline failed: {str(e)}")
        raise e
    finally:
        db.close()

def sync_new_order_to_dw(db, order_id: int):
    """
    Incremental ETL: Sync a newly placed order from OLTP to the FactSales table in Star Schema.
    """
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        return
    
    # Ensure DimDate exists for this date
    date_str = order.order_date.strftime("%Y-%m-%d")
    dim_date = db.query(DimDate).filter(DimDate.date_key == date_str).first()
    if not dim_date:
        dt = pd.to_datetime(order.order_date)
        new_dim_date = DimDate(
            date_key=date_str,
            date=order.order_date,
            day=int(dt.day),
            month=int(dt.month),
            month_name=dt.strftime("%B"),
            quarter=int((dt.month-1)//3 + 1),
            year=int(dt.year),
            day_of_week=int(dt.dayofweek),
            day_name=dt.strftime("%A")
        )
        db.add(new_dim_date)
        db.commit()

    # Sync each line item to FactSales
    for item in order.items:
        fact = FactSales(
            order_item_id=item.order_item_id,
            order_id=order.order_id,
            customer_key=order.customer_id,
            store_key=order.store_id,
            product_key=item.product_id,
            date_key=date_str,
            quantity=item.quantity,
            unit_price=item.unit_price,
            line_total=item.line_total,
            order_channel=order.order_channel
        )
        db.add(fact)
    db.commit()
