import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, ClipboardList, Package, RefreshCw, AlertTriangle, Play, CheckCircle, LogOut, X } from 'lucide-react';
import { ordersApi, inventoryApi, analyticsApi } from '../api';

export default function ChefDashboard({ token, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [insights, setInsights] = useState('');
  const [loadingO, setLoadingO] = useState(true);
  const [loadingI, setLoadingI] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [restockId, setRestockId] = useState(null);
  const [restockAmt, setRestockAmt] = useState(100);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'inventory' | 'ai' | 'history'
  const [historyView, setHistoryView] = useState('all');

  useEffect(() => { fetchAll(); }, [token]);

  const fetchAll = () => { fetchOrders(); fetchInventory(); fetchInsights(); };

  const normalizeOrderItems = (order) => ({
    ...order,
    items: (order?.items || []).map(item => ({
      ...item,
      product_name: item?.product_name || item?.name || item?.product?.product_name || item?.product?.name || item?.productName || item?.product_name_text || ''
    }))
  });

  const fetchOrders = async () => {
    try {
      setLoadingO(true);
      const [queueData, historyData] = await Promise.all([
        ordersApi.getQueue(token),
        ordersApi.getOrders(token)
      ]);
      const normalizedQueue = Array.isArray(queueData) ? queueData.map(normalizeOrderItems) : [];
      const normalizedHistory = Array.isArray(historyData) ? historyData.map(normalizeOrderItems) : [];
      setOrders(normalizedQueue);
      setOrderHistory(normalizedHistory);
    } catch {} finally { setLoadingO(false); }
  };
  const fetchInventory = async () => {
    try { setLoadingI(true); setInventory(await inventoryApi.getInventory(token)); } catch {} finally { setLoadingI(false); }
  };
  const fetchInsights = async () => {
    try {
      setLoadingAI(true);
      const d = await analyticsApi.getGeminiInsights('chef', token);
      setInsights(d.insights);
    } catch (err) {
      setInsights(err?.message ? `AI error: ${err.message}` : 'AI suggests: Prep extra burgers. Monitor fries stock.');
    } finally {
      setLoadingAI(false);
    }
  };

  const updateStatus = async (id, status) => {
    try { await ordersApi.updateStatus(id, status, token); fetchOrders(); } catch(e) { alert('Update failed: '+e.message); }
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    if (!restockId) return;
    try {
      const cur = inventory.find(i => i.product_id === restockId);
      await inventoryApi.updateStock(restockId, cur.stock_level + parseInt(restockAmt), token);
      setRestockId(null); fetchInventory(); fetchInsights();
    } catch(e) { alert('Restock failed: '+e.message); }
  };

  const pending = orders.filter(o => o.status === 'pending');
  const preparing = orders.filter(o => o.status === 'preparing');
  const completed = orderHistory.filter(o => ['completed', 'closed'].includes(o.status));
  const lowStock = inventory.filter(i => i.stock_level <= i.reorder_point);
  const currency = (value) => `₹${Number(value || 0).toFixed(0)}`;

  const OrderCard = ({ order, next }) => (
    <motion.div layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className={`bg-white rounded-2xl border-2 ${next==='preparing'?'border-orange-200':'border-green-200'} p-4 space-y-3 shadow-sm`}>
      <div className="flex justify-between items-start gap-3">
        <div>
          <p className="font-black text-sm text-mcd-dark">Order #{order.order_id}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{order.order_channel}</p>
        </div>
        <span className="font-black text-sm text-mcd-dark">{currency(order.total_amount)}</span>
      </div>
      <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
        {order.items.map(item => (
          <div key={item.order_item_id} className="flex justify-between text-xs gap-2">
            <span className="font-semibold text-gray-700">{item.product_name}</span>
            <span className="font-black text-mcd-red">×{item.quantity}</span>
          </div>
        ))}
      </div>
      <button onClick={()=>updateStatus(order.order_id, next)} className={`w-full py-2.5 rounded-full font-black text-xs flex items-center justify-center gap-2 transition-all ${next==='preparing'?'bg-mcd-red text-white hover:bg-red-700':'bg-green-500 text-white hover:bg-green-600'}`}>
        {next==='preparing'?<><Play className="w-3.5 h-3.5 fill-current"/>Start Preparing</>:<><CheckCircle className="w-3.5 h-3.5"/>Mark Ready</>}
      </button>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-mcd-cream mobile-bottom-pad">
      {/* Nav */}
      <nav className="bg-mcd-yellow sticky top-0 z-40 shadow-lg border-b border-yellow-600/20">
        <div className="mcd-container px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6">
          <div className="rounded-2xl border border-yellow-600/20 bg-[#f8cf4d] px-3 py-3 sm:px-4 sm:py-4 flex justify-between items-center gap-2 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-mcd-red rounded-full flex items-center justify-center text-xl font-black text-mcd-yellow shadow">🍳</div>
              <div>
                <p className="font-black text-mcd-dark text-sm sm:text-base leading-none">Chef Control Panel</p>
                <p className="text-yellow-700 text-xs sm:text-sm hidden sm:block">Live Kitchen &amp; Inventory</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lowStock.length > 0 && <span className="flex items-center gap-1 bg-mcd-red text-white text-[10px] font-black px-2.5 py-1 rounded-full"><AlertTriangle className="w-3 h-3"/>{lowStock.length} Low</span>}
              <button onClick={fetchAll} className="p-2 bg-white/60 rounded-xl hover:bg-white transition-colors"><RefreshCw className="w-4 h-4 text-mcd-dark"/></button>
              <button onClick={onLogout} className="p-2 text-mcd-dark/70 hover:text-mcd-dark rounded-xl hover:bg-white/60"><LogOut className="w-4 h-4"/></button>
            </div>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="mcd-container px-3 pb-3 mt-3 flex flex-wrap gap-2 sm:hidden">
          {[{id:'queue',label:`Queue (${orders.length})`},{id:'inventory',label:'Inventory'},{id:'ai',label:'AI Tips'},{id:'history',label:'History'}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} className={`flex-1 min-w-[90px] py-2.5 rounded-full text-xs font-black transition-all ${activeTab===t.id?'bg-mcd-dark text-white':'bg-white/40 text-mcd-dark'}`}>{t.label}</button>
          ))}
        </div>
      </nav>

      <div className="mcd-container px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
        <div className="hidden sm:flex flex-wrap gap-2 mb-5">
          {[{id:'queue',label:'Queue'},{id:'inventory',label:'Inventory'},{id:'ai',label:'AI Tips'},{id:'history',label:'History'}].map(tab => (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`px-4 py-2 rounded-full text-sm font-black transition-all ${activeTab===tab.id?'bg-mcd-dark text-white shadow-sm':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'queue' && (
          <div className="hidden sm:grid sm:grid-cols-12 gap-6">
            <div className="sm:col-span-8 space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="section-title flex items-center gap-2"><ClipboardList className="w-5 h-5 text-mcd-red"/>Active Kitchen Queue</h2>
                <span className="tag tag-dark">{orders.length} total</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-mcd-red/30">
                    <span className="w-2.5 h-2.5 rounded-full bg-mcd-red animate-ping"/>
                    <span className="font-black text-sm text-mcd-red uppercase tracking-wider">Pending ({pending.length})</span>
                  </div>
                  {loadingO ? <div className="text-center py-8 text-gray-400 text-sm">Loading...</div> :
                    pending.length === 0 ? <div className="text-center py-12 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-2xl">No pending orders</div> :
                    pending.map(o=><OrderCard key={o.order_id} order={o} next="preparing"/>)
                  }
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-mcd-yellow/60">
                    <span className="w-2.5 h-2.5 rounded-full bg-mcd-yellow animate-pulse"/>
                    <span className="font-black text-sm text-yellow-600 uppercase tracking-wider">Preparing ({preparing.length})</span>
                  </div>
                  {loadingO ? <div className="text-center py-8 text-gray-400 text-sm">Loading...</div> :
                    preparing.length === 0 ? <div className="text-center py-12 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-2xl">Nothing in preparation</div> :
                    preparing.map(o=><OrderCard key={o.order_id} order={o} next="completed"/>)
                  }
                </div>
              </div>
            </div>
            <div className="sm:col-span-4 space-y-5">
              <div className="mcd-card p-4 sm:p-5 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-sm flex items-center gap-2"><ChefHat className="w-5 h-5 text-mcd-red"/>AI Kitchen Tips</h3>
                  <button onClick={fetchInsights} disabled={loadingAI} className="p-1 hover:bg-yellow-200 rounded-lg"><RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loadingAI?'animate-spin':''}`}/></button>
                </div>
                <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-line bg-white/70 p-3 rounded-xl">
                  {loadingAI ? 'Generating kitchen analysis...' : insights}
                </div>
              </div>
              <div className="mcd-card p-4 sm:p-5 space-y-4">
                <h3 className="font-black text-sm flex items-center gap-2 border-b-2 border-gray-100 pb-3"><Package className="w-5 h-5 text-mcd-yellow"/>Inventory Monitor</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {loadingI ? <div className="text-center py-8 text-gray-400 text-sm">Loading stock...</div> :
                    inventory.map(item => {
                      const low = item.stock_level <= item.reorder_point;
                      return (
                        <div key={item.product_id} className={`flex justify-between items-center p-3 rounded-xl border-2 ${low?'bg-red-50 border-red-200':'bg-gray-50 border-gray-100'}`}>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-mcd-dark truncate">{item.product_name}</p>
                            <p className="text-[9px] text-gray-400 uppercase font-semibold">{item.category}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`font-black text-sm ${low?'text-mcd-red':'text-gray-600'}`}>{item.stock_level}</span>
                            <button onClick={()=>{setRestockId(item.product_id);setRestockAmt(100);}} className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${low?'bg-mcd-red text-white border-mcd-red':'bg-gray-200 text-gray-600 border-gray-200 hover:border-mcd-yellow hover:bg-mcd-yellow hover:text-mcd-dark'} transition-all`}>
                              {low?'⚠ Restock':'Restock'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="hidden sm:block">
            <div className="mcd-card p-4 sm:p-5 space-y-4">
              <h3 className="font-black text-sm flex items-center gap-2 border-b-2 border-gray-100 pb-3"><Package className="w-5 h-5 text-mcd-yellow"/>Inventory Monitor</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {loadingI ? <div className="text-center py-8 text-gray-400 text-sm">Loading stock...</div> :
                  inventory.map(item => {
                    const low = item.stock_level <= item.reorder_point;
                    return (
                      <div key={item.product_id} className={`flex justify-between items-center p-3 rounded-xl border-2 ${low?'bg-red-50 border-red-200':'bg-gray-50 border-gray-100'}`}>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-mcd-dark truncate">{item.product_name}</p>
                          <p className="text-[9px] text-gray-400 uppercase font-semibold">{item.category}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`font-black text-sm ${low?'text-mcd-red':'text-gray-600'}`}>{item.stock_level}</span>
                          <button onClick={()=>{setRestockId(item.product_id);setRestockAmt(100);}} className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${low?'bg-mcd-red text-white border-mcd-red':'bg-gray-200 text-gray-600 border-gray-200 hover:border-mcd-yellow hover:bg-mcd-yellow hover:text-mcd-dark'} transition-all`}>
                            {low?'⚠ Restock':'Restock'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="hidden sm:block">
            <div className="mcd-card p-4 sm:p-5 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-black text-sm flex items-center gap-2"><ChefHat className="w-5 h-5 text-mcd-red"/>AI Kitchen Tips</h3>
                <button onClick={fetchInsights} disabled={loadingAI} className="p-1.5 bg-white rounded-lg"><RefreshCw className={`w-3.5 h-3.5 ${loadingAI?'animate-spin':''}`}/></button>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line bg-white/70 p-3 rounded-xl">{loadingAI ? 'Generating tips...' : insights}</p>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="hidden sm:block">
            <div className="mcd-card p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm flex items-center gap-2"><ClipboardList className="w-5 h-5 text-mcd-red"/>Kitchen Order History</h3>
                <span className="tag tag-dark">{completed.length} done</span>
              </div>
              {completed.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-2xl">No completed orders yet</div>
              ) : (
                <div className="space-y-3">
                  {completed.slice().sort((a,b)=>(b.order_id||0)-(a.order_id||0)).map(order => (
                    <div key={order.order_id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-mcd-red">Order #{order.order_id}</p>
                          <p className="text-sm font-semibold text-mcd-dark">{order.order_channel}</p>
                        </div>
                        <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 text-[11px] font-black">{order.status}</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {(order.items || []).map((item, idx) => {
                          const itemName = item.product_name || item.name || item.product?.product_name || item.product?.name || item.productName || item.product_name_text || 'Item';
                          return (
                            <div key={idx} className="flex items-center justify-between text-sm text-gray-700 gap-3">
                              <span className="flex-1">{item.quantity} × {itemName}</span>
                              <span className="font-semibold">{currency(item.line_total || 0)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 border-t border-yellow-100 pt-3 flex items-center justify-between text-sm font-black text-mcd-dark">
                        <span>Total</span>
                        <span>{currency(order.total_amount || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile: tab-based layout */}
        <div className="sm:hidden">
          {activeTab === 'queue' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-mcd-red animate-ping"/><span className="font-black text-sm text-mcd-red">Pending ({pending.length})</span></div>
                {loadingO?<div className="text-center py-6 text-gray-400 text-sm">Loading...</div>:
                  pending.length===0?<div className="text-center py-8 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-2xl">No pending orders</div>:
                  pending.map(o=><OrderCard key={o.order_id} order={o} next="preparing"/>)
                }
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-mcd-yellow animate-pulse"/><span className="font-black text-sm text-yellow-600">Preparing ({preparing.length})</span></div>
                {loadingO?<div className="text-center py-6 text-gray-400 text-sm">Loading...</div>:
                  preparing.length===0?<div className="text-center py-8 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-2xl">Nothing preparing</div>:
                  preparing.map(o=><OrderCard key={o.order_id} order={o} next="completed"/>)
                }
              </div>
            </div>
          )}
          {activeTab === 'inventory' && (
            <div className="mcd-card p-4 space-y-3">
              {loadingI?<div className="text-center py-8 text-gray-400">Loading...</div>:
                inventory.map(item => {
                  const low = item.stock_level <= item.reorder_point;
                  return (
                    <div key={item.product_id} className={`flex justify-between items-center p-3 rounded-xl border-2 ${low?'bg-red-50 border-red-200':'bg-gray-50 border-gray-100'}`}>
                      <div>
                        <p className="text-xs font-black text-mcd-dark">{item.product_name}</p>
                        <p className="text-[9px] text-gray-400 uppercase">{item.category}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-black text-sm ${low?'text-mcd-red':'text-gray-600'}`}>{item.stock_level}</span>
                        <button onClick={()=>{setRestockId(item.product_id);setRestockAmt(100);}} className={`text-[10px] font-black px-2.5 py-1 rounded-full ${low?'bg-mcd-red text-white':'bg-gray-200 text-gray-600'} transition-all`}>{low?'⚠ Restock':'Restock'}</button>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}
          {activeTab === 'ai' && (
            <div className="mcd-card p-4 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-black text-sm flex items-center gap-2"><ChefHat className="w-5 h-5 text-mcd-red"/>AI Kitchen Tips</h3>
                <button onClick={fetchInsights} disabled={loadingAI} className="p-1.5 bg-white rounded-lg"><RefreshCw className={`w-3.5 h-3.5 ${loadingAI?'animate-spin':''}`}/></button>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line bg-white/70 p-3 rounded-xl">{loadingAI?'Generating tips...':insights}</p>
            </div>
          )}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={()=>setHistoryView('all')} className={`px-3 py-2 rounded-full text-xs font-black ${historyView === 'all' ? 'bg-mcd-dark text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>All</button>
                <button onClick={()=>setHistoryView('completed')} className={`px-3 py-2 rounded-full text-xs font-black ${historyView === 'completed' ? 'bg-mcd-dark text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>Completed</button>
              </div>
              {completed.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-2xl">No completed orders yet</div>
              ) : (
                (historyView === 'all' ? completed : completed.filter(order => order.status === 'completed')).map(order => (
                  <div key={order.order_id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-mcd-red">Kitchen Bill • Order #{order.order_id}</p>
                        <p className="text-sm font-semibold text-mcd-dark">{order.order_channel}</p>
                      </div>
                      <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 text-[11px] font-black">{order.status}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {(order.items || []).map((item, idx) => {
                        const itemName = item.product_name || item.name || item.product?.product_name || item.product?.name || item.productName || item.product_name_text || 'Item';
                        return (
                          <div key={idx} className="flex items-center justify-between text-sm text-gray-700 gap-3">
                            <span className="flex-1">{item.quantity} × {itemName}</span>
                            <span className="font-semibold">{currency(item.line_total || 0)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 border-t border-yellow-100 pt-3 flex items-center justify-between text-sm font-black text-mcd-dark">
                      <span>Total</span>
                      <span>{currency(order.total_amount || 0)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Restock Modal */}
      <AnimatePresence>
        {restockId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div initial={{opacity:0}} animate={{opacity:0.5}} exit={{opacity:0}} onClick={()=>setRestockId(null)} className="fixed inset-0 bg-black"/>
            <motion.div initial={{scale:0.85,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.85,opacity:0}} className="bg-white rounded-3xl p-6 w-full max-w-sm z-10 shadow-2xl space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-base">Restock: {inventory.find(i=>i.product_id===restockId)?.product_name}</h3>
                <button onClick={()=>setRestockId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
              </div>
              <form onSubmit={handleRestock} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Add Quantity</label>
                  <input type="number" required min="1" value={restockAmt} onChange={e=>setRestockAmt(e.target.value)} className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-base font-bold"/>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={()=>setRestockId(null)} className="flex-1 py-3 rounded-full border-2 border-gray-200 text-sm font-bold text-gray-600 hover:border-gray-300">Cancel</button>
                  <button type="submit" className="flex-1 btn-yellow py-3 text-sm">Restock ✓</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
