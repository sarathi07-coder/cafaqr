import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, AlertCircle, ShieldCheck, Phone, MapPin } from 'lucide-react';
import KrishLogo from '../components/KrishLogo';
import { api } from '../api';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('supersecret');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await api.adminLogin(username, password);
      localStorage.setItem('qr_admin_token', res.token);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Invalid manager credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-stone-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-amber-500/10 via-orange-600/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-72 h-72 bg-emerald-500/5 rounded-full blur-2xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Card */}
        <div className="krish-glass-card p-7 sm:p-8 rounded-3xl relative overflow-hidden">
          {/* Subtle top golden line */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <KrishLogo size="lg" showHat={true} subtitle="Cafe & Restaurant" />
            <span className="mt-3 text-[11px] font-black tracking-widest uppercase text-amber-400 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full shadow-inner">
              Manager & Cashier Portal
            </span>
            <p className="text-xs text-stone-400 mt-2">
              Sign in to manage live orders, kitchen display, menu rates & UPI billing
            </p>
          </div>

          {error && (
            <div className="p-3 mb-5 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-xs text-rose-300 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-stone-400 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-stone-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-900/90 border border-white/10 rounded-xl text-xs text-white placeholder-stone-600 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-stone-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-900/90 border border-white/10 rounded-xl text-xs text-white placeholder-stone-600 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 krish-gradient-gold text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Enter Manager Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick info / credentials banner */}
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-stone-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Cloudflare D1 Verified</span>
            </span>
            <span className="text-amber-300 font-mono text-[10px]">
              admin / supersecret
            </span>
          </div>
        </div>

        {/* Footer Restaurant Info */}
        <div className="mt-5 text-center text-xs text-stone-400 space-y-1">
          <p className="font-semibold text-stone-300">KRISH Cafe & Restaurant</p>
          <p className="flex items-center justify-center gap-1 text-[11px]">
            <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Rathinam College Front Gate, Eachanari, Coimbatore</span>
          </p>
          <p className="flex items-center justify-center gap-1 text-[11px]">
            <Phone className="w-3 h-3 text-amber-400 shrink-0" />
            <a href="tel:8760633322" className="text-amber-400 hover:underline font-mono">
              8760633322
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
