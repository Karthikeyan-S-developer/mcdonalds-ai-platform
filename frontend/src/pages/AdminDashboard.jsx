import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, DollarSign, Package, MessageSquare, Sparkles, RefreshCw, Send, AlertTriangle, LogOut, ShieldCheck, BrainCircuit, ArrowUpRight, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyticsApi, chatbotApi } from '../api';

const COLORS = ['#FFC72C', '#DA291C', '#3b82f6', '#10b981'];

export default function AdminDashboard({ token, onLogout }) {
  const [kpis, setKpis] = useState(null);
  const [preds, setPreds] = useState(null);
  const [report, setReport] = useState('');
  const [chat, setChat] = useState([{ sender: 'ai', text: "Hello! I’m your McDonald’s Strategic AI. Ask about sales, inventory, churn, or customer segments." }]);
  const [input, setInput] = useState('');
  const [loadingK, setLoadingK] = useState(true);
  const [loadingP, setLoadingP] = useState(true);
  const [loadingR, setLoadingR] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const chatEnd = useRef(null);

  useEffect(() => { fetchAll(); }, [token]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchAll();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [token]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

  const fetchAll = () => { fetchKpis(); fetchPreds(); fetchReport(); };

  const fetchKpis = async () => {
    try { setLoadingK(true); setKpis(await analyticsApi.getKpis(token)); } catch {} finally { setLoadingK(false); }
  };

  const fetchPreds = async () => {
    try { setLoadingP(true); setPreds(await analyticsApi.getMlPredictions(token)); } catch {} finally { setLoadingP(false); }
  };

  const fetchReport = async () => {
    try {
      setLoadingR(true);
      const d = await analyticsApi.getGeminiInsights('admin', token);
      setReport(d.insights);
    } catch {
      setReport('AI insights unavailable. Check backend connection.');
    } finally {
      setLoadingR(false);
    }
  };

  const sendChat = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const msg = input;
    setInput('');
    setChat((p) => [...p, { sender: 'user', text: msg }]);
    setSendingChat(true);
    try {
      const r = await chatbotApi.sendMessage(msg, token);
      setChat((p) => [...p, { sender: 'ai', text: r.response }]);
    } catch {
      setChat((p) => [...p, { sender: 'ai', text: "Sorry, I couldn't reach the AI advisor." }]);
    } finally {
      setSendingChat(false);
    }
  };

  const segData = preds ? Object.entries(preds.segments || {}).map(([name, value]) => ({ name, value })) : [];
  const demandData = preds ? Object.entries(preds.tomorrow_demand || {}).map(([category, count]) => ({ category, count })) : [];

  const kpiCards = kpis ? [
    { label: 'Total Revenue', value: `$${(kpis.total_revenue || 0).toLocaleString()}`, icon: <DollarSign className="w-5 h-5" />, tone: 'text-yellow-500', bg: 'bg-yellow-500/10', accent: 'from-yellow-500/20 to-transparent' },
    { label: 'Total Orders', value: (kpis.total_orders || 0).toLocaleString(), icon: <TrendingUp className="w-5 h-5" />, tone: 'text-red-400', bg: 'bg-red-500/10', accent: 'from-red-500/20 to-transparent' },
    { label: 'Total Users', value: (kpis.total_users || 0).toLocaleString(), icon: <Users className="w-5 h-5" />, tone: 'text-sky-400', bg: 'bg-sky-500/10', accent: 'from-sky-500/20 to-transparent' },
    { label: 'Low Stock Items', value: kpis.low_stock_count || 0, icon: <Package className="w-5 h-5" />, tone: 'text-emerald-400', bg: 'bg-emerald-500/10', accent: 'from-emerald-500/20 to-transparent' },
  ] : [];

  const forecastRows = preds?.seven_day_forecast || [];
  const churnList = preds?.high_churn_risk || [];

  return (
    <div className="min-h-screen bg-[#0f0f10] text-white">
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#121212]/90 backdrop-blur">
        <div className="mcd-container flex items-center justify-between py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <img src="/assets/McDonalds-logo-1.png" alt="McDonald's logo" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 object-contain p-1.5 shadow-lg shadow-red-950/50" />
            <div>
              <p className="text-sm font-black leading-none sm:text-base">Admin Executive Suite</p>
              <p className="hidden text-xs text-gray-400 sm:block">Corporate BI • AI Operations • Growth Command Center</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchAll} className="rounded-xl border border-white/10 bg-white/5 p-2.5 transition hover:bg-white/10"><RefreshCw className="h-4 w-4" /></button>
            <button onClick={onLogout} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-300 transition hover:border-mcd-red hover:text-white">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="mcd-container space-y-5 py-5 sm:space-y-6 sm:py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#1d1d1d] via-[#171717] to-[#121212] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-mcd-yellow/30 bg-mcd-yellow/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-mcd-yellow">
                <ShieldCheck className="h-3.5 w-3.5" /> Live command center
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Run the business with fast, polished insight.</h1>
              <p className="mt-2 text-sm leading-6 text-gray-400 sm:text-[15px]">Track revenue, monitor demand, review AI forecast signals, and stay ahead of churn from one premium dashboard.</p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-sm">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-300"><Activity className="h-4 w-4 text-emerald-400" /> System health</div>
                <p className="mt-2 text-xl font-black text-white">Stable</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-300"><BrainCircuit className="h-4 w-4 text-mcd-yellow" /> AI status</div>
                <p className="mt-2 text-xl font-black text-white">Ready</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {loadingK ? Array(4).fill(0).map((_, i) => <div key={i} className="dark-card h-24 animate-pulse" />) : kpiCards.map((card, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className={`dark-card relative overflow-hidden p-4 sm:p-5 ${card.bg}`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${card.accent}`} />
              <div className="relative flex items-center gap-3">
                <div className={`rounded-2xl border border-white/10 p-2.5 ${card.bg} ${card.tone}`}>
                  {card.icon}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.24em] text-gray-400">{card.label}</p>
                  <p className="mt-1 text-lg font-black text-white sm:text-xl">{card.value}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="dark-card p-5 sm:p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">Revenue pulse</p>
                <h3 className="text-sm font-black text-white">Last 30 days trend</h3>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-400">+12.4%</div>
            </div>
            <div className="h-72">
              {loadingK ? <div className="flex h-full items-center justify-center text-sm text-gray-600">Loading chart...</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={kpis?.revenue_trend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis stroke="#666" tick={{ fontSize: 10 }} width={50} />
                    <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#2a2a2a', fontSize: 12 }} formatter={(value) => `$${Number(value).toLocaleString()}`} />
                    <Line type="monotone" dataKey="revenue" stroke="#FFC72C" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="dark-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">Customer segments</p>
                <h3 className="text-sm font-black text-white">RFM distribution</h3>
              </div>
              <div className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold text-gray-400">Live</div>
            </div>
            <div className="h-56">
              {loadingP ? <div className="flex h-full items-center justify-center text-sm text-gray-600">Calculating...</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={segData} cx="50%" cy="50%" innerRadius={54} outerRadius={78} paddingAngle={3} dataKey="value">
                      {segData.map((_, i) => <Cell key={i} fill={COLORS[i % 4]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#2a2a2a', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {!loadingP && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {segData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl bg-white/5 px-2.5 py-2 text-[10px] text-gray-400">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % 4] }} />
                    <span className="truncate">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="dark-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-mcd-yellow" />
                <h3 className="text-sm font-black uppercase tracking-[0.24em] text-mcd-yellow">Gemini AI report</h3>
              </div>
              <button onClick={fetchReport} disabled={loadingR} className="rounded-lg p-1.5 hover:bg-white/10"><RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${loadingR ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="max-h-80 overflow-y-auto whitespace-pre-line rounded-2xl border border-white/10 bg-[#111111] p-4 text-sm leading-7 text-gray-300">
              {loadingR ? 'Asking Gemini...' : report}
            </div>
          </div>

          <div className="dark-card flex h-[420px] flex-col p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-mcd-yellow" />
              <h3 className="text-sm font-black uppercase tracking-[0.24em] text-white">Strategic AI chat</h3>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
              {chat.map((m, i) => (
                <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 leading-6 ${m.sender === 'user' ? 'rounded-tr-none bg-mcd-red text-white' : 'rounded-tl-none bg-white/10 text-gray-300'}`}>{m.text}</div>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
            <form onSubmit={sendChat} className="mt-3 flex gap-2 border-t border-white/10 pt-3">
              <input value={input} onChange={(e) => setInput(e.target.value)} disabled={sendingChat} placeholder="Ask about sales, stock, or churn..." className="flex-1 rounded-xl border border-white/10 bg-[#111111] px-4 py-2.5 text-sm text-white placeholder-gray-500" />
              <button type="submit" disabled={sendingChat || !input.trim()} className="rounded-xl bg-mcd-yellow p-2.5 text-mcd-dark transition hover:bg-yellow-400">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="dark-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">Forecast</p>
                <h3 className="text-sm font-black text-white">7-day sales outlook</h3>
              </div>
              <div className="rounded-full border border-mcd-yellow/25 bg-mcd-yellow/10 px-3 py-1 text-[11px] font-black text-mcd-yellow">ML model</div>
            </div>
            {loadingP ? <div className="py-8 text-center text-sm text-gray-600">Running forecast...</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[11px] font-black uppercase tracking-[0.24em] text-gray-500">
                      <th className="pb-2">Day</th>
                      <th className="pb-2">Date</th>
                      <th className="pb-2 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecastRows.map((row, i) => (
                      <tr key={i} className="border-b border-white/5 text-sm text-gray-300 last:border-none">
                        <td className="py-3 font-semibold">{row.day_name}</td>
                        <td className="py-3 text-gray-500">{row.date}</td>
                        <td className="py-3 text-right font-black text-mcd-yellow">${Number(row.predicted_revenue || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="dark-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">Retention</p>
                <h3 className="text-sm font-black text-white">Churn risk watchlist</h3>
              </div>
              <div className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-[11px] font-black text-red-400">Urgent</div>
            </div>
            {loadingP ? <div className="py-8 text-center text-sm text-gray-600">Analyzing customers...</div> : (
              <div className="space-y-3">
                {churnList.length === 0 ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center text-sm text-emerald-400">No critical churn risks detected.</div> : churnList.map((customer) => (
                  <div key={customer.customer_id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{customer.name}</p>
                      <p className="truncate text-xs text-gray-500">{customer.email}</p>
                    </div>
                    <div className="ml-3 text-right">
                      <p className="text-sm font-black text-red-400">{customer.churn_probability}%</p>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500">Risk</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dark-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">Demand intelligence</p>
              <h3 className="text-sm font-black text-white">Tomorrow’s category demand forecast</h3>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-mcd-yellow/25 bg-mcd-yellow/10 px-3 py-1 text-[11px] font-black text-mcd-yellow">
              <ArrowUpRight className="h-3.5 w-3.5" /> Growth ready
            </div>
          </div>
          <div className="h-64">
            {loadingP ? <div className="flex h-full items-center justify-center text-sm text-gray-600">Predicting demand...</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demandData} margin={{ top: 8, right: 10, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="category" stroke="#666" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#666" tick={{ fontSize: 10 }} width={45} />
                  <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#2a2a2a', fontSize: 12 }} />
                  <Bar dataKey="count" fill="#FFC72C" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
