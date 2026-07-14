import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Cpu, LayoutDashboard, ShoppingCart, Sparkles, ChefHat, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LandingPage({ onNavigate }) {
  const features = [
    { icon: <ShoppingCart className="w-6 h-6"/>, color: 'text-mcd-red', bg: 'bg-red-50', title: 'Customer App', desc: 'Personalized menu, AI deals, live order tracking & Google Pay checkout.' },
    { icon: <ChefHat className="w-6 h-6"/>, color: 'text-yellow-600', bg: 'bg-yellow-50', title: 'Chef Dashboard', desc: 'Live order queue, inventory alerts & AI prep suggestions.' },
    { icon: <LayoutDashboard className="w-6 h-6"/>, color: 'text-green-600', bg: 'bg-green-50', title: 'Admin Suite', desc: 'Sales analytics, ML forecasting, churn detection & Gemini AI chat.' },
  ];

  return (
    <div className="min-h-screen bg-mcd-cream flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 left-0 h-64 w-64 rounded-full bg-mcd-yellow/25 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-mcd-red/10 blur-3xl" />
      </div>

      <header className="relative z-10 mcd-container pt-6 pb-4 sm:pt-8 sm:pb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/assets/McDonalds-logo-1.png" alt="McDonald's logo" className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-lg bg-white/90 p-1 shadow shrink-0" />
          <div className="min-w-0">
            <div className="text-lg sm:text-xl font-black text-mcd-dark">GoldenArches</div>
            <div className="text-[11px] font-black uppercase tracking-[0.3em] text-mcd-red">AI Platform</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onNavigate('login')} className="circle-action-btn circle-action-btn-ghost" aria-label="Login" title="Login">
            🔐
          </button>
          <button onClick={() => onNavigate('register')} className="circle-action-btn circle-action-btn-red" aria-label="Register" title="Register">
            ✍️
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-grow mcd-container py-8 sm:py-14 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-center">
          <motion.div initial={{opacity:0,x:-30}} animate={{opacity:1,x:0}} transition={{duration:0.6}} className="space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-white/80 border border-[#f2e3b4] text-yellow-700 text-xs font-black px-4 py-2 rounded-full uppercase tracking-[0.25em] shadow-sm">
              <Sparkles className="w-3.5 h-3.5"/> Next-Gen Restaurant AI Platform
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black text-mcd-dark leading-[1.05] tracking-tight">
              I'm Lovin'<br/>
              <span className="text-mcd-red">AI-Powered</span><br/>
              <span className="text-mcd-yellow">Operations</span>
            </h1>
            <p className="text-gray-600 text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-8">
              Run your restaurant with predictive kitchen planning, smart inventory, personalized offers, and a beautiful experience for customers, chefs, and admins.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start w-full sm:w-auto">
              <button onClick={() => onNavigate('register')} className="btn-red text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto">Get Started <ArrowRight className="w-4 h-4" /></button>
              <button onClick={() => onNavigate('login')} className="btn-yellow text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto">Sign In</button>
            </div>
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start pt-2">
              <span className="hero-stat-pill"><CheckCircle2 className="w-4 h-4" /> 5 AI models</span>
              <span className="hero-stat-pill"><CheckCircle2 className="w-4 h-4" /> 3 role views</span>
              <span className="hero-stat-pill"><CheckCircle2 className="w-4 h-4" /> Gemini insights</span>
            </div>
          </motion.div>

          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} transition={{duration:0.7}} className="relative mx-auto w-full max-w-xl">
            <div className="rounded-[32px] border border-[#f2e3b4] bg-white/80 p-3 shadow-[0_24px_80px_rgba(218,41,28,0.14)] backdrop-blur">
              <div className="relative overflow-hidden rounded-[24px] border border-yellow-200">
                <img src="/assets/hero_banner.png" alt="McDonald's AI" className="w-full h-auto object-cover aspect-[4/3]"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-white backdrop-blur-sm">
                    <Sparkles className="w-3.5 h-3.5" /> Live AI operations
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="tag tag-yellow">Predictive kitchen</span>
                    <span className="tag tag-red">Smart inventory</span>
                    <span className="tag tag-dark">Fast checkout</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 sm:-bottom-6 sm:-left-6 bg-white shadow-xl rounded-2xl p-3 sm:p-4 flex items-center gap-3 border-2 border-yellow-200 bounce-in">
              <div className="p-2 bg-yellow-100 rounded-xl text-yellow-600"><Cpu className="w-5 h-5"/></div>
              <div><p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.25em]">ML Engine</p><p className="font-black text-sm">5 Models Active</p></div>
            </div>
            <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 bg-mcd-red shadow-xl rounded-2xl p-3 sm:p-4 flex items-center gap-2 bounce-in" style={{animationDelay:'0.2s'}}>
              <ShieldCheck className="w-5 h-5 text-white"/>
              <p className="font-black text-sm text-white">JWT Secured</p>
            </div>
          </motion.div>
        </div>

        <div className="mt-16 sm:mt-24">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#f2e3b4] bg-white/70 px-3 py-1.5 text-xs font-black uppercase tracking-[0.25em] text-mcd-red">
              <Sparkles className="w-3.5 h-3.5" /> One platform for every role
            </div>
            <h2 className="mt-4 text-2xl sm:text-3xl font-black text-mcd-dark">Everything your restaurant team needs, beautifully organized.</h2>
          </div>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-5">
            {features.map((f,i) => (
              <motion.div key={i} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.15}} className="mcd-card p-6 space-y-3">
                <div className={`w-12 h-12 ${f.bg} ${f.color} rounded-2xl flex items-center justify-center`}>{f.icon}</div>
                <h3 className="font-black text-lg text-mcd-dark">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t-2 border-yellow-100 py-6 text-center text-xs text-gray-400 font-semibold">
        <div className="mcd-container">© 2026 McDonald's AI Operations Platform. All rights reserved.</div>
      </footer>
    </div>
  );
}
