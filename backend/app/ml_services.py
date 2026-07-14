import os
import joblib
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.cluster import KMeans
from sqlalchemy.orm import Session
from sqlalchemy import func
from .models import FactSales, DimCustomer, DimProduct, DimDate, Order, OrderItem, Product
from .database import engine, SessionLocal

RETRAIN_COOLDOWN_SECONDS = 30

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ml_models")
os.makedirs(MODEL_DIR, exist_ok=True)

class MLPlatform:
    def __init__(self):
        self.sales_model_path = os.path.join(MODEL_DIR, "sales_forecaster.joblib")
        self.demand_model_path = os.path.join(MODEL_DIR, "demand_predictor.joblib")
        self.segment_model_path = os.path.join(MODEL_DIR, "customer_segmenter.joblib")
        self.churn_model_path = os.path.join(MODEL_DIR, "churn_classifier.joblib")
        self.recs_model_path = os.path.join(MODEL_DIR, "cooccurrence_matrix.joblib")

        self.sales_model = None
        self.demand_model = None
        self.segment_model = None
        self.churn_model = None
        self.recs_matrix = None # Dict mapping product_id to list of co-occurring product_ids
        self.retrain_requested = False
        self.last_retrain_at = None

        # Load models on start if they exist
        self.load_models()

    def _now(self):
        return datetime.utcnow()

    def mark_retrain_requested(self):
        self.retrain_requested = True

    def should_retrain(self):
        if self.last_retrain_at is None:
            return True
        if not self.retrain_requested:
            return False
        return (self._now() - self.last_retrain_at).total_seconds() >= RETRAIN_COOLDOWN_SECONDS

    def clear_retrain_flag(self):
        self.retrain_requested = False
        self.last_retrain_at = self._now()

    def load_models(self):
        try:
            if os.path.exists(self.sales_model_path):
                self.sales_model = joblib.load(self.sales_model_path)
            if os.path.exists(self.demand_model_path):
                self.demand_model = joblib.load(self.demand_model_path)
            if os.path.exists(self.segment_model_path):
                self.segment_model = joblib.load(self.segment_model_path)
            if os.path.exists(self.churn_model_path):
                self.churn_model = joblib.load(self.churn_model_path)
            if os.path.exists(self.recs_model_path):
                self.recs_matrix = joblib.load(self.recs_model_path)
        except Exception as e:
            print(f"Error loading models: {e}. They will be trained on the first run.")

    def retrain_all(self, db: Session):
        if self.last_retrain_at is not None and not self.should_retrain():
            print("Skipping ML retraining; cooldown active.")
            return True

        print("Starting ML Model Retraining Pipeline...")
        try:
            # 1. SALES FORECASTING MODEL
            self.train_sales_forecaster(db)

            # 2. CATEGORY DEMAND PREDICTION
            self.train_demand_predictor(db)

            # 3. CUSTOMER SEGMENTATION (K-MEANS)
            self.train_customer_segmenter(db)

            # 4. CHURN PREDICTION
            self.train_churn_predictor(db)

            # 5. RECOMMENDATION SYSTEM
            self.train_recommendation_system(db)

            self.clear_retrain_flag()
            print("All ML models trained and saved successfully!")
            return True
        except Exception as e:
            print(f"Retraining failed: {e}")
            import traceback
            traceback.print_exc()
            return False

    # --------------------------------------------------------------------------
    # 1. Sales Forecasting
    # --------------------------------------------------------------------------
    def train_sales_forecaster(self, db: Session):
        # Query sales by date
        query = db.query(FactSales.date_key, FactSales.line_total).all()
        if len(query) < 10:
            print("Not enough sales data to train forecaster.")
            return

        df = pd.DataFrame(query, columns=["date_str", "revenue"])
        df["date"] = pd.to_datetime(df["date_str"])
        daily = df.groupby("date")["revenue"].sum().reset_index()
        daily = daily.sort_values("date")

        # Feature engineering
        daily["day_of_week"] = daily["date"].dt.dayofweek
        daily["day_of_month"] = daily["date"].dt.day
        daily["month"] = daily["date"].dt.month
        daily["year"] = daily["date"].dt.year
        daily["is_weekend"] = daily["day_of_week"].isin([5, 6]).astype(int)

        # Lag features
        daily["lag_1"] = daily["revenue"].shift(1)
        daily["lag_7"] = daily["revenue"].shift(7)
        daily["rolling_mean_7"] = daily["revenue"].shift(1).rolling(7).mean()

        daily = daily.dropna()

        if len(daily) < 10:
            return

        X = daily[["day_of_week", "day_of_month", "month", "year", "is_weekend", "lag_1", "lag_7", "rolling_mean_7"]]
        y = daily["revenue"]

        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(X, y)

        # Save last known values for predicting
        self.last_sales_data = {
            "last_date": daily["date"].max(),
            "last_revenue": daily["revenue"].iloc[-1],
            "last_7_rev": daily["revenue"].iloc[-7:].tolist()
        }
        
        joblib.dump((model, self.last_sales_data), self.sales_model_path)
        self.sales_model = (model, self.last_sales_data)
        print("Sales forecaster trained.")

    def forecast_sales_7_days(self) -> list:
        if not self.sales_model:
            # Fallback if model not trained
            return [{"date": (datetime.now() + timedelta(days=i)).strftime("%Y-%m-%d"), "predicted_revenue": round(5000 + i * 150 + np.random.normal(0, 200), 2)} for i in range(1, 8)]

        model, last_data = self.sales_model
        last_date = last_data["last_date"]
        history = last_data["last_7_rev"].copy()

        predictions = []
        for i in range(1, 8):
            current_date = last_date + timedelta(days=i)
            day_of_week = current_date.dayofweek
            day_of_month = current_date.day
            month = current_date.month
            year = current_date.year
            is_weekend = int(day_of_week in [5, 6])
            
            lag_1 = history[-1]
            lag_7 = history[-7] if len(history) >= 7 else history[0]
            rolling_mean_7 = np.mean(history[-7:])

            features = np.array([[day_of_week, day_of_month, month, year, is_weekend, lag_1, lag_7, rolling_mean_7]])
            pred_rev = float(model.predict(features)[0])
            predictions.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "day_name": current_date.strftime("%A"),
                "predicted_revenue": round(pred_rev, 2)
            })
            history.append(pred_rev)
        
        return predictions

    # --------------------------------------------------------------------------
    # 2. Demand Prediction per Category
    # --------------------------------------------------------------------------
    def train_demand_predictor(self, db: Session):
        query = db.query(FactSales.date_key, DimProduct.category, FactSales.quantity)\
            .join(DimProduct, FactSales.product_key == DimProduct.product_key).all()
        
        if len(query) < 10:
            return

        df = pd.DataFrame(query, columns=["date_str", "category", "quantity"])
        df["date"] = pd.to_datetime(df["date_str"])
        
        # Group by date and category
        grouped = df.groupby(["date", "category"])["quantity"].sum().reset_index()
        
        # Map category to ID
        categories = grouped["category"].unique()
        cat_map = {cat: i for i, cat in enumerate(categories)}

        grouped["cat_id"] = grouped["category"].map(cat_map)
        grouped["day_of_week"] = grouped["date"].dt.dayofweek
        grouped["month"] = grouped["date"].dt.month

        X = grouped[["cat_id", "day_of_week", "month"]]
        y = grouped["quantity"]

        model = RandomForestRegressor(n_estimators=50, random_state=42)
        model.fit(X, y)

        joblib.dump((model, cat_map), self.demand_model_path)
        self.demand_model = (model, cat_map)
        print("Demand predictor trained.")

    def predict_tomorrow_demand(self) -> dict:
        if not self.demand_model:
            # Fallback
            return {"Burgers": 450, "Sides": 380, "Beverages": 500, "Desserts": 120, "McCafe": 190, "Breakfast": 140, "Chicken": 310}

        model, cat_map = self.demand_model
        tomorrow = datetime.now() + timedelta(days=1)
        day_of_week = tomorrow.weekday()
        month = tomorrow.month

        predictions = {}
        for cat, cat_id in cat_map.items():
            features = np.array([[cat_id, day_of_week, month]])
            pred_qty = int(model.predict(features)[0])
            predictions[cat] = max(1, pred_qty)
        
        return predictions

    # --------------------------------------------------------------------------
    # 3. Customer Segmentation (K-Means)
    # --------------------------------------------------------------------------
    def train_customer_segmenter(self, db: Session):
        # Query order aggregate details for RFM
        # Recency: days since last order relative to max date
        # Frequency: total order count
        # Monetary: total spending
        query = db.query(FactSales.customer_key, FactSales.date_key, FactSales.line_total).all()
        if len(query) < 10:
            return

        df = pd.DataFrame(query, columns=["customer_id", "date_str", "line_total"])
        df["date"] = pd.to_datetime(df["date_str"])
        max_date = df["date"].max()

        customer_rfm = df.groupby("customer_id").agg(
            recency=("date", lambda x: (max_date - x.max()).days),
            frequency=("customer_id", "count"),
            monetary=("line_total", "sum")
        ).reset_index()

        # Log transform & Scale
        X = customer_rfm[["recency", "frequency", "monetary"]].copy()
        X["recency_log"] = np.log1p(X["recency"])
        X["frequency_log"] = np.log1p(X["frequency"])
        X["monetary_log"] = np.log1p(X["monetary"])
        
        features = X[["recency_log", "frequency_log", "monetary_log"]]

        # Train KMeans (4 clusters)
        kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
        customer_rfm["cluster"] = kmeans.fit_predict(features)

        # Name clusters based on centroids
        # Typically:
        # Cluster with lowest recency and highest frequency/monetary -> "Loyal Big Spenders"
        # Cluster with highest recency -> "At Churn Risk"
        # Cluster with low recency, moderate frequency -> "Occasional Buyers"
        # Cluster with low frequency, low recency -> "New/Recent Customers"
        
        centroids = customer_rfm.groupby("cluster")[["recency", "frequency", "monetary"]].mean()
        
        # Sort clusters to map them consistently
        loyal_cluster = centroids["monetary"].idxmax()
        churn_cluster = centroids["recency"].idxmax()
        
        remaining = [c for c in [0, 1, 2, 3] if c not in [loyal_cluster, churn_cluster]]
        # of the remaining, higher frequency is Occasional, lower is New/Recent
        if centroids.loc[remaining[0], "frequency"] > centroids.loc[remaining[1], "frequency"]:
            occasional_cluster = remaining[0]
            new_cluster = remaining[1]
        else:
            occasional_cluster = remaining[1]
            new_cluster = remaining[0]

        cluster_names = {
            loyal_cluster: "Loyal Spender",
            churn_cluster: "At Churn Risk",
            occasional_cluster: "Occasional Buyer",
            new_cluster: "New/Recent Customer"
        }

        customer_rfm["segment_name"] = customer_rfm["cluster"].map(cluster_names)
        
        # Save mapping customer_id -> segment
        customer_segment_map = dict(zip(customer_rfm["customer_id"], customer_rfm["segment_name"]))

        joblib.dump((kmeans, cluster_names, customer_segment_map, customer_rfm.to_dict(orient="records")), self.segment_model_path)
        self.segment_model = (kmeans, cluster_names, customer_segment_map, customer_rfm.to_dict(orient="records"))
        print("Customer segmenter trained.")

    def get_customer_segment(self, customer_id: int) -> str:
        if not self.segment_model:
            return "Occasional Buyer"
        _, _, segment_map, _ = self.segment_model
        return segment_map.get(customer_id, "New/Recent Customer")

    def get_segment_distributions(self) -> dict:
        if not self.segment_model:
            return {"Loyal Spender": 150, "At Churn Risk": 120, "Occasional Buyer": 200, "New/Recent Customer": 130}
        _, _, _, records = self.segment_model
        df = pd.DataFrame(records)
        counts = df["segment_name"].value_counts().to_dict()
        return counts

    # --------------------------------------------------------------------------
    # 4. Churn Prediction
    # --------------------------------------------------------------------------
    def train_churn_predictor(self, db: Session):
        # We define Churn label: has the customer placed an order in the last 120 days?
        # Predict based on membership_type, first 60 days spending, average order size, state.
        query = db.query(FactSales.customer_key, FactSales.date_key, FactSales.line_total, FactSales.order_id).all()
        if len(query) < 10:
            return

        df = pd.DataFrame(query, columns=["customer_id", "date_str", "line_total", "order_id"])
        df["date"] = pd.to_datetime(df["date_str"])
        max_date = df["date"].max()

        cust_orders = df.groupby(["customer_id", "order_id", "date"])["line_total"].sum().reset_index()

        customer_stats = cust_orders.groupby("customer_id").agg(
            last_order_date=("date", "max"),
            total_orders=("order_id", "count"),
            total_spent=("line_total", "sum")
        ).reset_index()

        customer_details = db.query(DimCustomer.customer_key, DimCustomer.signup_date, DimCustomer.membership_type).all()
        details_df = pd.DataFrame(customer_details, columns=["customer_id", "signup_date", "membership_type"])
        details_df["signup_date"] = pd.to_datetime(details_df["signup_date"])

        merged = pd.merge(customer_stats, details_df, on="customer_id")
        merged["recency_days"] = (max_date - merged["last_order_date"]).dt.days
        merged["signup_age_days"] = (max_date - merged["signup_date"]).dt.days

        # Label: churn = 1 if recency_days > 150 days
        merged["churned"] = (merged["recency_days"] > 150).astype(int)

        # Features
        merged["avg_order_value"] = merged["total_spent"] / merged["total_orders"]
        merged["orders_per_month"] = merged["total_orders"] / (merged["signup_age_days"] / 30.0).clip(1.0)
        
        # Membership Tier encoding
        membership_map = {"None": 0, "Rewards Member": 1, "Rewards Gold": 2}
        merged["membership_tier"] = merged["membership_type"].map(membership_map).fillna(0)

        X = merged[["total_orders", "total_spent", "avg_order_value", "orders_per_month", "membership_tier", "signup_age_days"]]
        y = merged["churned"]

        model = LogisticRegression(max_iter=1000, random_state=42)
        model.fit(X, y)

        customer_churn_probabilities = {}
        probs = model.predict_proba(X)[:, 1] # Probability of churn
        for i, cid in enumerate(merged["customer_id"]):
            customer_churn_probabilities[int(cid)] = float(probs[i])

        joblib.dump((model, customer_churn_probabilities), self.churn_model_path)
        self.churn_model = (model, customer_churn_probabilities)
        print("Churn classifier trained.")

    def get_customer_churn_probability(self, customer_id: int) -> float:
        if not self.churn_model:
            return 0.15
        _, prob_map = self.churn_model
        return prob_map.get(customer_id, 0.15)

    def get_high_churn_risk_customers(self, db: Session, limit: int = 5) -> list:
        if not self.churn_model:
            return []
        _, prob_map = self.churn_model
        # Sort by churn probability descending
        sorted_probs = sorted(prob_map.items(), key=lambda x: x[1], reverse=True)
        high_risk_ids = [cid for cid, prob in sorted_probs[:limit]]
        
        results = []
        for cid in high_risk_ids:
            cust = db.query(DimCustomer).filter(DimCustomer.customer_key == cid).first()
            if cust:
                results.append({
                    "customer_id": cid,
                    "name": f"{cust.first_name} {cust.last_name}",
                    "email": cust.email,
                    "membership_type": cust.membership_type,
                    "churn_probability": round(prob_map[cid] * 100, 1)
                })
        return results

    # --------------------------------------------------------------------------
    # 5. Recommendation System (Co-occurrence Matrix)
    # --------------------------------------------------------------------------
    def train_recommendation_system(self, db: Session):
        # We build a recommendation engine based on co-occurrence in orders
        query = db.query(OrderItem.order_id, OrderItem.product_id).all()
        if len(query) < 10:
            return

        df = pd.DataFrame(query, columns=["order_id", "product_id"])
        
        # Self join to find pairs
        pairs = pd.merge(df, df, on="order_id")
        # Exclude same item pairs
        pairs = pairs[pairs["product_id_x"] != pairs["product_id_y"]]

        # Count frequencies
        cooc = pairs.groupby(["product_id_x", "product_id_y"]).size().reset_index(name="count")
        
        recs = {}
        for pid in cooc["product_id_x"].unique():
            item_recs = cooc[cooc["product_id_x"] == pid].sort_values("count", ascending=False)
            recs[int(pid)] = item_recs["product_id_y"].head(3).tolist()

        # Save co-occurrence recommendations
        joblib.dump(recs, self.recs_model_path)
        self.recs_matrix = recs
        print("Recommendation system trained.")

    def recommend_items(self, db: Session, current_cart_items: list, limit: int = 3) -> list:
        """
        Given a list of product IDs in the cart, return recommended products.
        """
        recommended_ids = []
        
        if current_cart_items:
            # Aggregate co-occurrences of all items currently in cart
            scores = {}
            for pid in current_cart_items:
                if self.recs_matrix and pid in self.recs_matrix:
                    for rec_id in self.recs_matrix[pid]:
                        if rec_id not in current_cart_items:
                            scores[rec_id] = scores.get(rec_id, 0) + 1
            # Sort recommended items
            sorted_recs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
            recommended_ids = [rid for rid, score in sorted_recs[:limit]]

        # If cart is empty or not enough recommendations, pad with top products overall
        if len(recommended_ids) < limit:
            top_query = db.query(OrderItem.product_id, Product.product_name, Product.category, Product.unit_price)\
                .join(Product, OrderItem.product_id == Product.product_id)\
                .group_by(OrderItem.product_id)\
                .order_by(func.sum(OrderItem.quantity).desc())\
                .limit(10).all()
            
            for item in top_query:
                pid = item[0]
                if pid not in current_cart_items and pid not in recommended_ids:
                    recommended_ids.append(pid)
                    if len(recommended_ids) >= limit:
                        break

        # Fetch product models
        recommended_products = db.query(Product).filter(Product.product_id.in_(recommended_ids)).all()
        return [{
            "product_id": p.product_id,
            "product_name": p.product_name,
            "category": p.category,
            "unit_price": p.unit_price
        } for p in recommended_products]

# Global instance of ML Platform
ml_platform = MLPlatform()
