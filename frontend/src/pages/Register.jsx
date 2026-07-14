import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Lock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { authApi } from '../api';

export default function Register({ onNavigate }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await authApi.register(name, email, password, role);
      setSuccess(true);
      setTimeout(() => onNavigate('login'), 2000);
    } catch (err) { setError(err.message || 'Registration failed.'); }
    finally { setLoading(false); }
  };

  const roles = [
    { key: 'customer', emoji: '🍔', label: 'Customer', desc: 'Order food & earn rewards' },
    { key: 'chef', emoji: '👨‍🍳', label: 'Chef', desc: 'Manage kitchen queue' },
    { key: 'admin', emoji: '💼', label: 'Admin', desc: 'Full platform access' },
  ];

  return (
    <div className="min-h-screen bg-mcd-cream flex items-center justify-center px-5 py-10">
      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <button onClick={()=>onNavigate('landing')} className="w-14 h-14 bg-mcd-red rounded-2xl flex items-center justify-center shadow-lg mx-auto hover:scale-105 transition-transform p-2">
            <img src="/assets/McDonalds-logo-1.png" alt="McDonald's logo" className="w-full h-full object-contain" />
          </button>
          <h1 className="text-2xl sm:text-3xl font-black text-mcd-dark">Create Account</h1>
          <p className="text-sm text-gray-500">Join the McDonald's AI Operations Platform</p>
        </div>

        {error && <div className="bg-red-50 border-2 border-red-200 p-3 rounded-2xl flex items-center gap-3 text-sm text-mcd-red"><AlertTriangle className="w-5 h-5 flex-shrink-0"/>{error}</div>}
        {success && <div className="bg-green-50 border-2 border-green-200 p-3 rounded-2xl flex items-center gap-3 text-sm text-green-700"><ShieldCheck className="w-5 h-5 flex-shrink-0"/>Account created! Redirecting to login...</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label:'Full Name', icon:<User className="w-4 h-4"/>, type:'text', val:name, set:setName, ph:'John Doe' },
            { label:'Email', icon:<Mail className="w-4 h-4"/>, type:'email', val:email, set:setEmail, ph:'john@example.com' },
            { label:'Password', icon:<Lock className="w-4 h-4"/>, type:'password', val:password, set:setPassword, ph:'Min. 8 characters' },
          ].map(f => (
            <div key={f.label} className="space-y-1.5">
              <label className="text-xs font-black text-gray-500 uppercase tracking-wider">{f.label}</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">{f.icon}</div>
                <input type={f.type} required value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} className="w-full border-2 border-gray-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium"/>
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Select Role</label>
            <div className="grid grid-cols-3 gap-3">
              {roles.map(r => (
                <button key={r.key} type="button" onClick={()=>setRole(r.key)} className={`p-3 rounded-2xl text-center border-2 transition-all ${role===r.key?'border-mcd-yellow bg-yellow-50':'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <div className="text-2xl mb-1">{r.emoji}</div>
                  <div className="text-xs font-black text-mcd-dark">{r.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 hidden sm:block">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading||success} className="btn-red w-full py-4 text-base mt-2">
            {loading ? '⏳ Registering...' : '✨ Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Already registered? <button onClick={()=>onNavigate('login')} className="text-mcd-red font-black hover:underline">Sign In</button>
        </p>
      </motion.div>
    </div>
  );
}
