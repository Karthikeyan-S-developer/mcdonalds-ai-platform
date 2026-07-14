"""
Generates a SIMPLE, RELATED synthetic OLTP dataset (source system) for an ETL -> Data Warehouse project.

Tables (with real PK/FK relationships):
  1. stores        (store_id PK)                              ~40 rows
  2. products      (product_id PK)                             ~60 rows
  3. customers      (customer_id PK)                           ~600 rows
  4. orders        (order_id PK, customer_id FK, store_id FK)  ~1800 rows
  5. order_items   (order_item_id PK, order_id FK, product_id FK) ~4800 rows

Relationships:
  customers (1) ----< orders (many)
  stores    (1) ----< orders (many)
  orders    (1) ----< order_items (many)
  products  (1) ----< order_items (many)

This is a classic "sales/orders" OLTP schema -> perfect for building a star schema DW:
  dim_customer, dim_store, dim_product, dim_date  +  fact_sales (from order_items joined to orders)
"""

import random
import numpy as np
import pandas as pd
from datetime import date, timedelta
from faker import Faker

fake = Faker()
Faker.seed(42)
random.seed(42)
np.random.seed(42)

OUT_DIR = "/home/claude/work/source_data"
import os
os.makedirs(OUT_DIR, exist_ok=True)

# ----------------------------------------------------------------------
# 1. STORES
# ----------------------------------------------------------------------
US_STATES = ["California","Texas","New York","Florida","Illinois","Ohio","Georgia",
             "Pennsylvania","North Carolina","Michigan"]
STORE_TYPES = ["Dine-In", "Drive-Thru", "Kiosk", "Mall Location"]

n_stores = 40
stores = pd.DataFrame({
    "store_id": range(1, n_stores + 1),
    "store_name": [f"Store #{i:03d} - {fake.city()}" for i in range(1, n_stores + 1)],
    "city": [fake.city() for _ in range(n_stores)],
    "state": np.random.choice(US_STATES, n_stores),
    "store_type": np.random.choice(STORE_TYPES, n_stores, p=[0.35, 0.4, 0.15, 0.10]),
    "opened_date": [fake.date_between(start_date="-10y", end_date="-1y") for _ in range(n_stores)],
})

# ----------------------------------------------------------------------
# 2. PRODUCTS
# ----------------------------------------------------------------------
menu = {
    "Burgers": [("Classic Cheeseburger", 3.49), ("Double Beef Burger", 5.49),
                ("Bacon Deluxe Burger", 5.99), ("Veggie Burger", 4.99)],
    "Chicken": [("Crispy Chicken Sandwich", 4.99), ("Spicy Chicken Sandwich", 5.29),
                ("Chicken Nuggets (6pc)", 3.99), ("Chicken Nuggets (10pc)", 5.99)],
    "Sides": [("Small Fries", 1.99), ("Medium Fries", 2.79), ("Large Fries", 3.49),
              ("Side Salad", 2.99), ("Hashbrown", 1.49)],
    "Beverages": [("Small Soda", 1.29), ("Medium Soda", 1.79), ("Large Soda", 2.19),
                  ("Iced Coffee", 2.49), ("Milkshake", 3.29), ("Bottled Water", 1.49)],
    "Breakfast": [("Egg McMuffin Style", 3.99), ("Hotcakes", 3.49), ("Breakfast Burrito", 3.79)],
    "Desserts": [("Apple Pie", 1.49), ("Sundae", 1.99), ("Cookie", 0.99)],
    "McCafe": [("Cappuccino", 2.99), ("Latte", 3.29), ("Mocha", 3.49), ("Hot Chocolate", 2.49)],
}

rows = []
pid = 1
for category, items in menu.items():
    for name, price in items:
        rows.append((pid, name, category, round(price, 2)))
        pid += 1
