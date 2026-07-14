# Source Dataset for ETL → Data Warehouse Project

This is a synthetic "restaurant orders" OLTP-style dataset — 5 tables, properly
linked with primary keys / foreign keys, ready for an ETL pipeline into a
star-schema data warehouse.

## Tables & Row Counts

| Table         | Rows  | Primary Key     | Foreign Keys                          |
|---------------|-------|-----------------|----------------------------------------|
| stores        | 40    | store_id        | —                                       |
| products      | 60    | product_id      | —                                       |
| customers     | 600   | customer_id     | —                                       |
| orders        | 1,800 | order_id        | customer_id → customers, store_id → stores |
| order_items   | 4,297 | order_item_id   | order_id → orders, product_id → products |

`stores` and `products` are small **lookup/reference tables** — that's normal
and realistic (a real chain doesn't have 500 stores, but it has millions of
order lines). The **transactional tables** (`orders`, `order_items`) are the
ones with real volume — this is exactly how OLTP systems look in the real
world.

## Relationships (Entity Diagram)

```
customers (1) ──< orders (many) >── (1) stores
                     |
                     | (1)
                     v
                order_items (many) >── (1) products
```

- One customer can place many orders
- One store can host many orders
- One order can contain many order_items (line items)
- One product can appear in many order_items

## Why this shape is good for ETL practice

- Real PK/FK relationships → you can practice actual `JOIN`s during the
  Transform step, instead of dealing with one flat file.
- One clear **fact grain**: `order_items` (one row = one product on one
  order) — this becomes your fact table.
- Four natural **dimensions**: customer, store, product, date.

## Suggested Star Schema (target Data Warehouse)

```
dim_customer     (customer_id, name, city, state, membership_type, signup_date)
dim_store        (store_id, store_name, city, state, store_type)
dim_product      (product_id, product_name, category, unit_price)
dim_date         (date_id, day, month, quarter, year, day_of_week)  -- generate this yourself

fact_sales
  - order_item_id  (degenerate key)
  - order_id       (degenerate dimension)
  - customer_key   FK -> dim_customer
  - store_key      FK -> dim_store
  - product_key    FK -> dim_product
  - date_key       FK -> dim_date
  - quantity
  - unit_price
  - line_total
```

## ETL steps to build this yourself

1. **Extract** — load the 5 CSVs with pandas.
2. **Transform**:
   - Join `order_items` → `orders` (to pull `customer_id`, `store_id`, `order_date`)
   - Join in `customers`, `stores`, `products` to denormalize descriptive attributes if desired, or keep as separate dimension tables (recommended — that's the point of a star schema)
   - Build a `dim_date` calendar table from the min/max `order_date` in `orders`
   - Generate surrogate keys for each dimension if you want (or just reuse the natural keys, since they're already clean here)
   - Compute measures: `line_total = quantity * unit_price` (already provided, but recompute it yourself as practice)
3. **Load** — write `dim_customer`, `dim_store`, `dim_product`, `dim_date`, `fact_sales` into your warehouse (SQLite / Postgres / Databricks — whatever your team is using).
4. **Data Mart** — build a narrower view on top for analysis, e.g. `revenue by store by month`, `top 10 products by revenue`, `revenue by channel`.
5. **Analysis** — run SQL/pandas queries or a small dashboard against the mart.

## Notes

- All data is synthetic (generated with Faker + numpy), fully reproducible via `generate_source_data.py` (seeded with 42).
- Dates span the last 2 years from generation date.
- No nulls / no dirty data on purpose — this dataset is meant to teach the
  ETL *pipeline mechanics* (joins, surrogate keys, star schema) without
  fighting messy data at the same time. Once you're comfortable, I can
  regenerate a "messy" version (nulls, duplicates, inconsistent formatting)
  so you can practice data cleaning too.
