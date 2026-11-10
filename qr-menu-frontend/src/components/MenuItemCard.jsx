import React from 'react';
import { Plus, Minus, Flame, Tag, Sparkles } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function MenuItemCard({ item }) {
  const { cartItems, addItem, updateQuantity } = useCart();
  const cartItem = cartItems[item.id];
  const count = cartItem ? cartItem.quantity : 0;
  const isAvailable = item.is_available !== false && item.available !== false;

  const fallbackImages = {
    'mojito': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500',
    'ice cream': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500',
    'coffee & milk': 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500',
    'juice': 'https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?w=500',
    'fried chicken': 'https://images.unsplash.com/photo-1562967914-608f82629710?w=500',
    'french fries': 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500',
    'sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500',
    'snacks': 'https://images.unsplash.com/photo-1562967914-608f82629710?w=500',
    'bun': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500',
    'maggi': 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500',
    'bread omblate': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500',
    'briyani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500',
    'fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500',
    'noodles': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500',
    'others': 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=500',
    'omblate': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500',
    'starters': 'https://images.unsplash.com/photo-1541529086526-db283c563270?w=500',
    'main course': 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500',
  };

  const categoryKey = (item.category || '').toLowerCase();
  const displayImage = item.photo_url || item.image_url || fallbackImages[categoryKey] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';

  const isVeg = item.is_veg !== undefined
    ? Boolean(item.is_veg)
    : !item.name.toLowerCase().includes('chicken') &&
      !item.name.toLowerCase().includes('mutton') &&
      !item.name.toLowerCase().includes('fish') &&
      !item.name.toLowerCase().includes('meat') &&
      !item.name.toLowerCase().includes('egg') &&
      !item.name.toLowerCase().includes('omblate') &&
      !item.name.toLowerCase().includes('prawn');

  const origPrice = item.original_price ? parseFloat(item.original_price) : null;
  const currentPrice = parseFloat(item.price || 0);
  const hasOffer = origPrice && origPrice > currentPrice;
  const discountPercent = hasOffer ? Math.round(((origPrice - currentPrice) / origPrice) * 100) : 0;
  const isBogo = item.offer_badge?.includes('BUY 1') || categoryKey === 'juice';
  const offerBadgeText = item.offer_badge || (isBogo ? 'BOGO FREE' : hasOffer ? `${discountPercent}% OFF` : null);

  const isSpicy = item.spicy ||
    item.name.toLowerCase().includes('schezwan') ||
    item.name.toLowerCase().includes('peri peri') ||
    item.name.toLowerCase().includes('chilly') ||
    item.name.toLowerCase().includes('chilli');

  return (
    <div className={`group relative krish-glass-card rounded-2xl p-3 sm:p-4 border transition-all duration-300 flex flex-col justify-between hover:translate-y-[-2px] ${
      !isAvailable 
        ? 'opacity-60 border-stone-800' 
        : hasOffer || isBogo
        ? 'border-amber-400/30 hover:border-amber-400/60 shadow-[0_4px_20px_rgba(255,196,0,0.08)]' 
        : 'border-white/10 hover:border-white/20'
    }`}>
      <div>
        {/* Top Image Section with Vignette */}
        <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-stone-900 mb-3 border border-white/5">
          <img
            src={displayImage}
            alt={item.name}
            className={`w-full h-full object-cover transition-transform duration-500 ease-out ${isAvailable ? 'group-hover:scale-108' : 'grayscale'}`}
            loading="lazy"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = fallbackImages[categoryKey] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
            }}
          />

          {/* Vignette Shadow Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-stone-950/30 pointer-events-none" />

          {/* Veg / Non-Veg Official Indicator Dot */}
          <div className="absolute top-2 left-2 bg-stone-950/85 backdrop-blur-md p-1 rounded-md border border-white/10 shadow-md">
            <div className={`w-3.5 h-3.5 border-[1.5px] rounded-xs flex items-center justify-center ${isVeg ? 'border-emerald-500' : 'border-rose-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'}`}></div>
            </div>
          </div>

          {/* Offer / BOGO Ribbon */}
          {offerBadgeText && isAvailable && (
            <div className={`absolute top-2 right-2 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 border border-white/20 ${
              isBogo 
                ? 'bg-gradient-to-r from-red-600 to-amber-500 animate-pulse' 
                : 'bg-gradient-to-r from-amber-500 to-orange-600'
            }`}>
              <Sparkles className="w-2.5 h-2.5 text-yellow-200" />
              <span>{offerBadgeText}</span>
            </div>
          )}

          {/* Spicy Indicator */}
          {!offerBadgeText && isSpicy && (
            <div className="absolute top-2 right-2 bg-rose-600/90 backdrop-blur-xs text-white p-1 rounded-md shadow-md border border-rose-400/30">
              <Flame className="w-3 h-3 text-yellow-300" />
            </div>
          )}

          {/* Out of Stock Overlay */}
          {!isAvailable && (
            <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center">
              <span className="bg-rose-600 text-white font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-lg border border-rose-400">
                Sold Out
              </span>
              <span className="text-[10px] text-stone-400 font-medium mt-1">
                Back soon
              </span>
            </div>
          )}
        </div>

        {/* Dish Title & Description */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-bold text-white text-sm sm:text-base leading-snug group-hover:text-amber-300 transition-colors">
              {item.name}
            </h3>
          </div>
          <p className="text-[11px] text-stone-400 line-clamp-2 leading-relaxed">
            {item.description || 'Prepared fresh with signature authentic ingredients and herbs.'}
          </p>
        </div>
      </div>

      {/* Price & Add Controls */}
      <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-black text-amber-400 font-mono tabular-nums">
              ₹{currentPrice.toFixed(0)}
            </span>
            {hasOffer && (
              <span className="text-xs font-semibold text-stone-500 line-through">
                ₹{origPrice.toFixed(0)}
              </span>
            )}
          </div>
          {isBogo ? (
            <p className="text-[10px] text-amber-300 font-bold">
              Buy 1 Get 1 Free
            </p>
          ) : hasOffer ? (
            <p className="text-[10px] text-emerald-400 font-bold">
              Save ₹{(origPrice - currentPrice).toFixed(0)}
            </p>
          ) : null}
        </div>

        {isAvailable ? (
          count > 0 ? (
            <div className="inline-flex items-center bg-stone-900/90 rounded-xl border border-amber-500/40 p-0.5 shadow-md">
              <button
                type="button"
                onClick={() => updateQuantity(item.id, count - 1)}
                className="w-7 h-7 rounded-lg bg-stone-800 text-stone-200 font-bold hover:bg-stone-700 active:scale-90 flex items-center justify-center transition cursor-pointer"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-7 text-center font-bold text-xs text-amber-300 font-mono">
                {count}
              </span>
              <button
                type="button"
                onClick={() => updateQuantity(item.id, count + 1)}
                className="w-7 h-7 rounded-lg krish-gradient-gold text-stone-950 font-bold hover:brightness-110 active:scale-90 flex items-center justify-center transition cursor-pointer shadow-xs"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => addItem(item)}
              className="inline-flex items-center gap-1 krish-gradient-gold hover:brightness-110 text-stone-950 font-extrabold text-xs px-3.5 py-1.5 rounded-xl transition-all active:scale-95 shadow-[0_2px_10px_rgba(255,196,0,0.3)] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Add</span>
            </button>
          )
        ) : (
          <span className="text-[10px] text-stone-500 font-semibold px-2 py-0.5 rounded-lg bg-stone-900 border border-stone-800">
            Unavailable
          </span>
        )}
      </div>
    </div>
  );
}
