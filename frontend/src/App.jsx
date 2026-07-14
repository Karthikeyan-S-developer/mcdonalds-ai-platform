import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import CustomerApp from './pages/CustomerApp';
import ChefDashboard from './pages/ChefDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { ShieldAlert } from 'lucide-react';
import { authApi } from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [view, setView] = useState('landing'); // landing, login, register, dashboard

  useEffect(() => {
    // Check local storage for session
    const storedUser = localStorage.getItem('mcd_user');
    const storedToken = localStorage.getItem('mcd_token');
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
      setView('dashboard');
    }
  }, []);

  const handleLoginSuccess = (userData, accessToken) => {
    setUser(userData);
    setToken(accessToken);
    localStorage.setItem('mcd_user', JSON.stringify(userData));
    localStorage.setItem('mcd_token', accessToken);
    setView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('mcd_user');
    localStorage.removeItem('mcd_token');
    setView('landing');
  };

  // Helper for quick testing/switching roles for demonstration purposes
  const handleSimulateRole = async (role) => {
    if (!user) return;
    const creds = {
      admin: ['admin@mcdonalds.com', 'AdminPass123'],
      chef: ['chef@mcdonalds.com', 'ChefPass123'],
      customer: ['cassandra.murray1@example.com', 'CustomerPass123']
    };
    try {
      const [email, password] = creds[role];
      const data = await authApi.login(email, password);
      setUser(data.user);
      setToken(data.access_token);
      localStorage.setItem('mcd_user', JSON.stringify(data.user));
      localStorage.setItem('mcd_token', data.access_token);
    } catch (e) {
      console.error("Demo Swapper login failed", e);
    }
  };

  const renderDashboard = () => {
    if (!user) return null;
    
    switch (user.role) {
      case 'admin':
        return <AdminDashboard token={token} onLogout={handleLogout} />;
      case 'chef':
        return <ChefDashboard token={token} onLogout={handleLogout} />;
      case 'customer':
        return <CustomerApp user={user} token={token} onLogout={handleLogout} />;
      default:
        return <div className="text-white text-center py-20">Invalid Role Configured.</div>;
    }
  };

  return (
    <div className="relative min-h-screen">
      
      {/* Floating Demo Role Switcher Overlay (Only active when logged in) */}
      {user && (
        <div className="fixed bottom-4 right-4 z-50 bg-white border-2 border-mcd-yellow shadow-2xl px-3 py-2 rounded-2xl flex items-center gap-2">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest hidden sm:block border-r border-gray-200 pr-2">Demo</span>
          {['customer', 'chef', 'admin'].map((r) => (
            <button
              key={r}
              onClick={() => handleSimulateRole(r)}
              className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                user.role === r
                  ? 'bg-mcd-yellow text-mcd-dark'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
              }`}
            >
              {r === 'customer' ? '🍔' : r === 'chef' ? '🍳' : '💼'} <span className="hidden sm:inline">{r}</span>
            </button>
          ))}
        </div>
      )}

      {/* Primary Routing view switcher */}
      {view === 'dashboard' && renderDashboard()}

      {view === 'landing' && (
        <LandingPage onNavigate={(target) => setView(target)} />
      )}

      {view === 'login' && (
        <Login 
          onLoginSuccess={handleLoginSuccess} 
          onNavigate={(target) => setView(target)} 
        />
      )}

      {view === 'register' && (
        <Register onNavigate={(target) => setView(target)} />
      )}
    </div>
  );
}
