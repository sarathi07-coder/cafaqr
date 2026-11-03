import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import CustomerMenuPage from './pages/CustomerMenuPage';
import KitchenPage from './pages/KitchenPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminLoginPage from './pages/AdminLoginPage';

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/order" replace />} />
          <Route path="/order" element={<CustomerMenuPage />} />
          <Route path="/kitchen" element={<KitchenPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="*" element={<Navigate to="/order" replace />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}

