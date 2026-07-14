import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ShoppingBag, Trash2, Clock, MapPin, Gift, Star, RefreshCw, ChevronLeft, ChevronRight, LogOut, Plus, Minus, CheckCircle } from 'lucide-react';
import { menuApi, ordersApi, analyticsApi } from '../api';

export default function CustomerApp({ user, token, onLogout }) {
  const [menu, setMenu] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('Mobile App');
  const [cart, setCart] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [gpayLoading, setGpayLoading] = useState(false);
  const [codLoading, setCodLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [deliveredOrderId, setDeliveredOrderId] = useState(null);
  const [currentView, setCurrentView] = useState('browse');
  const gpayUpiId = import.meta.env.VITE_GPAY_UPI_ID || 'your_upi_id@bank';
  const gpayPayeeName = import.meta.env.VITE_GPAY_PAYEE_NAME || "McDonald's";
  const gpayNote = import.meta.env.VITE_GPAY_NOTE || 'McDonalds Order';

  const slides = [
    { image: '/assets/promo_mccafe.png', title: 'Start Your Morning Right ☕', desc: 'Freshly brewed McCafé latte.' },
    { image: '/assets/promo_bigmac.png', title: 'Craving a Classic? 🍔', desc: 'The legendary Big Mac combo.' },
    { image: '/assets/promo_rewards.png', title: 'Earn Golden Rewards 🌟', desc: 'Points on every order.' },
  ];

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => setCurrentSlide(p => (p + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { fetchRecs(); }, [cart]);

  useEffect(() => {
    if (!deliveryMessage) return;
    const timer = setTimeout(() => {
      setDeliveryMessage('');
    }, 3000);
    return () => clearTimeout(timer);
  }, [deliveryMessage]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [m, s, p, o] = await Promise.all([
        menuApi.getMenu().catch(err => { console.error("Menu fetch failed:", err); return []; }),
        menuApi.getStores().catch(err => { console.error("Stores fetch failed:", err); return []; }),
        analyticsApi.getCustomerProfile(token).catch(err => { console.error("Customer profile fetch failed:", err); return null; }),
        ordersApi.getOrders(token).catch(err => { console.error("Orders fetch failed:", err); return []; })
      ]);
      setMenu(m); setStores(s);
      if (s.length) setSelectedStore(s[0].store_id);
      setCustomerProfile(p);
      setCustomerOrders(Array.isArray(o) ? o : []);
    } catch(e) { console.error("fetchData exception:", e); } finally { setLoading(false); }
  };

  const fetchRecs = async () => {
    try { setRecommendations(await analyticsApi.getRecommendations(cart.map(i => i.product_id))); } catch {}
  };

  const addToCart = (p) => setCart(prev => {
    const ex = prev.find(i => i.product_id === p.product_id);
    return ex ? prev.map(i => i.product_id === p.product_id ? {...i, quantity: i.quantity+1} : i) : [...prev, {...p, quantity:1}];
  });

  const updateQty = (id, d) => setCart(prev => prev.map(i => i.product_id===id ? (i.quantity+d>0?{...i,quantity:i.quantity+d}:null):i).filter(Boolean));
  const removeItem = (id) => setCart(prev => prev.filter(i => i.product_id !== id));

  const subtotal = () => cart.reduce((s,i) => s + i.unit_price*i.quantity, 0);
  const discount = () => subtotal() * discountPercent / 100;
  const total = () => subtotal() - discount();

  const applyPromo = () => {
    if (!customerProfile) return;
    const d = customerProfile.deals.find(x => x.code.toUpperCase() === promoCode.trim().toUpperCase());
    if (d) { const p = promoCode.includes('30')?30:promoCode.includes('20')?20:15; setDiscountPercent(p); alert(`✅ ${p}% off applied!`); }
    else alert('❌ Invalid promo code.');
  };

  const placeOrder = async () => {
    const res = await ordersApi.create({ store_id: parseInt(selectedStore), order_channel: selectedChannel, items: cart.map(i=>({product_id:i.product_id,quantity:i.quantity})) }, token);
    confetti({ particleCount:180, spread:90, origin:{y:0.6}, colors:['#DA291C','#FFC72C','#fff'] });
    setCustomerOrders(prev => [res, ...prev.filter(x => x.order_id !== res.order_id)]);
    setCart([]); setOrderSuccess(true);
    setTimeout(() => setOrderSuccess(false), 3000);
    try { setCustomerProfile(await analyticsApi.getCustomerProfile(token)); } catch {}
    return res;
  };

  const handleGPay = async () => {
    if (!cart.length) return;
    if (!gpayUpiId || gpayUpiId.includes('your_')) {
      alert('UPI ID not configured yet. Set VITE_GPAY_UPI_ID in the frontend environment file.');
      return;
    }

    setGpayLoading(true);
    const amount = Number(total()).toFixed(2);
    const params = new URLSearchParams({
      pa: gpayUpiId,
      pn: gpayPayeeName,
      am: amount,
      cu: 'INR',
      tn: gpayNote
    });
    const deepLink = `upi://pay?${params.toString()}`;
    const fallbackUrl = `https://pay.google.com/gp/v1/pay?${params.toString()}`;

    window.location.href = deepLink;
    window.setTimeout(() => {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    }, 300);

    setTimeout(async () => {
      try {
        await placeOrder();
      } catch (e) {
        alert('Order failed: ' + e.message);
      } finally {
        setGpayLoading(false);
      }
    }, 2500);
  };

  const handleCOD = async () => {
    if (!cart.length) return;
    try {
      setCodLoading(true);
      await placeOrder();
    } catch(e) {
      alert('Order failed: ' + e.message);
    } finally {
      setCodLoading(false);
    }
  };

  const cats = ['All', ...new Set(menu.map(i => i.category))];
  const filtered = categoryFilter === 'All' ? menu : menu.filter(i => i.category === categoryFilter);
  const visibleOrders = customerOrders.filter(order => {
    const hidden = order.order_id === deliveredOrderId || ['delivered','closed'].includes(order.status);
    return !hidden && ['pending','preparing','completed'].includes(order.status);
  });
  const step = (s) => ({pending:1,preparing:2,completed:3,closed:4}[s]||0);
  const productNameMap = new Map(menu.map(item => [item.product_id, item.product_name]));
  const currency = (value) => `₹${Number(value || 0).toFixed(0)}`;

  if (loading) return (
    <div className="min-h-screen bg-mcd-cream flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-7xl wiggle">🍟</div>
        <p className="text-2xl font-black text-mcd-red">Loading your order...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-mcd-cream mobile-bottom-pad">
      {/* Sticky Nav */}
      <nav className="bg-mcd-red sticky top-0 z-40 shadow-lg border-b border-red-700/40">
        <div className="mcd-container flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img src="/assets/McDonalds-logo-1.png" alt="McDonald's logo" className="w-10 h-10 sm:w-11 sm:h-11 object-contain rounded-full bg-white/90 p-1.5 shadow-sm" />
            <div className="min-w-0">
              <div className="text-white font-black text-sm sm:text-base leading-none">McDonald's</div>
              <div className="text-yellow-200 text-xs sm:text-sm mt-1 hidden sm:block">Hey, {user.name.split(' ')[0]}! 👋</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {customerProfile && <span className="hidden md:flex items-center gap-1 bg-white/20 text-white px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm"><Star className="w-3 h-3 fill-current"/> {customerProfile.segment}</span>}
            <button onClick={() => setCurrentView('browse')} className={`px-3 py-2 rounded-full text-xs font-black transition-all ${currentView === 'browse' ? 'bg-white text-mcd-red shadow-sm' : 'bg-white/15 text-white hover:bg-white/25'}`}>Order</button>
            <button onClick={() => setCurrentView('bills')} className={`px-3 py-2 rounded-full text-xs font-black transition-all ${currentView === 'bills' ? 'bg-white text-mcd-red shadow-sm' : 'bg-white/15 text-white hover:bg-white/25'}`}>My Bills</button>
            <button onClick={() => document.getElementById('cart-section')?.scrollIntoView({behavior:'smooth'})} className="relative p-2.5 bg-mcd-yellow rounded-xl text-mcd-red shadow-sm">
              <ShoppingBag className="w-5 h-5"/>
              {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-white text-mcd-red text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-mcd-red">{cart.reduce((s,i)=>s+i.quantity,0)}</span>}
            </button>
            <button onClick={onLogout} className="p-2.5 text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/10"><LogOut className="w-5 h-5"/></button>
          </div>
        </div>
      </nav>

      <div className="mcd-container px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8">

        {/* Carousel */}
        <div className="relative overflow-hidden rounded-[28px] border border-[#f2e3b4] bg-white shadow-[0_18px_60px_rgba(218,41,28,0.12)] group h-44 sm:h-64 lg:h-72 mt-1 sm:mt-2">
          <div className="flex h-full transition-transform duration-700" style={{transform:`translateX(-${currentSlide*100}%)`}}>
            {slides.map((s,i) => (
              <div key={i} className="w-full flex-shrink-0 relative">
                <img src={s.image} alt={s.title} className="w-full h-full object-cover"/>
                <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent flex flex-col justify-end p-5 sm:p-8 lg:p-10">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-white/90 backdrop-blur-sm">
                    <Clock className="w-3.5 h-3.5" /> Fresh today
                  </div>
                  <h2 className="mt-3 text-white font-black text-lg sm:text-2xl lg:text-3xl drop-shadow">{s.title}</h2>
                  <p className="mt-1 text-gray-200 text-xs sm:text-sm max-w-xl hidden sm:block">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setCurrentSlide(p=>(p-1+3)%3)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"><ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5"/></button>
          <button onClick={() => setCurrentSlide(p=>(p+1)%3)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight className="w-4 h-4 sm:w-5 sm:h-5"/></button>
          <div className="absolute bottom-3 right-4 flex gap-1.5">
            {slides.map((_,i)=><button key={i} onClick={()=>setCurrentSlide(i)} className={`h-1.5 rounded-full transition-all ${currentSlide===i?'bg-mcd-yellow w-5':'bg-white/50 w-1.5'}`}/>)}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] border border-[#f2e3b4] bg-gradient-to-r from-[#fff8de] via-[#fff4e5] to-[#fffdf7] p-4 sm:p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tag tag-yellow">Smart ordering</span>
              <span className="tag tag-red">Fast pickup</span>
            </div>
            <h3 className="mt-3 text-lg sm:text-xl font-black text-mcd-dark">Your next meal is just a few taps away.</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">Browse the menu, apply your deal, and checkout smoothly with Google Pay or cash on delivery.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-[24px] border border-[#f2e3b4] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-mcd-red"><Clock className="w-4 h-4" /><span className="text-sm font-black">Fast kitchen</span></div>
              <p className="mt-2 text-2xl font-black text-mcd-dark">3 min</p>
              <p className="text-sm text-gray-500">Average prep window</p>
            </div>
            <div className="rounded-[24px] border border-[#f2e3b4] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-mcd-red"><Gift className="w-4 h-4" /><span className="text-sm font-black">AI offers</span></div>
              <p className="mt-2 text-2xl font-black text-mcd-dark">{customerProfile?.deals?.length || 2}</p>
              <p className="text-sm text-gray-500">Personalized deals ready</p>
            </div>
          </div>
        </div>

        {/* Order Tracker */}
        {currentView === 'browse' && (
          <AnimatePresence>
            {visibleOrders.length > 0 && (
              <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className="mcd-card p-4 sm:p-5 lg:p-6 bg-white border-2 border-mcd-yellow space-y-4 mt-1 sm:mt-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-black text-base sm:text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-mcd-red animate-pulse"/> Live Order Tracker</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-2xl">Track your active orders and confirm delivery when they are ready.</p>
                  </div>
                  <button onClick={fetchData} className="flex items-center gap-1 self-start text-xs text-mcd-red border border-mcd-red/30 px-3 py-1.5 rounded-full hover:bg-mcd-red hover:text-white transition-all"><RefreshCw className="w-3 h-3"/> Sync</button>
                </div>
                <div className="space-y-3">
                  {visibleOrders.map((order) => (
                    <div key={order.order_id} className="rounded-2xl border border-yellow-200 bg-mcd-cream/80 p-4 shadow-sm">
                      <div className="flex flex-wrap justify-between gap-3 items-center">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-mcd-red">Order #{order.order_id}</p>
                          <p className="text-sm font-semibold text-mcd-dark">{order.order_channel} • {new Date(order.created_at || order.order_date).toLocaleDateString()}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-black ${order.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-mcd-yellow text-mcd-dark'}`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-4 gap-1.5 sm:gap-2 relative">
                        <div className="absolute top-4 left-8 right-8 h-1 bg-gray-200 z-0">
                          <div className="h-full bg-mcd-yellow transition-all duration-700" style={{width:`${Math.max(0,(step(order.status)-1)*33.3)}%`}}/>
                        </div>
                        {['Placed','Preparing','Ready','Delivered'].map((lbl,i) => {
                          const done = step(order.status) > i; const active = step(order.status) === i+1;
                          return (
                            <div key={i} className="flex flex-col items-center z-10">
                              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-[11px] sm:text-sm border-2 transition-all ${done?'step-done':active?'step-active pulse-ring':'step-pending'}`}>
                                {done ? '✓' : i+1}
                              </div>
                              <span className={`text-[10px] sm:text-xs mt-2 font-bold text-center ${done?'text-mcd-dark':active?'text-mcd-red':'text-gray-400'}`}>{lbl}</span>
                            </div>
                          );
                        })}
                      </div>
                      {order.status === 'completed' && (
                        <div className="mt-4 pt-4 border-t border-yellow-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white/70 p-3 rounded-xl">
                          <span className="text-sm font-bold text-gray-700">🎉 Your meal is ready!</span>
                          <button onClick={async()=>{
                            try {
                              const updatedOrder = await ordersApi.confirmDelivery(order.order_id, token);
                              setCustomerOrders(prev => prev.map(existing => existing.order_id === updatedOrder.order_id ? { ...existing, ...updatedOrder, status: updatedOrder.status || 'delivered' } : existing));
                              setDeliveredOrderId(updatedOrder.order_id);
                              setDeliveryMessage('Order delivered successfully! Thanks for choosing McDonald’s.');
                            } catch (error) {
                              alert('Unable to confirm delivery: ' + error.message);
                            }
                          }} className="btn-yellow text-sm px-5 py-2">Confirm Delivery</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {deliveryMessage && (
                  <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                    {deliveryMessage}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {currentView === 'bills' && (
          <div className="mcd-card p-4 sm:p-5 lg:p-6 bg-white border-2 border-mcd-yellow space-y-4 mt-1 sm:mt-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-black text-base sm:text-lg flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-mcd-red"/> Your Bills</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">A clean bill view for every order you placed.</p>
              </div>
            </div>
            {customerOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-yellow-200 bg-mcd-cream/70 p-6 text-center text-sm text-gray-500">
                No orders yet. Place your first order to see the bill here.
              </div>
            ) : (
              <div className="space-y-3">
                {customerOrders.slice().sort((a,b) => (b.order_id || 0) - (a.order_id || 0)).map((order) => (
                  <div key={order.order_id} className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm">
                    <div className="flex flex-wrap justify-between gap-3 items-center">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-mcd-red">Bill • Order #{order.order_id}</p>
                        <p className="text-sm font-semibold text-mcd-dark">{new Date(order.created_at || order.order_date).toLocaleDateString()} • {order.order_channel}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-black ${order.status === 'closed' ? 'bg-green-100 text-green-700' : 'bg-mcd-yellow text-mcd-dark'}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {(order.items || []).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm text-gray-700">
                          <span>{(item.quantity || 0)} × {productNameMap.get(item.product_id) || item.product_name || 'Item'}</span>
                          <span className="font-semibold">{currency((item.line_total || 0))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 border-t border-yellow-100 pt-3 flex items-center justify-between text-sm font-black text-mcd-dark">
                      <span>Total Paid</span>
                      <span>{currency(order.total_amount || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Deals Banner (mobile: full width row) */}
        {customerProfile && (
          <div className="mcd-card overflow-hidden border-2 border-mcd-yellow/40 bg-gradient-to-r from-[#fff8dc] via-[#fff2df] to-[#ffece2] p-4 sm:p-5 mt-1 sm:mt-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-mcd-red"/>
                <span className="font-black text-sm sm:text-base">AI Deals for you — <span className="text-mcd-red">{customerProfile.segment}</span></span>
              </div>
              <span className="tag tag-red">Personalized</span>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {customerProfile.deals.map((d,i) => (
                <div key={i} className="rounded-[18px] border border-yellow-200 bg-white/90 p-3.5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-sm text-mcd-dark">{d.title}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">{d.description}</p>
                    </div>
                    <button onClick={()=>{setPromoCode(d.code);document.getElementById('cart-section')?.scrollIntoView({behavior:'smooth'});}} className="flex-shrink-0 rounded-full bg-mcd-yellow px-3 py-1.5 text-[11px] font-black text-mcd-dark hover:bg-yellow-400 transition-colors">{d.code}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content: Menu + Cart */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 space-y-6 lg:space-y-0">

          {/* Menu Section */}
          <div className="lg:col-span-8 space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="section-title">🍔 Our Menu</h2>
                <p className="mt-1 text-sm text-gray-500">Choose your favorites and build a fresh order in seconds.</p>
              </div>
              {stores.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-[#f2e3b4] bg-white px-3 py-2 text-xs font-semibold text-gray-600">
                  <MapPin className="w-3.5 h-3.5 text-mcd-red"/>
                  <select value={selectedStore} onChange={e=>setSelectedStore(e.target.value)} className="bg-transparent border-none text-gray-600 text-xs font-semibold cursor-pointer p-0 focus:ring-0">
                    {stores.map(s=><option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-2 overflow-x-auto scrollbar-none pb-1">
              {cats.map(c => <button key={c} onClick={()=>setCategoryFilter(c)} className={`cat-pill ${categoryFilter===c?'active':''}`}>{c}</button>)}
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filtered.map(item => {
                const inCart = cart.find(i=>i.product_id===item.product_id);
                return (
                  <motion.div key={item.product_id} layout className="mcd-card p-4 flex flex-col justify-between bg-[#fffdf8]">
                    <div>
                      <span className="tag tag-yellow">{item.category}</span>
                      <h4 className="font-black text-sm sm:text-base mt-2 text-mcd-dark leading-tight">{item.product_name}</h4>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                      <span className="font-black text-base sm:text-lg text-mcd-dark">₹{(item.unit_price * 83).toFixed(0)}</span>
                      {inCart ? (
                        <div className="flex items-center gap-1 bg-mcd-red rounded-full px-2 py-1">
                          <button onClick={()=>updateQty(item.product_id,-1)} className="text-white w-5 h-5 flex items-center justify-center"><Minus className="w-3 h-3"/></button>
                          <span className="text-white font-black text-sm w-4 text-center">{inCart.quantity}</span>
                          <button onClick={()=>addToCart(item)} className="text-white w-5 h-5 flex items-center justify-center"><Plus className="w-3 h-3"/></button>
                        </div>
                      ) : (
                        <button onClick={()=>addToCart(item)} className="bg-mcd-red text-white font-black text-xs px-3 py-2 rounded-full hover:bg-red-700 transition-colors flex items-center gap-1">
                          <Plus className="w-3 h-3"/> Add
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right sidebar: Store info on desktop */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="mcd-card p-4 sm:p-5 text-center space-y-3 sticky top-24">
              <div className="text-4xl float-anim">🍟</div>
              <h4 className="font-black text-lg">Order Fresh</h4>
              <p className="text-sm text-gray-500">Our predictive kitchen ensures your order is ready in under 3 minutes.</p>
              <div className="bg-mcd-cream border border-yellow-200 rounded-xl p-3 text-left">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Channel</p>
                <select value={selectedChannel} onChange={e=>setSelectedChannel(e.target.value)} className="w-full mt-1 border-none bg-transparent font-bold text-sm p-0 cursor-pointer">
                  {['Dine-In','Drive-Thru','Mobile App','Delivery','Kiosk'].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ───── INLINE CART SECTION ───── */}
        <AnimatePresence>
          {cart.length > 0 && (
            <motion.div id="cart-section" initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} exit={{opacity:0,y:30}} className="mcd-card p-4 sm:p-5 lg:p-6 bg-white border-2 border-mcd-yellow space-y-4 sm:space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-yellow-100 pb-4">
                <div>
                  <h3 className="section-title flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-mcd-red"/> Your Order</h3>
                  <p className="mt-1 text-sm text-gray-500">Review your selections before you checkout.</p>
                </div>
                <span className="tag tag-yellow">{cart.reduce((s,i)=>s+i.quantity,0)} items</span>
              </div>

              {/* Cart Items */}
              <div className="space-y-3">
                {cart.map(item => (
                  <motion.div key={item.product_id} layout className="flex flex-col gap-3 sm:flex-row sm:items-center bg-mcd-cream rounded-xl p-3">
                    <div className="flex-1">
                      <p className="font-black text-sm text-mcd-dark">{item.product_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">₹{(item.unit_price*83).toFixed(0)} each</p>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <div className="flex items-center border-2 border-mcd-yellow rounded-full overflow-hidden">
                        <button onClick={()=>updateQty(item.product_id,-1)} className="px-2 py-1 text-mcd-dark hover:bg-mcd-yellow transition-colors font-black">−</button>
                        <span className="px-2 font-black text-sm">{item.quantity}</span>
                        <button onClick={()=>updateQty(item.product_id,1)} className="px-2 py-1 text-mcd-dark hover:bg-mcd-yellow transition-colors font-black">+</button>
                      </div>
                      <button onClick={()=>removeItem(item.product_id)} className="text-gray-400 hover:text-mcd-red transition-colors"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* AI Recommendations */}
              {recommendations.length > 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-black text-mcd-dark uppercase tracking-wider flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-mcd-yellow fill-current"/> AI also recommends</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {recommendations.map(r => (
                      <div key={r.product_id} className="bg-white rounded-xl border border-yellow-200 p-2.5 text-center">
                        <p className="text-[11px] font-black text-mcd-dark leading-tight">{r.product_name}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">₹{(r.unit_price*83).toFixed(0)}</p>
                        <button onClick={()=>addToCart(r)} className="mt-2 w-full bg-mcd-red text-white text-[10px] font-black py-1 rounded-full hover:bg-red-700 transition-colors">+ Add</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Promo Code */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input type="text" placeholder="🎟 Promo Code" value={promoCode} onChange={e=>setPromoCode(e.target.value)} className="flex-1 border-2 border-gray-200 rounded-full px-4 py-2.5 text-sm font-semibold focus:border-mcd-yellow"/>
                <button onClick={applyPromo} className="bg-mcd-dark text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-gray-800 transition-colors">Apply</button>
              </div>

              {/* Mobile: channel picker */}
              <div className="lg:hidden">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Order Channel</label>
                <select value={selectedChannel} onChange={e=>setSelectedChannel(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold">
                  {['Dine-In','Drive-Thru','Mobile App','Delivery','Kiosk'].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>

              {/* Price Summary */}
              <div className="bg-mcd-cream rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{(subtotal()*83).toFixed(0)}</span></div>
                {discountPercent > 0 && <div className="flex justify-between text-green-600 font-bold"><span>Discount ({discountPercent}%)</span><span>−₹{(discount()*83).toFixed(0)}</span></div>}
                <div className="flex justify-between font-black text-lg text-mcd-dark border-t border-yellow-200 pt-2"><span>Total</span><span>₹{(total()*83).toFixed(0)}</span></div>
              </div>

              {/* GPay Button */}
              <button onClick={handleGPay} disabled={gpayLoading || codLoading} className="gpay-btn">
                {gpayLoading ? (
                  <><RefreshCw className="w-5 h-5 animate-spin"/> Opening Google Pay...</>
                ) : (
                  <>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill="white" opacity="0.1"/>
                      <text x="2" y="17" fill="white" fontSize="11" fontWeight="900" fontFamily="Roboto,Arial">G Pay</text>
                    </svg>
                    <span>Pay ₹{(total()*83).toFixed(0)} with Google Pay</span>
                  </>
                )}
              </button>

              {/* Cash on Delivery Button */}
              <button onClick={handleCOD} disabled={codLoading || gpayLoading} className="w-full flex items-center justify-center gap-2 bg-mcd-yellow hover:bg-yellow-400 text-mcd-dark font-black rounded-full py-4 border-2 border-mcd-yellow transition-all active:scale-98 shadow">
                {codLoading ? (
                  <><RefreshCw className="w-5 h-5 animate-spin"/> Placing Order...</>
                ) : (
                  <>💵 Order Cash on Delivery (Pay at Counter)</>
                )}
              </button>

              <p className="text-center text-xs text-gray-400">🔒 Secured Checkout · Google Pay opens with the configured UPI ID</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Order success toast */}
        <AnimatePresence>
          {orderSuccess && (
            <motion.div initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.8}} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white font-black px-6 py-3 rounded-full shadow-2xl flex items-center gap-2">
              <CheckCircle className="w-5 h-5"/> Order Placed! Tracking above 🎉
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Sticky Bottom Cart Bar for Payment / Scroll down */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-mcd-red text-white py-3 px-3 sm:px-4 shadow-2xl z-45 border-t-4 border-mcd-yellow flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between transition-all duration-300 slide-up">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mcd-yellow rounded-xl text-mcd-red shadow-inner animate-bounce">
              <ShoppingBag className="w-5 h-5"/>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-yellow-200 font-bold uppercase tracking-wider leading-none">Your Meal</p>
              <p className="text-sm sm:text-base font-black mt-1 leading-none">
                {cart.reduce((s,i)=>s+i.quantity,0)} Items • ₹{(total() * 83).toFixed(0)}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button 
              onClick={() => document.getElementById('cart-section')?.scrollIntoView({behavior:'smooth'})} 
              className="bg-white/20 text-white font-extrabold text-[10px] sm:text-xs px-2.5 py-2 rounded-full hover:bg-white/30 transition-all"
            >
              View Cart
            </button>
            <button 
              onClick={handleCOD} 
              disabled={codLoading || gpayLoading} 
              className="bg-white text-mcd-red font-black text-[10px] sm:text-xs px-3.5 py-2 rounded-full flex items-center gap-1 shadow-md hover:bg-gray-100 active:scale-95 transition-all"
            >
              {codLoading ? 'Placing...' : '💵 COD'}
            </button>
            <button 
              onClick={handleGPay} 
              disabled={gpayLoading || codLoading} 
              className="bg-mcd-yellow text-mcd-red font-black text-[10px] sm:text-xs px-3.5 py-2 rounded-full flex items-center gap-1 shadow-md hover:bg-yellow-400 active:scale-95 transition-all"
            >
              {gpayLoading ? 'Paying...' : 'GPay'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
