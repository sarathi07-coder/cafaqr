import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import ErrorBoundary from './components/ErrorBoundary';

// ── Lazy-loaded pages: each becomes its own JS chunk ──
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
    <div className="flex items-center justify-center min-h-screen bg-stone-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
        <p className="text-stone-500 text-sm font-medium">Loading…</p>
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
                  <Route path="/" element={<OwnerAppPage />} />
                  <Route path="/owner" element={<OwnerAppPage />} />
                  <Route path="/bill/:code" element={<BillViewPage />} />
                  <Route path="*" element={<OwnerAppPage />} />
                </>
              ) : (
                <>
                  <Route path="/" element={<Navigate to="/order" replace />} />
                  <Route path="/order" element={<CustomerMenuPage />} />
                  <Route path="/kitchen" element={<KitchenPage />} />
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/admin/login" element={<AdminLoginPage />} />
                  <Route path="/owner" element={<OwnerAppPage />} />
                  <Route path="/bill" element={<BillViewPage />} />
                  <Route path="/bill/:code" element={<BillViewPage />} />
                  <Route path="*" element={<Navigate to="/order" replace />} />
                </>
              )}
            </Routes>
          </Suspense>
        </BrowserRouter>
      </CartProvider>
    </ErrorBoundary>
  );
}

