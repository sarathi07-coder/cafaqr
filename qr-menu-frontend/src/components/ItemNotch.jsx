import React from 'react';
import { ShoppingBag, ChevronRight, Receipt } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function ItemNotch({ onOpenCart, onOpenActiveBill }) {
  const { totalItemCount, grandTotal, hasActiveSession, activeOrder } = useCart();

  // If nothing in cart and no active bill, do not show notch
  if (totalItemCount === 0 && !hasActiveSession) return null;

  return (
    <div className="fixed bottom-4 inset-x-0 z-40 max-w-md mx-auto px-4 pointer-events-none transition-all duration-300">
      <div className="pointer-events-auto bg-stone-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl shadow-stone-950/40 border border-stone-800 flex items-center justify-between gap-3 animate-slide-up">
        
        {/* Left Info: Active session or Cart Items */}
        <div className="flex items-center gap-3 pl-1">
          {totalItemCount > 0 ? (
            <>
              <div className="relative w-10 h-10 rounded-xl bg-amber-500 text-stone-950 font-bold flex items-center justify-center text-sm shadow-md shadow-amber-500/30">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-white text-stone-900 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-stone-900 shadow-xs">
                  {totalItemCount}
                </span>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold leading-tight">
                  {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} in cart
                </p>
                <p className="text-base font-bold text-white tracking-tight leading-none mt-0.5">
                  ₹{grandTotal.toFixed(2)}
                  <span className="text-[10px] text-stone-400 font-normal ml-1">(inc. 5% GST)</span>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold leading-tight">
                  Active Dining Bill
                </p>
                <p className="text-base font-bold text-white tracking-tight leading-none mt-0.5">
                  ₹{parseFloat(activeOrder?.total || activeOrder?.total_amount || 0).toFixed(2)}
                  <span className="text-[10px] text-stone-400 font-normal ml-1">
                    ({activeOrder?.status === 'PENDING' ? 'Forwarded' : activeOrder?.status || 'Active'})
                  </span>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Right CTA Button */}
        {totalItemCount > 0 ? (
          <button
            onClick={onOpenCart}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 font-bold px-4 py-2.5 rounded-xl text-xs md:text-sm transition-all shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <span>View Cart</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onOpenActiveBill}
            className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-200 font-semibold px-4 py-2.5 rounded-xl text-xs md:text-sm transition-all border border-stone-700 cursor-pointer"
          >
            <span>View Bill</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

