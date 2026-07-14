const API_BASE_URL = "http://localhost:8000";

const apiRequest = async (endpoint, method = "GET", body = null, token = null) => {
  const headers = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Something went wrong");
    }
    return await response.json();
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
};

export const authApi = {
  login: (email, password) => apiRequest("/api/auth/login", "POST", { email, password }),
  register: (name, email, password, role) => apiRequest("/api/auth/register", "POST", { name, email, password, role }),
  me: (token) => apiRequest("/api/auth/me", "GET", null, token),
};

export const menuApi = {
  getMenu: () => apiRequest("/api/menu"),
  getStores: () => apiRequest("/api/stores"),
};

export const ordersApi = {
  create: (orderData, token) => apiRequest("/api/orders", "POST", orderData, token),
  getOrders: (token) => apiRequest("/api/orders", "GET", null, token),
  getQueue: (token) => apiRequest("/api/orders/queue", "GET", null, token),
  updateStatus: (orderId, status, token) => apiRequest(`/api/orders/${orderId}/status?new_status=${status}`, "PUT", null, token),
  confirmDelivery: (orderId, token) => apiRequest(`/api/orders/${orderId}/confirm`, "POST", null, token),
};

export const inventoryApi = {
  getInventory: (token) => apiRequest("/api/inventory", "GET", null, token),
  updateStock: (productId, stockLevel, token) => apiRequest(`/api/inventory/${productId}`, "PUT", { stock_level: stockLevel }, token),
  getLowStock: (token) => apiRequest("/api/inventory/low-stock", "GET", null, token),
};

export const analyticsApi = {
  getKpis: (token) => apiRequest("/api/analytics/kpis", "GET", null, token),
  getMlPredictions: (token) => apiRequest("/api/analytics/ml-predictions", "GET", null, token),
  getGeminiInsights: (role, token) => apiRequest(`/api/analytics/gemini-insights?role=${role}`, "GET", null, token),
  getRecommendations: (productIds) => {
    if (!productIds || productIds.length === 0) return Promise.resolve([]);
    const query = productIds.map(id => `product_id=${id}`).join('&');
    return apiRequest(`/api/analytics/recommendations?${query}`);
  },
  getCustomerProfile: (token) => apiRequest("/api/analytics/customer-profile", "GET", null, token),
};

export const chatbotApi = {
  sendMessage: (message, token) => apiRequest("/api/chatbot/message", "POST", { message }, token),
};
