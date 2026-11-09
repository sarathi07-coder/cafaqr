import React from 'react';
import { Plus, Minus, Flame, Tag } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function MenuItemCard({ item }) {
  const { cartItems, addItem, updateQuantity } = useCart();
  const cartItem = cartItems[item.id];
  const count = cartItem ? cartItem.quantity : 0;
  const isAvailable = item.is_available !== false && item.available !== false;

  // Realistic default food photography if custom photo_url is missing
  const fallbackImages = {
    'starters': 'https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=600&q=80',
    'main course': 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80',
    'breads': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
    'desserts': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
    'beverages': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
  };

  const categoryKey = (item.category || '').toLowerCase();
  const displayImage = item.photo_url || item.image_url || fallbackImages[categoryKey] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

  const isVeg = item.is_veg !== undefined
    ? Boolean(item.is_veg)
    : !item.name.toLowerCase().includes('chicken') &&
      !item.name.toLowerCase().includes('mutton') &&
      !item.name.toLowerCase().includes('fish') &&
      !item.name.toLowerCase().includes('meat') &&
      !item.name.toLowerCase().includes('egg') &&
      !item.name.toLowerCase().includes('prawn');

  const origPrice = item.original_price ? parseFloat(item.original_price) : null;
  const currentPrice = parseFloat(item.price || 0);
  const hasOffer = origPrice && origPrice > currentPrice;
  const discountPercent = hasOffer ? Math.round(((origPrice - currentPrice) / origPrice) * 100) : 0;
  const offerBadgeText = item.offer_badge || (hasOffer ? `${discountPercent}% OFF` : null);

  return (
    <div className={`group relative bg-white rounded-2xl p-3 sm:p-4 border transition-all duration-200 flex flex-col justify-between ${
      !isAvailable 
        ? 'border-stone-200 opacity-65 bg-stone-50/50' 
        : hasOffer 
        ? 'border-amber-200/90 shadow-xs hover:shadow-md hover:border-amber-400' 
        : 'border-stone-200/80 shadow-xs hover:shadow-md hover:border-stone-300'
    }`}>
      <div>
        {/* Top Image Section */}
        <div className="relative aspect-16/10 rounded-xl overflow-hidden bg-stone-100 mb-3">
          <img
            src={displayImage}
            alt={item.name}
            className={`w-full h-full object-cover transition-transform duration-300 ${isAvailable ? 'group-hover:scale-105' : 'grayscale-60'}`}
            loading="lazy"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = fallbackImages[categoryKey] || fallbackImages['main course'];
            }}
          />

          {/* Veg / Non-Veg Indicator */}
          <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-xs p-1 rounded-md shadow-xs">
            <div className={`w-3.5 h-3.5 border-2 flex items-center justify-center ${isVeg ? 'border-emerald-600' : 'border-rose-600'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`}></div>
            </div>
          </div>

          {/* Offer Badge Overlay (Top Right) */}
          {offerBadgeText && isAvailable && (
            <div className="absolute top-2.5 right-2.5 bg-linear-to-r from-amber-500 to-rose-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-pulse">
              <Tag className="w-2.5 h-2.5" />
              <span>{offerBadgeText}</span>
            </div>
          )}

          {/* Spice Indicator (if not on offer) */}
          {!offerBadgeText && item.spicy && (
            <div className="absolute top-2.5 right-2.5 bg-rose-500/90 backdrop-blur-xs text-white p-1 rounded-md shadow-xs">
              <Flame className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Out of stock overlay */}
          {!isAvailable && (
            <div className="absolute inset-0 bg-stone-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center">
              <span className="bg-rose-600 text-white font-black text-[11px] uppercase tracking-wider px-3 py-1 rounded-full shadow-lg border border-rose-400">
                Out of Stock
              </span>
              <span className="text-[10px] text-stone-300 font-medium mt-1">
                Currently unavailable
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-stone-900 text-sm sm:text-base leading-snug group-hover:text-amber-800 transition">
              {item.name}
            </h3>
          </div>
          <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
            {item.description || 'Prepared fresh with signature authentic ingredients and herbs.'}
          </p>
        </div>
      </div>

      {/* Price & Add Controls */}
      <div className="mt-4 pt-2 border-t border-stone-100 flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-black text-stone-950">
              ₹{currentPrice.toFixed(0)}
            </span>
            {hasOffer && (
              <span className="text-xs font-semibold text-stone-400 line-through">
                ₹{origPrice.toFixed(0)}
              </span>
            )}
          </div>
          {hasOffer && (
            <p className="text-[10px] text-emerald-600 font-bold">
              Save ₹{(origPrice - currentPrice).toFixed(0)}
            </p>
          )}
        </div>

        {isAvailable ? (
          count > 0 ? (
            <div className="inline-flex items-center bg-amber-50 rounded-xl border border-amber-300 p-0.5 shadow-xs">
              <button
                onClick={() => updateQuantity(item.id, count - 1)}
                className="w-7 h-7 rounded-lg bg-white text-stone-800 font-bold hover:bg-amber-100 active:scale-90 flex items-center justify-center transition shadow-2xs cursor-pointer"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-7 text-center font-bold text-xs text-stone-900">
                {count}
              </span>
              <button
                onClick={() => updateQuantity(item.id, count + 1)}
                className="w-7 h-7 rounded-lg bg-amber-500 text-stone-950 font-bold hover:bg-amber-400 active:scale-90 flex items-center justify-center transition shadow-2xs cursor-pointer"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => addItem(item)}
              className="inline-flex items-center gap-1 bg-stone-900 hover:bg-amber-600 text-white font-semibold text-xs px-3.5 py-1.5 rounded-xl transition active:scale-95 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          )
        ) : (
          <span className="text-xs text-rose-500 font-bold px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200">
            Sold Out
          </span>
        )}
      </div>
    </div>
  );
}
