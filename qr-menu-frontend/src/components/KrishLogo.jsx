import React from 'react';

/**
 * KRISH Cafe & Restaurant Official Brand Logo Component
 * - Displays the transparent PNG extracted from the original branding
 * - Includes vector SVG fallback with the chef hat, bold KRISH wordmark,
 *   yellow brush ribbon with 'Cafe & Restaurant' script, and emerald leaves.
 */
export default function KrishLogo({
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  showTagline = false,
  taglineText = 'Taste the Happiness',
  className = '',
  linkTo = null
}) {
  const heightMap = {
    sm: 'h-10',
    md: 'h-14',
    lg: 'h-20',
    xl: 'h-28'
  };

  const selectedHeight = heightMap[size] || size;

  const content = (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Glow ambient highlight behind logo */}
        <div className="absolute -inset-2 bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-red-500/20 rounded-full blur-md opacity-70 pointer-events-none" />
        
        {/* Logo Image */}
        <img
          src="/krish_logo.png"
          alt="KRISH Cafe & Restaurant"
          className={`${selectedHeight} w-auto object-contain drop-shadow-[0_4px_16px_rgba(255,196,0,0.35)] relative z-10 transition-transform duration-300 hover:scale-105`}
          onError={(e) => {
            // If image fails, fallback to styled SVG
            e.target.style.display = 'none';
            const fallback = e.target.nextElementSibling;
            if (fallback) fallback.style.display = 'flex';
          }}
        />

        {/* Scalable SVG Vector Fallback (Hidden unless PNG fails) */}
        <div style={{ display: 'none' }} className="flex flex-col items-center relative z-10">
          {/* Chef Hat */}
          <svg className="w-8 h-8 text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.4)]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.69 2 6 4.69 6 8c0 .54.08 1.05.21 1.54C4.93 10.15 4 11.46 4 13c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4 0-1.54-.93-2.85-2.21-3.46.13-.49.21-1 .21-1.54 0-3.31-2.69-6-6-6zm-5 17h10v2H7v-2z" />
          </svg>
          {/* KRISH Wordmark */}
          <span className="font-brush text-2xl tracking-wider text-white font-black drop-shadow-[0_3px_10px_rgba(0,0,0,0.9)]">
            KRISH
          </span>
          {/* Yellow Brush Ribbon */}
          <div className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-stone-950 px-3 py-0.5 rounded-full font-script text-xs font-bold -mt-1 shadow-md">
            Cafe &amp; Restaurant
          </div>
        </div>
      </div>

      {showTagline && (
        <span className="font-script text-xs text-amber-300/90 tracking-wide mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {taglineText}
        </span>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <a href={linkTo} className="inline-block cursor-pointer">
        {content}
      </a>
    );
  }

  return content;
}
