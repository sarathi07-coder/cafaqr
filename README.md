# 🍽️ cafaqr - Restaurant QR Ordering & Kitchen Management System

A production-grade, full-stack contactless dining and Kitchen Display System (KDS) designed for modern restaurants. Diners scan a table QR code to browse menus, customize dishes, place orders, add more dishes to an active table tab, pay via dynamic UPI, and settle bills with live real-time synchronization across the Kitchen Display System and the Manager Admin Portal.

---

## 🚀 Key Features

### 📱 1. Diner Contactless QR Ordering (`/order` or `/?tableNumber=1`)
- **Table Session Management**: Automatic detection of active dining tabs with real-time bill calculations.
- **Dynamic UPI QR Code Payments**: Instant NPCI-compliant deep links and scannable QR codes for Google Pay, PhonePe, Paytm, BHIM, and CRED.
- **Interactive Multi-Round Ordering**:
  - Diners can place their first round of orders (e.g., drinks and starters).
  - Diners can order additional rounds of food at any time on the same running bill.
  - Newly placed items are automatically forwarded to the kitchen with audio chime alerts.
- **Item-Level Status & Cancellation Controls**:
  - Dishes awaiting preparation (`PENDING`) display `🟢 Editable` with a **Cancel** button allowing customers to modify their order before the chef starts cooking.
  - Once cooking starts (`PREPARING`, `READY`, `SERVED`), dishes lock into `🔒 Cooking` or `✓ Served` state.
- **Itemized Bill Breakdown**: Real-time subtotal, 5% GST calculation, and grand total.
- **Service Request Modal**: "Call Waiter" button triggers real-time alerts on the Manager Portal.
- **5-Star Post-Meal Review**: Automatic celebration feedback modal when the cashier settles the table tab.

### 👨‍🍳 2. Real-Time Kitchen Display System (KDS) (`/kitchen`)
- **3-Stage Kanban Board**: Visual columns for `Pending` (New Orders), `Preparing` (On Stove & Grill), and `Ready` (Plated for Runners).
- **Smart Active Dish Filtering**:
  - When diners order extra dishes in later rounds, the kitchen ticket **only shows the new unserved dishes** that need to be cooked, preventing chefs from duplicate cooking.
  - Tickets automatically clear from the active board once all items are plated and served.
- **Web Audio Chime**: Auditory alert on incoming orders and when dishes are ready for table runners.
- **Elapsed Wait Timers**: Visual delay warnings for tickets waiting over 10m (Amber) or 20m (Rose delayed).

### 📊 3. Manager & Cashier Portal (`/admin`)
- **Live Orders Stream**: View all active table tabs, itemized ordered dishes with individual preparation status (`Served` / `Cooking`), running bill totals, and customer details.
- **Single-Click Checkout ("Settle & Free Table")**: Cashier selects payment method (Cash, UPI, Card), closes the order, frees the table session, and resets the table QR code.
- **Dynamic UPI Settings**: Live VPA configuration and real-time incoming payment alerts with UTR verification.
- **Real-Time Table Service Calls**: Receive and resolve diner waiter requests.
- **Analytics & Menu Controls**: Menu item availability toggle, sales overview, and coupon generation.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons, Socket.IO Client, Canvas-Confetti
- **Backend**: Node.js, Express, Socket.IO, PostgreSQL (Supabase), Joi validation, JWT authentication
- **Architecture**: Real-time event-driven websocket architecture with database row-level locking

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
# Backend dependencies
cd qr-menu-backend
npm install

# Frontend dependencies
cd ../qr-menu-frontend
npm install
```

### 2. Configure Environment
Create `qr-menu-backend/.env`:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
JWT_SECRET=your_jwt_secret_key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
UPI_ID=vallipriya1212-1@oksbi
UPI_NAME=Royal Spice Bistro
```

### 3. Run the Development Servers
From root directory:
```bash
# Start backend server (port 3000)
npm run backend

# In a second terminal, start frontend (port 5173)
npm run frontend
```

---

## 🔗 Portals & Endpoints

- **Customer QR Menu**: `/order?tableId=...&tableNumber=1`
- **Kitchen Display System**: `/kitchen`
- **Admin Manager Portal**: `/admin` *(Credentials: `admin` / `supersecret`)*
- **API Health**: `/health`

---

## 📄 License
ISC

