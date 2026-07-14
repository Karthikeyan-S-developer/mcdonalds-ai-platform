from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import datetime

Base = declarative_base()

# ==============================================================================
# OLTP SYSTEM MODELS
# ==============================================================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False) # admin, chef, customer
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    customer = relationship("Customer", back_populates="user")


class Store(Base):
    __tablename__ = "stores"

    store_id = Column(Integer, primary_key=True, index=True)
    store_name = Column(String, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String, nullable=False)
    store_type = Column(String, nullable=False)
    opened_date = Column(Date, nullable=False)

    orders = relationship("Order", back_populates="store")


class Product(Base):
    __tablename__ = "products"

    product_id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    unit_price = Column(Float, nullable=False)

    order_items = relationship("OrderItem", back_populates="product")
    inventory = relationship("Inventory", back_populates="product", uselist=False)


class Customer(Base):
    __tablename__ = "customers"

    customer_id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String, nullable=False)
    signup_date = Column(Date, nullable=False)
    membership_type = Column(String, nullable=False)

    user = relationship("User", back_populates="customer", uselist=False)
    orders = relationship("Order", back_populates="customer")


class Order(Base):
    __tablename__ = "orders"

    order_id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False)
    order_date = Column(Date, nullable=False)
    order_channel = Column(String, nullable=False)
    status = Column(String, default="pending") # pending, preparing, completed, closed
    total_amount = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    customer = relationship("Customer", back_populates="orders")
    store = relationship("Store", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    order_item_id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.order_id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    line_total = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")

    @property
    def product_name(self):
        return self.product.product_name if self.product else None


class Inventory(Base):
    __tablename__ = "inventory"

    product_id = Column(Integer, ForeignKey("products.product_id"), primary_key=True)
    stock_level = Column(Integer, nullable=False)
    reorder_point = Column(Integer, default=20)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    product = relationship("Product", back_populates="inventory")


# ==============================================================================
# STAR SCHEMA WAREHOUSE MODELS
# ==============================================================================

class DimCustomer(Base):
    __tablename__ = "dim_customer"

    customer_key = Column(Integer, primary_key=True, index=True) # reuse customer_id
    first_name = Column(String)
    last_name = Column(String)
    email = Column(String)
    city = Column(String)
    state = Column(String)
    membership_type = Column(String)
    signup_date = Column(Date)


class DimStore(Base):
    __tablename__ = "dim_store"

    store_key = Column(Integer, primary_key=True, index=True) # reuse store_id
    store_name = Column(String)
    city = Column(String)
    state = Column(String)
    store_type = Column(String)


class DimProduct(Base):
    __tablename__ = "dim_product"

    product_key = Column(Integer, primary_key=True, index=True) # reuse product_id
    product_name = Column(String)
    category = Column(String)
    unit_price = Column(Float)


class DimDate(Base):
    __tablename__ = "dim_date"

    date_key = Column(String, primary_key=True, index=True) # YYYY-MM-DD
    date = Column(Date, unique=True)
    day = Column(Integer)
    month = Column(Integer)
    month_name = Column(String)
    quarter = Column(Integer)
    year = Column(Integer)
    day_of_week = Column(Integer)
    day_name = Column(String)


class FactSales(Base):
    __tablename__ = "fact_sales"

    sales_key = Column(Integer, primary_key=True, autoincrement=True)
    order_item_id = Column(Integer)
    order_id = Column(Integer)
    customer_key = Column(Integer, ForeignKey("dim_customer.customer_key"))
    store_key = Column(Integer, ForeignKey("dim_store.store_key"))
    product_key = Column(Integer, ForeignKey("dim_product.product_key"))
    date_key = Column(String, ForeignKey("dim_date.date_key"))
    quantity = Column(Integer)
    unit_price = Column(Float)
    line_total = Column(Float)
    order_channel = Column(String)
