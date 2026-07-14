import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Mail, AlertTriangle } from 'lucide-react';
import { authApi } from '../api';

export default function Login({ onLoginSuccess, onNavigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await authApi.login(email, password);
      onLoginSuccess(data.user, data.access_token);
    } catch (err) { setError(err.message || 'Invalid email or password.'); }
    finally { setLoading(false); }
  };

  const quickFill = (role) => {
    const creds = { admin: ['admin@mcdonalds.com','AdminPass123'], chef: ['chef@mcdonalds.com','ChefPass123'], customer: ['cassandra.murray1@example.com','CustomerPass123'] };
    setEmail(creds[role][0]); setPassword(creds[role][1]);
  };

  return (
    <div className="min-h-screen bg-mcd-cream flex">
      {/* Left decorative panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-2/5 bg-mcd-red flex-col items-center justify-center p-12 space-y-6">
        <img src="/assets/McDonalds-logo-1.png" alt="McDonald's logo" className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-2xl float-anim" />
        <h2 className="text-white font-black text-3xl text-center">I'm Lovin' AI</h2>
        <p className="text-red-200 text-center text-sm">McDonald's intelligent operations platform powered by machine learning.</p>
        <div className="grid grid-cols-3 gap-3 w-full mt-4">
          {['Admin','Chef','Customer'].map((r,i) => (
            <div key={i} className="bg-white/10 rounded-xl p-3 text-center text-white text-xs font-bold">{r}</div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10">
        <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} className="w-full max-w-md space-y-7">
          <div className="text-center space-y-2">
            <button onClick={()=>onNavigate('landing')} className="w-14 h-14 bg-mcd-red rounded-2xl flex items-center justify-center shadow-lg mx-auto hover:scale-105 transition-transform p-2">
              <img src="/assets/McDonalds-logo-1.png" alt="McDonald's logo" className="w-full h-full object-contain" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-black text-mcd-dark">Welcome back!</h1>
            <p className="text-sm text-gray-500">Sign in to your McDonald's platform</p>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 p-3 rounded-2xl flex items-center gap-3 text-sm text-mcd-red">
              <AlertTriangle className="w-5 h-5 flex-shrink-0"/> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" className="w-full border-2 border-gray-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium"/>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" className="w-full border-2 border-gray-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium"/>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-yellow w-full py-4 text-base mt-2">
              {loading ? '⏳ Signing in...' : '🚀 Sign In'}
            </button>
          </form>

          <div className="space-y-3">
            <p className="text-xs font-black text-center text-gray-400 uppercase tracking-wider">Quick Demo Login</p>
            <div className="grid grid-cols-3 gap-2">
              {[['💼','admin','Admin'],['🍳','chef','Chef'],['🍔','customer','Customer']].map(([emoji,role,label]) => (
                <button key={role} onClick={()=>quickFill(role)} className="py-2.5 rounded-2xl text-xs font-black border-2 border-gray-200 bg-white hover:border-mcd-yellow hover:bg-yellow-50 text-gray-700 transition-all">
                  {emoji} {label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-sm text-gray-500">
            No account? <button onClick={()=>onNavigate('register')} className="text-mcd-red font-black hover:underline">Register here</button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
