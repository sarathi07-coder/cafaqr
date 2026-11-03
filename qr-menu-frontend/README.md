# 📱 Restaurant QR Menu & Operations — Frontend Application

A mobile-first contactless dining and restaurant management frontend built with **React 19**, **Vite**, **Tailwind CSS v4**, **Lucide Icons**, and **Socket.IO-Client**. Designed with modern UI/UX patterns inspired by [`softenrj/qr-menu`](https://github.com/softenrj/qr-menu).

---

## 🌟 Key Interfaces

### 1. 📱 Customer Mobile Dining Interface (`/order?tableId=...&tableNumber=...`)
- **Frictionless Session Recognition**: Checks table state on scan. Returning diners see *"Welcome back!"* with their running bill without needing to re-login or re-enter details.
- **Categorized Menu Navigation**: Interactive horizontal category scroll pills with instant search and dietary badges (Veg / Non-Veg / Spicy).
- **Floating Item Notch (`ItemNotch`)**: Persistent bottom floating notification bar tracking active item count and running total.
- **Slide-Up Cart Drawer (`CartDrawer`)**:
  - Quantity adjusters and dish removal.
  - Special chef instructions & cooking notes (*"Less spicy, sauce on side"*).
  - GDPR-compliant phone storage consent check.
  - Promo coupon redemption (*"FESTIVE10"*).
  - Smart bill splitting calculator (2, 3, 4 ways with zero fractional loss).
  - Confetti celebration upon order placement.
- **1-Tap Service Summon (`ServiceCallModal`)**: Dedicated fast-action assistance buttons (*Cold Water*, *Cutlery & Napkins*, *Get Bill*, *Call Waiter*).
- **Post-Meal Reviews (`FeedbackModal`)**: Interactive 1–5 star rating modal with comments.

### 2. 👨‍🍳 Kitchen Display System (KDS) (`/kitchen`)
- **Real-Time Kanban View**: 3 live order columns (`PENDING` ➔ `PREPARING` ➔ `READY`).
- **Elapsed Wait Clock**: Dynamic wait timer with color transitions (Green `< 10m`, Amber `10-20m`, Red flashing `> 20m`).
- **Dual-Tone Kitchen Chime**: Synthesized via the Web Audio API whenever a new order is received over Socket.IO.
- **One-Tap Stage Progression**: Rapidly advance tickets from stove to plating.

### 3. 📊 Owner & Cashier Bento Dashboard (`/admin`)
- **Bento Grid Financial Overview**: Gross Revenue, Total Orders, Average Order Value (AOV), and 5% GST Collected.
- **Live Orders & Table Settlement**: Cashier marks tabs as settled with payment methods (*UPI*, *CASH*, *CARD*) to free up tables.
- **Staff Service Queue**: Live table calls with 1-click resolution.
- **Menu & Stock Controls**: 1-click **In Stock / Out of Stock** toggle that syncs live to customers' phone screens.
- **Table Management & QR Code Studio**: High-res PNG & SVG previews and bulk printable sticker sheets.
- **Promo Coupon Engine**: Create custom coupon codes, discount percentages, and minimum order requirements.
- **Diner Feedback Feed**: Review ratings and guest comments.
- **1-Click Sales Report CSV**: Export itemized financial spreadsheets for accounting.

---

## 🛠️ Tech Stack

- **Framework**: React 19 (SPA with React Router v7)
- **Bundler & Dev Server**: Vite 6
- **Styling**: Tailwind CSS v4 (with custom glassmorphism and Plus Jakarta Sans / Playfair Display typography)
- **Icons**: Lucide React
- **Real-Time WebSockets**: Socket.IO Client
- **Delight Effects**: Canvas Confetti

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
The app will launch on `http://localhost:5173`. API requests and WebSocket events are automatically proxied to the backend on `http://localhost:3000`.

### 3. Build for Production
```bash
npm run build
```
Creates an optimized static production bundle in `dist/`.

