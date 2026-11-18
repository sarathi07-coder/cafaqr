import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import ErrorBoundary from './components/ErrorBoundary';

// ── Lazy-loaded pages: each becomes its own JS chunk ──
const AppHomePage = lazy(() => import('./pages/AppHomePage'));
const WaiterPosPage = lazy(() => import('./pages/WaiterPosPage'));
const CustomerMenuPage = lazy(() => import('./pages/CustomerMenuPage'));
const KitchenPage = lazy(() => import('./pages/KitchenPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const BillViewPage = lazy(() => import('./pages/BillViewPage'));
const OwnerAppPage = lazy(() => import('./pages/OwnerAppPage'));

const IS_OWNER_MOBILE_APP = import.meta.env.VITE_APP_MODE === 'owner';

// Minimal loading spinner shown while a page chunk downloads
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0B0A08]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
        <p className="text-stone-400 text-xs font-bold uppercase tracking-wider">Loading KRISH POS…</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CartProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {IS_OWNER_MOBILE_APP ? (
                <>
                  <Route path="/" element={<AppHomePage />} />
                  <Route path="/pos" element={<AppHomePage />} />
                  <Route path="/order-taking" element={<AppHomePage initialSection="ORDER_ONLY" />} />
                  <Route path="/billing" element={<AppHomePage initialSection="BILLING_SUITE" />} />
                  <Route path="/billing-suite" element={<AppHomePage initialSection="BILLING_SUITE" />} />
                  <Route path="/history" element={<AppHomePage initialSection="BILLING_SUITE" />} />
                  <Route path="/owner" element={<OwnerAppPage />} />
                  <Route path="/kitchen" element={<KitchenPage />} />
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/admin/login" element={<AdminLoginPage />} />
                  <Route path="/bill/:code" element={<BillViewPage />} />
                  <Route path="*" element={<AppHomePage />} />
                </>
              ) : (
                <>
                  <Route path="/" element={<AppHomePage />} />
                  <Route path="/pos" element={<AppHomePage />} />
                  <Route path="/order-taking" element={<AppHomePage initialSection="ORDER_ONLY" />} />
                  <Route path="/order" element={<AppHomePage initialSection="ORDER_ONLY" />} />
                  <Route path="/billing" element={<AppHomePage initialSection="BILLING_SUITE" />} />
                  <Route path="/billing-suite" element={<AppHomePage initialSection="BILLING_SUITE" />} />
                  <Route path="/history" element={<AppHomePage initialSection="BILLING_SUITE" />} />
                  <Route path="/all-in-one" element={<WaiterPosPage appSection="ALL" />} />
                  <Route path="/customer-menu" element={<CustomerMenuPage />} />
                  <Route path="/kitchen" element={<KitchenPage />} />
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/admin/login" element={<AdminLoginPage />} />
                  <Route path="/owner" element={<OwnerAppPage />} />
                  <Route path="/bill" element={<BillViewPage />} />
                  <Route path="/bill/:code" element={<BillViewPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              )}
            </Routes>
          </Suspense>
        </BrowserRouter>
      </CartProvider>
    </ErrorBoundary>
  );
}

