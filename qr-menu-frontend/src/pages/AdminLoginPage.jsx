import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, AlertCircle, ShieldCheck, Phone, MapPin, Eye, EyeOff, KeyRound } from 'lucide-react';
import KrishLogo from '../components/KrishLogo';
import { api } from '../api';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // In-section Reset Admin Password workflow
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetAuthType, setResetAuthType] = useState('current'); // 'current' | 'pin'
  const [resetAuthInput, setResetAuthInput] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetConfirmPass, setResetConfirmPass] = useState('');
  const [resetStatus, setResetStatus] = useState({ error: '', success: '', loading: false });

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

  const handleResetAdminPassword = async (e) => {
    e.preventDefault();
    setResetStatus({ error: '', success: '', loading: true });

    if (resetNewPass.trim().length < 4) {
      setResetStatus({ error: 'New admin password must be at least 4 characters.', success: '', loading: false });
      return;
    }
    if (resetNewPass !== resetConfirmPass) {
      setResetStatus({ error: 'Passwords do not match.', success: '', loading: false });
      return;
    }

    try {
      const payload = resetAuthType === 'current'
        ? { currentPassword: resetAuthInput, newPassword: resetNewPass.trim() }
        : { recoveryPin: resetAuthInput, newPassword: resetNewPass.trim() };

      const res = await api.resetAdminPassword(payload);
      setResetStatus({ error: '', success: res.message || 'Admin password updated!', loading: false });
      setPassword(resetNewPass.trim());
      setResetAuthInput('');
      setResetNewPass('');
      setResetConfirmPass('');

      setTimeout(() => {
        setIsResetMode(false);
        setResetStatus({ error: '', success: '', loading: false });
      }, 1400);
    } catch (err) {
      setResetStatus({ error: err.message || 'Failed to reset admin password', success: '', loading: false });
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
            <KrishLogo size="lg" showMascot={true} showHat={true} subtitle="Cafe & Restaurant" />
            <span className="mt-3 text-[11px] font-black tracking-widest uppercase text-amber-400 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full shadow-inner">
              Manager & Cashier Portal
            </span>
            <p className="text-xs text-stone-400 mt-2">
              {isResetMode
                ? 'Reset your Admin Portal password directly within this portal'
                : 'Sign in to manage live orders, billing receipts, menu rates & UPI settings'}
            </p>
          </div>

          {!isResetMode ? (
            <>
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
                    Admin Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-3.5" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter admin password"
                      className="w-full pl-10 pr-10 py-2.5 bg-stone-900/90 border border-white/10 rounded-xl text-xs text-white placeholder-stone-600 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-3 text-stone-400 hover:text-stone-200 cursor-pointer"
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-1">
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

                <div className="pt-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(true);
                      setResetStatus({ error: '', success: '', loading: false });
                    }}
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Forgot / Reset Admin Password</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <form onSubmit={handleResetAdminPassword} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2 p-1 bg-stone-900 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setResetAuthType('current');
                    setResetAuthInput('');
                  }}
                  className={`py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                    resetAuthType === 'current' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Current Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetAuthType('pin');
                    setResetAuthInput('');
                  }}
                  className={`py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                    resetAuthType === 'pin' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Recovery PIN
                </button>
              </div>

              {resetStatus.error && (
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-300">
                  {resetStatus.error}
                </div>
              )}
              {resetStatus.success && (
                <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs text-emerald-300">
                  {resetStatus.success}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-stone-400 mb-1">
                  {resetAuthType === 'current' ? 'Current Admin Password' : 'Manager Recovery PIN'}
                </label>
                <input
                  type="password"
                  required
                  value={resetAuthInput}
                  onChange={(e) => setResetAuthInput(e.target.value)}
                  placeholder={resetAuthType === 'current' ? 'Enter current admin password' : 'Enter 4-digit recovery PIN'}
                  className="w-full px-3.5 py-2.5 bg-stone-900/90 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-400 mb-1">
                  New Admin Password (min 4 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={resetNewPass}
                  onChange={(e) => setResetNewPass(e.target.value)}
                  placeholder="Enter new admin password"
                  className="w-full px-3.5 py-2.5 bg-stone-900/90 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-400 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={resetConfirmPass}
                  onChange={(e) => setResetConfirmPass(e.target.value)}
                  placeholder="Re-enter new admin password"
                  className="w-full px-3.5 py-2.5 bg-stone-900/90 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false);
                    setResetStatus({ error: '', success: '', loading: false });
                  }}
                  className="flex-1 py-2.5 text-xs font-bold text-stone-300 bg-stone-900 hover:bg-stone-800 rounded-xl border border-white/10 cursor-pointer"
                >
                  Back to Login
                </button>
                <button
                  type="submit"
                  disabled={resetStatus.loading}
                  className="flex-1 py-2.5 text-xs font-black text-stone-950 krish-gradient-gold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {resetStatus.loading ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}

          {/* Security Footer Banner */}
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center text-[11px] text-stone-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Authorized Admin Access Only</span>
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
