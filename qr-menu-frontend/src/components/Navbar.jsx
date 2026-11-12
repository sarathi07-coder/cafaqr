import React from 'react';
import { BellRing, Receipt, Phone, ShoppingBag } from 'lucide-react';
import KrishLogo from './KrishLogo';
import { isParcelTable, formatTableLabel } from '../utils/tableDisplay';

export default function Navbar({
  restaurantName = 'KRISH Cafe & Restaurant',
  tableNumber,
  orderType = '',
  sessionLabel,
  customerName,
  hasActiveSession = false,
  cartItemCount = 0,
  onViewBill,
  onCallWaiter,
  onOpenCart,
}) {
  const hasTableInfo = tableNumber !== undefined && tableNumber !== null && tableNumber !== '';
  const parcelMode = isParcelTable(tableNumber, orderType);

  return (
    <header className="sticky top-0 z-40 bg-[#0B0B0D]/92 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_25px_rgba(0,0,0,0.6)] transition-all">
      <div className="max-w-5xl mx-auto px-4 h-16 sm:h-18 flex items-center justify-between gap-3">
        {/* Brand Logo & Table / Parcel Indicator */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 flex items-center">
            <KrishLogo size="sm" />
          </div>

          {(hasTableInfo || parcelMode) && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold shrink-0 ${
              parcelMode
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                : 'krish-glass-gold border-amber-400/30 text-amber-300'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" />
              <span className="font-mono">
                {parcelMode ? '🛍️ Parcel / Takeaway' : formatTableLabel(tableNumber)}
              </span>
              {sessionLabel && <span className="hidden sm:inline font-normal text-stone-400">&bull; {sessionLabel}</span>}
              {customerName && <span className="hidden md:inline font-normal text-stone-300">({customerName})</span>}
            </div>
          )}
        </div>

        {/* Action Controls & Quick Links */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Tap-to-Call Contact */}
          <a
            href="tel:8760633322"
            title="Call Restaurant: 8760633322"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-stone-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition active:scale-95"
          >
            <Phone className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono">8760633322</span>
          </a>

          {/* Cart / Order Quick Access Button */}
          {cartItemCount > 0 && onOpenCart && (
            <button
              type="button"
              onClick={onOpenCart}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black krish-gradient-gold text-stone-950 transition active:scale-95 shadow-md cursor-pointer animate-pulse"
            >
              <ShoppingBag className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>View Order ({cartItemCount})</span>
            </button>
          )}

          {hasActiveSession && onViewBill && cartItemCount === 0 && (
            <button
              type="button"
              onClick={onViewBill}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 transition active:scale-95 border border-emerald-500/40 cursor-pointer shadow-xs"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-400" />
              <span>View Order</span>
            </button>
          )}

          {onCallWaiter && (
            <button
              type="button"
              onClick={onCallWaiter}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-stone-200 bg-white/5 hover:bg-amber-400/20 hover:text-amber-300 transition active:scale-95 border border-white/10 cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xs:inline">Call Staff</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