# pad to ~60 products with combo variants
while len(rows) < 60:
    base_cat = random.choice(list(menu.keys()))
    base_item = random.choice(menu[base_cat])
    rows.append((pid, base_item[0] + " (Combo)", base_cat, round(base_item[1] + 3.49, 2)))
    pid += 1

products = pd.DataFrame(rows, columns=["product_id", "product_name", "category", "unit_price"])

# ----------------------------------------------------------------------
# 3. CUSTOMERS
# ----------------------------------------------------------------------
n_customers = 600
membership = ["None", "None", "None", "Rewards Member", "Rewards Member", "Rewards Gold"]

customers = pd.DataFrame({
    "customer_id": range(1, n_customers + 1),
    "first_name": [fake.first_name() for _ in range(n_customers)],
    "last_name": [fake.last_name() for _ in range(n_customers)],
    "email": None,
    "city": [fake.city() for _ in range(n_customers)],
    "state": np.random.choice(US_STATES, n_customers),
    "signup_date": [fake.date_between(start_date="-4y", end_date="today") for _ in range(n_customers)],
    "membership_type": np.random.choice(membership, n_customers),
})
customers["email"] = (customers["first_name"] + "." + customers["last_name"] + customers["customer_id"].astype(str) + "@example.com").str.lower()

# ----------------------------------------------------------------------
# 4. ORDERS  (customer_id FK, store_id FK)
# ----------------------------------------------------------------------
n_orders = 1800
channels = ["Dine-In", "Drive-Thru", "Mobile App", "Delivery", "Kiosk"]
channel_p = [0.25, 0.40, 0.15, 0.10, 0.10]

start_date = date.today() - timedelta(days=730)
order_dates = [start_date + timedelta(days=int(x)) for x in np.random.exponential(scale=250, size=n_orders).clip(0, 729)]

orders = pd.DataFrame({
    "order_id": range(1, n_orders + 1),
    "customer_id": np.random.choice(customers["customer_id"], n_orders),
    "store_id": np.random.choice(stores["store_id"], n_orders),
    "order_date": order_dates,
    "order_channel": np.random.choice(channels, n_orders, p=channel_p),
})
orders["order_date"] = pd.to_datetime(orders["order_date"]).dt.date

# ----------------------------------------------------------------------
# 5. ORDER_ITEMS (order_id FK, product_id FK)  -- this is the sales grain
# ----------------------------------------------------------------------
item_rows = []
oi_id = 1
product_price_map = dict(zip(products["product_id"], products["unit_price"]))

for order_id in orders["order_id"]:
    n_items = np.random.choice([1, 2, 3, 4, 5], p=[0.30, 0.30, 0.20, 0.12, 0.08])
    chosen_products = np.random.choice(products["product_id"], size=n_items, replace=True)
    for prod_id in chosen_products:
        qty = np.random.choice([1, 2, 3], p=[0.7, 0.2, 0.1])
        item_rows.append((oi_id, order_id, prod_id, int(qty), product_price_map[prod_id]))
        oi_id += 1

order_items = pd.DataFrame(item_rows, columns=["order_item_id", "order_id", "product_id", "quantity", "unit_price"])
order_items["line_total"] = (order_items["quantity"] * order_items["unit_price"]).round(2)

# ----------------------------------------------------------------------
# Save all tables
# ----------------------------------------------------------------------
stores.to_csv(f"{OUT_DIR}/stores.csv", index=False)
products.to_csv(f"{OUT_DIR}/products.csv", index=False)
customers.to_csv(f"{OUT_DIR}/customers.csv", index=False)
orders.to_csv(f"{OUT_DIR}/orders.csv", index=False)
order_items.to_csv(f"{OUT_DIR}/order_items.csv", index=False)

print("stores:", stores.shape)
print("products:", products.shape)
print("customers:", customers.shape)
print("orders:", orders.shape)
print("order_items:", order_items.shape)
print("\nTotal revenue check:", order_items["line_total"].sum())
