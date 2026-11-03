import React from 'react';
import { UtensilsCrossed, BellRing, ChefHat, LayoutDashboard, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Navbar({
  restaurantName = 'Royal Spice Bistro',
  tableNumber,
  hasActiveSession = false,
  onViewBill,
  onCallWaiter
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs transition-all">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand & Table */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-base md:text-lg text-stone-900 tracking-tight leading-none">
              {restaurantName}
            </h1>
            {tableNumber && (
              <span className="inline-flex items-center gap-1.5 mt-0.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Table #{tableNumber}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {hasActiveSession && onViewBill && (
            <button
              onClick={onViewBill}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 transition active:scale-95 border border-emerald-300 cursor-pointer shadow-xs"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-700" />
              <span>View Bill</span>
            </button>
          )}

          {onCallWaiter && (
            <button
              onClick={onCallWaiter}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-amber-100 hover:text-amber-800 transition active:scale-95 border border-stone-200 cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Call Waiter</span>
            </button>
          )}

          {/* Quick Demo Links */}
          <Link
            to="/kitchen"
            title="Kitchen Display Screen"
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition"
          >
            <ChefHat className="w-4 h-4" />
          </Link>
          <Link
            to="/admin"
            title="Owner Dashboard"
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition"
          >
            <LayoutDashboard className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

