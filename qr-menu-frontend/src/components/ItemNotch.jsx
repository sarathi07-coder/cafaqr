import React from 'react';
import { ShoppingBag, ChevronRight, Receipt, Smartphone } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function ItemNotch({ onOpenCart, onOpenActiveBill, onOpenUpiModal }) {
  const { totalItemCount, grandTotal, hasActiveSession, activeOrder, dietaryStats } = useCart();

  // If nothing in cart and no active bill, do not show notch
  if (totalItemCount === 0 && !hasActiveSession) return null;

  const handleBarClick = () => {
    if (totalItemCount > 0 && onOpenCart) {
      onOpenCart();
    } else if (onOpenActiveBill) {
      onOpenActiveBill();
    }
  };

  return (
    <div className="fixed bottom-4 inset-x-0 z-40 max-w-md mx-auto px-4 pointer-events-none transition-all duration-300">
      <div
        onClick={handleBarClick}
        className="pointer-events-auto bg-[#14110E]/95 backdrop-blur-2xl text-white rounded-2xl p-3 shadow-[0_16px_40px_rgba(0,0,0,0.85)] border border-white/15 flex items-center justify-between gap-2.5 animate-slide-up cursor-pointer hover:border-amber-400/50 transition-all active:scale-[0.99] select-none"
      >
        {/* Left Info: Active session or Cart Items */}
        <div className="flex items-center gap-2.5 pl-1 min-w-0">
          {totalItemCount > 0 ? (
            <>
              <div className="relative w-10 h-10 rounded-xl krish-gradient-gold text-stone-950 font-black flex items-center justify-center text-sm shadow-[0_4px_15px_rgba(255,196,0,0.4)] shrink-0">
                <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
                <span className="absolute -top-1.5 -right-1.5 bg-white text-stone-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-stone-950 shadow-md">
                  {totalItemCount}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold leading-tight">
                  <span className="uppercase tracking-wider text-amber-300/90 font-bold">
                    {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
                  </span>
                  {(dietaryStats?.vegCount > 0 || dietaryStats?.nonVegCount > 0) && (
                    <span className="text-[10px] font-medium text-stone-400 truncate">
                      ({dietaryStats.vegCount > 0 ? `${dietaryStats.vegCount} Veg` : ''}
                      {dietaryStats.vegCount > 0 && dietaryStats.nonVegCount > 0 ? ', ' : ''}
                      {dietaryStats.nonVegCount > 0 ? `${dietaryStats.nonVegCount} Non-Veg` : ''})
                    </span>
                  )}
                </div>
                <p className="text-base font-extrabold text-white tracking-tight leading-none mt-0.5 font-mono tabular-nums">
                  ₹{Number(grandTotal || 0).toFixed(2)}
                  <span className="text-[10px] text-stone-400 font-sans font-normal ml-1">(inc. 5% GST)</span>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold leading-tight flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Dining Bill
                </p>
                <p className="text-base font-extrabold text-white tracking-tight leading-none mt-0.5 truncate font-mono tabular-nums">
                  ₹{parseFloat(activeOrder?.total || activeOrder?.total_amount || 0).toFixed(2)}
                  <span className="text-[10px] text-stone-400 font-sans font-normal ml-1">
                    ({activeOrder?.status === 'PENDING' ? 'Cooking Soon' : activeOrder?.status || 'Active'})
                  </span>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Right CTA Buttons */}
        {totalItemCount > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenCart) onOpenCart();
            }}
            className="flex items-center gap-1.5 krish-gradient-gold hover:brightness-110 active:scale-95 text-stone-950 font-black px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all shadow-[0_4px_16px_rgba(255,196,0,0.35)] cursor-pointer shrink-0"
          >
            <span>View Order</span>
            <ChevronRight className="w-4 h-4 stroke-[3]" />
          </button>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenUpiModal && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenUpiModal({
                    amount: parseFloat(activeOrder?.total || activeOrder?.total_amount || 0),
                    orderId: activeOrder?.id
                  });
                }}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold px-3 py-2 rounded-xl text-xs transition-all shadow-[0_4px_16px_rgba(16,185,129,0.3)] cursor-pointer"
                title="Pay Bill via UPI"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Pay UPI</span>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenActiveBill) onOpenActiveBill();
              }}
              className="flex items-center gap-1 krish-gradient-gold hover:brightness-110 active:scale-95 text-stone-950 font-black px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-md"
            >
              <span>View Order</span>
              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
