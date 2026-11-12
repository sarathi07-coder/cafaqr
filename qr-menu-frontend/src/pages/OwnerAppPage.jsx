import React, { useEffect, useState } from 'react';
import { LayoutDashboard, ChefHat, ShieldCheck, Share, X } from 'lucide-react';
import AdminDashboardPage from './AdminDashboardPage';
import AdminLoginPage from './AdminLoginPage';
import KitchenPage from './KitchenPage';
import { api } from '../api';
import {
  getSyncToken,
  hydratePersistentAuth,
  removePersistentToken,
  setPersistentToken,
} from '../utils/persistentAuth';

export default function OwnerAppPage() {
  const [activePortal, setActivePortal] = useState('admin'); // 'admin' | 'kitchen'
  const [adminToken, setAdminToken] = useState(() => getSyncToken('qr_admin_token'));
  const [showIosInstallTip, setShowIosInstallTip] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isIos = /iPhone|iPad|iPod/i.test(window.navigator.userAgent || '');
    const isStandalone =
      window.navigator.standalone === true ||
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.Capacitor?.isNativePlatform?.();
    const dismissed = localStorage.getItem('krish_ios_tip_dismissed') === '1';
    return isIos && !isStandalone && !dismissed;
  });

  // Attach dedicated Owner PWA manifest + mobile app title
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'KRISH Cafe & Restaurant — Owner App';

    let manifestLink = document.querySelector('link[rel="manifest"]');
    let createdManifest = false;
    const prevManifestHref = manifestLink ? manifestLink.getAttribute('href') : null;

    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.setAttribute('rel', 'manifest');
      document.head.appendChild(manifestLink);
      createdManifest = true;
    }
    manifestLink.setAttribute('href', '/owner-manifest.webmanifest');

    return () => {
      document.title = prevTitle;
      if (createdManifest && manifestLink.parentNode) {
        manifestLink.parentNode.removeChild(manifestLink);
      } else if (manifestLink && prevManifestHref) {
        manifestLink.setAttribute('href', prevManifestHref);
      }
    };
  }, []);

  // Restore permanent credentials from Native Capacitor Preferences / IndexedDB / Cookie & sync paired Kitchen unlock
  useEffect(() => {
    let cancelled = false;
    hydratePersistentAuth().then(async ({ adminToken: restoredAdmin, kitchenToken: restoredKitchen }) => {
      if (cancelled) return;
      if (restoredAdmin) {
        setAdminToken(restoredAdmin);
        if (!restoredKitchen) {
          try {
            const v = await api.verifyAdminSession(restoredAdmin);
            if (!cancelled && v?.valid && v?.kitchenToken) {
              await setPersistentToken('qr_kitchen_token', v.kitchenToken);
            }
          } catch {}
        }
      }
    });
    const syncToken = () => setAdminToken(getSyncToken('qr_admin_token'));
    window.addEventListener('storage', syncToken);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', syncToken);
    };
  }, []);

  const isAdminUnlocked = Boolean(adminToken);

  return (
    <div className="min-h-screen bg-[#0B0B0D] flex flex-col font-sans">
      {/* Native-Style Top Hotel Header Bar */}
      <header className="sticky top-0 z-50 bg-[#0B0B0D]/95 backdrop-blur-xl border-b border-amber-500/20 px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-stone-900 border border-amber-500/40 p-1 shrink-0 overflow-hidden shadow-md">
              <img
                src="/krish_chef_mascot.png"
                alt="KRISH Cafe Chef"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <img
                  src="/krish_logo.png"
                  alt="KRISH Cafe & Restaurant"
                  className="h-6 sm:h-7 w-auto object-contain"
                />
                <span className="hidden xs:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                  Owner App
                </span>
              </div>
              <p className="text-[10px] font-semibold text-stone-400 truncate mt-0.5">
                KRISH Cafe &amp; Restaurant &bull; Admin &amp; Kitchen Suite
              </p>
            </div>
          </div>

          {/* Quick Top Switcher on Tablet / Desktop */}
          <div className="hidden sm:flex items-center gap-1.5 p-1 rounded-2xl bg-stone-900 border border-white/10">
            <button
              type="button"
              onClick={() => setActivePortal('admin')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                activePortal === 'admin'
                  ? 'bg-amber-400 text-stone-950 shadow-sm'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Admin Panel</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePortal('kitchen')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                activePortal === 'kitchen'
                  ? 'bg-emerald-400 text-stone-950 shadow-sm'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Kitchen Panel</span>
            </button>
          </div>
        </div>
      </header>

      {showIosInstallTip && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-100 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <Share className="w-4 h-4 text-amber-300 shrink-0" />
            <p className="truncate sm:whitespace-normal">
              <span className="font-black text-amber-300">Install on iPhone:</span> Tap Safari{' '}
              <span className="font-bold">Share</span> &rarr; <span className="font-bold">Add to Home Screen</span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss iPhone install tip"
            onClick={() => {
              localStorage.setItem('krish_ios_tip_dismissed', '1');
              setShowIosInstallTip(false);
            }}
            className="p-1 rounded-lg text-amber-200/80 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Active Owner Portal Content */}
      <main className="flex-1">
        {activePortal === 'admin' ? (
          isAdminUnlocked ? (
            <AdminDashboardPage
              embedded={true}
              onLogout={() => {
                removePersistentToken('qr_admin_token');
                setAdminToken('');
              }}
            />
          ) : (
            <AdminLoginPage
              embedded={true}
              onLoginSuccess={(tok) => setAdminToken(tok || getSyncToken('qr_admin_token'))}
            />
          )
        ) : (
          <KitchenPage embedded={true} />
        )}
      </main>

      {/* Fixed Native-Style Bottom Tab Navigation Bar (Android & iOS) */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-[#0B0B0D]/95 backdrop-blur-xl border-t border-white/15 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.6)] print:hidden">
        <div className="max-w-md mx-auto grid grid-cols-2 gap-2 px-4 py-2">
          <button
            type="button"
            onClick={() => setActivePortal('admin')}
            className={`py-2.5 px-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-black transition cursor-pointer ${
              activePortal === 'admin'
                ? 'bg-amber-400 text-stone-950 shadow-lg'
                : 'bg-stone-900/90 text-stone-300 hover:text-white border border-white/10'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Admin Panel</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePortal('kitchen')}
            className={`py-2.5 px-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-black transition cursor-pointer ${
              activePortal === 'kitchen'
                ? 'bg-emerald-400 text-stone-950 shadow-lg'
                : 'bg-stone-900/90 text-stone-300 hover:text-white border border-white/10'
            }`}
          >
            <ChefHat className="w-4 h-4 shrink-0" />
            <span>Kitchen Panel</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

