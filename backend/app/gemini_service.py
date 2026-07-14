import os
import json
from typing import List
from google import genai
from google.genai import types
from .env_loader import load_env_file

# Ensure environment variables are loaded when the module is imported.
load_env_file()

class GeminiAIService:
    DEFAULT_MODEL_NAME = "models/gemini-2.0-flash-lite"
    PREFERRED_MODEL_NAMES = [
        "models/gemini-2.0-flash-lite-001",
        "models/gemini-2.0-flash-lite",
        "models/gemini-2.5-flash-lite",
        "models/gemini-flash-lite-latest",
        "models/gemini-2.5-flash",
        "models/gemini-flash-latest",
        "models/gemini-2.5-pro",
        "models/gemini-pro-latest",
        "models/gemini-3.5-flash",
        "models/gemini-3-flash-preview",
        "models/gemini-3-pro-preview",
    ]

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.requested_model_name = os.getenv("GEMINI_MODEL_NAME")
        self.model_name = self.requested_model_name or self.DEFAULT_MODEL_NAME
        self.client = None
        self.last_error = None

        if self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
                self.model_name = self._resolve_model_name(self.model_name)
                print(f"Gemini API Client initialized successfully using model {self.model_name}.")
            except Exception as exc:
                print(f"Failed to initialize Gemini API Client: {exc}. Falling back to mock generator.")
                self.client = None
        else:
            print("GEMINI_API_KEY environment variable not found. Using mock AI response fallback.")

    def _list_available_models(self) -> List[types.Model]:
        if not self.client:
            return []
        try:
            return list(self.client.models.list())
        except Exception as exc:
            print(f"Gemini API Error listing models: {exc}")
            return []

    def _is_model_supported(self, model_name: str, models: List[types.Model]) -> bool:
        if not model_name or not models:
            return False
        for model in models:
            if getattr(model, "name", None) == model_name:
                supported_actions = getattr(model, "supported_actions", []) or []
                return "generateContent" in supported_actions
        return False

    def _resolve_model_name(self, candidate_model_name: str) -> str:
        available_models = self._list_available_models()
        if self._is_model_supported(candidate_model_name, available_models):
            return candidate_model_name

        if self.requested_model_name:
            print(f"Requested Gemini model '{self.requested_model_name}' is unavailable or unsupported; trying defaults.")

        for model_name in self.PREFERRED_MODEL_NAMES:
            if self._is_model_supported(model_name, available_models):
                print(f"Using available Gemini model '{model_name}'.")
                return model_name

        if available_models:
            candidate = available_models[0].name
            print(f"No preferred Gemini model available; falling back to first available model '{candidate}'.")
            return candidate

        print("No Gemini models could be detected; using default model name and hoping the API resolves it.")
        return candidate_model_name or self.DEFAULT_MODEL_NAME

    def _normalize_contents(self, prompt: str):
        return prompt

    def _extract_text(self, response) -> str:
        if response is None:
            return ""

        if hasattr(response, "text") and response.text:
            return response.text

        if hasattr(response, "output_text") and response.output_text:
            return response.output_text

        if hasattr(response, "contents"):
            contents = response.contents
            if isinstance(contents, list) and contents:
                first_content = contents[0]
                if hasattr(first_content, "text") and first_content.text:
                    return first_content.text
                if hasattr(first_content, "output_text") and first_content.output_text:
                    return first_content.output_text
                if isinstance(first_content, dict):
                    return first_content.get("text") or first_content.get("output_text") or ""

        if hasattr(response, "content"):
            content = response.content
            if hasattr(content, "text") and content.text:
                return content.text
            if hasattr(content, "output_text") and content.output_text:
                return content.output_text
            if isinstance(content, dict):
                return content.get("text") or content.get("output_text") or ""

        if hasattr(response, "candidates") and response.candidates:
            first_candidate = response.candidates[0]
            if hasattr(first_candidate, "text") and first_candidate.text:
                return first_candidate.text
            if hasattr(first_candidate, "content"):
                candidate_content = first_candidate.content
                if hasattr(candidate_content, "text") and candidate_content.text:
                    return candidate_content.text
                if isinstance(candidate_content, dict):
                    return candidate_content.get("text") or candidate_content.get("output_text") or ""
            if isinstance(first_candidate, dict):
                return first_candidate.get("text") or first_candidate.get("output_text") or ""

        return str(response) if response else ""

    def _build_model_candidates(self) -> List[str]:
        candidates = []
        if self.requested_model_name:
            candidates.append(self.requested_model_name)
        if self.model_name and self.model_name not in candidates:
            candidates.append(self.model_name)
        for model_name in self.PREFERRED_MODEL_NAMES:
            if model_name not in candidates:
                candidates.append(model_name)

        # Include additionally discovered models to broaden fallback options.
        available_models = self._list_available_models()
        for model in available_models:
            model_name = getattr(model, "name", None)
            if model_name and model_name not in candidates:
                candidates.append(model_name)

        return candidates

    def _try_generate_with_model(self, model_name: str, prompt: str) -> str:
        self.last_error = None
        try:
            response = self.client.models.generate_content(
                model=model_name,
                contents=self._normalize_contents(prompt)
            )
            text = self._extract_text(response)
            if text:
                self.model_name = model_name
            return text
        except Exception as exc:
            self.last_error = str(exc)
            print(f"Gemini API Error with model {model_name}: {exc}")
            return ""

    def _format_offline_summary(self, title: str, body: str) -> str:
        error_text = self.last_error or "Unknown Gemini service error"
        return f"{title}\n\n{body}\n\n> Gemini AI currently unavailable: {error_text}. Showing cached summary instead."

    def _generate_text(self, prompt: str) -> str:
        if not self.client:
            self.last_error = "Gemini client unavailable"
            return ""

        for model_name in self._build_model_candidates():
            text = self._try_generate_with_model(model_name, prompt)
            if text:
                return text

        return ""

    def generate_admin_insights(self, stats: dict) -> str:
        prompt = f"""
        You are the Chief AI Strategy Advisor for McDonald's.
        Below are the current metrics and predictions for our operations:

        - Key Performance Indicators (KPIs):
          * Total Revenue: ${stats.get('total_revenue', 0):,.2f}
          * Total Orders: {stats.get('total_orders', 0)}
          * Active Users: {stats.get('total_users', 0)}

        - Inventory / Operations:
          * Low Stock Items Count: {stats.get('low_stock_count', 0)}
          * Low Stock List: {json.dumps(stats.get('low_stock_items', []))}

        - ML Predictions:
          * Churn Risk: {json.dumps(stats.get('high_churn_risk', []))}
          * Tomorrow's Category Demand Forecast: {json.dumps(stats.get('tomorrow_demand', {}))}
          * Next 7-Day Revenue Projection: {json.dumps(stats.get('seven_day_forecast', []))}
          * Customer Segments Count: {json.dumps(stats.get('segments', {}))}

        Task:
        Provide a concise, executive summary in clean markdown format that includes:
        1. Performance evaluation of revenue and customer segments.
        2. Operational alerts for low stock or churn risk.
        3. Three strategic recommendations based on the ML predictions.

        Stay professional, action-oriented, and branded for McDonald's.
        """

        ai_text = self._generate_text(prompt)
        if ai_text:
            return ai_text

        low_stock_pids = [item.get("product_name") for item in stats.get("low_stock_items", [])]
        low_stock_str = ", ".join(low_stock_pids) if low_stock_pids else "None"

        body = f"""### 🍟 McDonald's Strategic AI Operations Report

#### 📊 Performance Evaluation
Our total revenue is **${stats.get('total_revenue', 0):,.2f}** over **{stats.get('total_orders', 0)} orders**. The customer segments show a healthy mix, but we have customer clusters that require immediate re-engagement to prevent churn.

#### ⚠️ Operational Alerts & Supply Chain
* **Inventory Alerts**: The following items are running below reorder points: **{low_stock_str}**.
* **Customer Churn Warning**: Churn prediction indicates that several high-value accounts are exhibiting low-activity patterns.

#### 🚀 AI Strategic Recommendations
1. **Targeted Loyalty Campaigns**: Send McCafé reward offers to the Occasional Buyer segment.
2. **Predictive Prep**: Increase burger prep rates tomorrow morning based on forecasted demand.
3. **Smart Bundles**: Bundle slow-moving items into a Happy Meal Upgrade promotion.
"""
        return self._format_offline_summary("Gemini AI summary fallback", body)

    def generate_chef_suggestions(self, inventory_alerts: list, tomorrow_demand: dict) -> str:
        prompt = f"""
        You are the McDonald's Kitchen Operations Assistant.
        Current kitchen state:
        - Low stock items: {json.dumps(inventory_alerts)}
        - Forecasted category demand for tomorrow: {json.dumps(tomorrow_demand)}

        Generate a short, actionable list of 3 kitchen alerts:
        1. Which categories to prepare more of.
        2. Ingredients or products to refill immediately.
        3. Efficiency tips for the next shift.
        """

        ai_text = self._generate_text(prompt)
        if ai_text:
            return ai_text

        body = """* **Prep Alert**: Increase burger and drink prep for tomorrow's peak.
* **Refill Warning**: Restock fries immediately if inventory is low.
* **Kitchen Tip**: Group similar fryer orders to reduce oil reuse cycles.
"""
        return self._format_offline_summary("Gemini AI kitchen fallback", body)

    def answer_admin_chat(self, user_message: str, stats: dict) -> str:
        prompt = f"""
        You are "GoldenArches AI", a strategic assistant for McDonald's executives.
        Current metrics:
        - Revenue: ${stats.get('total_revenue', 0):,.2f}
        - Total Orders: {stats.get('total_orders', 0)}
        - Customer Segments: {json.dumps(stats.get('segments', {}))}
        - Tomorrow demand forecast: {json.dumps(stats.get('tomorrow_demand', {}))}

        The admin asks: "{user_message}"
        Answer concisely and suggest business actions.
        """

        ai_text = self._generate_text(prompt)
        if ai_text:
            return ai_text

        if "revenue" in user_message.lower() or "sales" in user_message.lower():
            body = f"Current revenue is ${stats.get('total_revenue', 0):,.2f} across {stats.get('total_orders', 0)} orders. Forecasts show steady demand for burgers tomorrow."
        elif "stock" in user_message.lower() or "inventory" in user_message.lower():
            body = f"There are {stats.get('low_stock_count', 0)} items at or below reorder level. Prioritize restocking high-volume products like fries and beverages."
        else:
            body = f"I see {stats.get('total_orders', 0)} orders processed and a healthy segment mix. Let me know if you want recommendations for promotions or inventory actions."

        return self._format_offline_summary("Gemini AI chat fallback", body)


gemini_service = GeminiAIService()
