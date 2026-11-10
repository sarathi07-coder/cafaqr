# 🏆 Project Submission Guide: cafaqr

**cafaqr** is a production-grade, contactless QR dining and real-time Kitchen Display System (KDS) designed for modern multi-table restaurants.

---

## 🌐 1. Live Production Deployment Links

### ☁️ Cloudflare 100% Native Production Stack (Fastest & Edge V8)

| Portal | Live Cloudflare URL | Description | Test Credentials |
| :--- | :--- | :--- | :--- |
| 📱 **Customer QR Menu** | [https://cafaqr.p7404467.workers.dev/order?tableNumber=1](https://cafaqr.p7404467.workers.dev/order?tableNumber=1) | Diner mobile ordering interface | Open on phone or browser |
| 👨‍🍳 **Kitchen Display (KDS)** | [https://cafaqr.p7404467.workers.dev/kitchen](https://cafaqr.p7404467.workers.dev/kitchen) | Live 3-column chef Kanban board | Live audio alerts enabled |
| 📊 **Admin & Cashier Portal** | [https://cafaqr.p7404467.workers.dev/admin](https://cafaqr.p7404467.workers.dev/admin) | Table oversight, billing, analytics | **User:** `admin`<br>**Pass:** `supersecret` or `admin123` |
| ⚡ **Cloudflare Worker & D1 API** | [https://cafaqr-api.p7404467.workers.dev/health/db](https://cafaqr-api.p7404467.workers.dev/health/db) | Cloudflare Edge & D1 diagnostic | Status: `{"status":"ok","database":"cloudflare_d1_connected"}` |

---

### 🌐 Vercel + Supabase Secondary Stack

| Portal | Live Vercel URL | Description |
| :--- | :--- | :--- |
| 📱 **Customer QR Menu** | [https://cafaqr-h5b1.vercel.app/order?tableNumber=1](https://cafaqr-h5b1.vercel.app/order?tableNumber=1) | Vercel Edge CDN Frontend |
| 👨‍🍳 **Kitchen Display (KDS)** | [https://cafaqr-h5b1.vercel.app/kitchen](https://cafaqr-h5b1.vercel.app/kitchen) | Chef Kanban Board |
| 📊 **Admin Portal** | [https://cafaqr-h5b1.vercel.app/admin](https://cafaqr-h5b1.vercel.app/admin) | Cashier Dashboard |
| ⚡ **Vercel API Health** | [https://cafaqr.vercel.app/health/db](https://cafaqr.vercel.app/health/db) | Supabase PostgreSQL diagnostic |

> **Manager Passkey for UPI Switching:** `1234`  
> **Source Code Repository:** [https://github.com/sarathi07-coder/cafaqr](https://github.com/sarathi07-coder/cafaqr)

---

## 🎬 2. Step-by-Step Evaluator Demo Walkthrough

To experience the full end-to-end synchronized flow, open two browser windows side-by-side:

### Step 1: Open Kitchen & Cashier
1. In Window 1, open the **Kitchen Display**: [https://cafaqr-h5b1.vercel.app/kitchen](https://cafaqr-h5b1.vercel.app/kitchen)
2. In Window 2, open the **Admin Portal**: [https://cafaqr-h5b1.vercel.app/admin](https://cafaqr-h5b1.vercel.app/admin) (Log in with `admin` / `supersecret`).

### Step 2: Customer Places Order
1. On your phone or an incognito tab, open **Table 1**: [https://cafaqr-h5b1.vercel.app/order?tableNumber=1](https://cafaqr-h5b1.vercel.app/order?tableNumber=1)
2. Add dishes (e.g. *Paneer Butter Masala*, *Butter Naan*, *Mango Lassi*).
3. Apply promo coupon: `WELCOME10` or `FLAT50`.
4. Click **Place Order**.
5. **Notice:** Window 1 (Kitchen) immediately chimes and displays the new ticket under **Pending**. Window 2 (Admin) shows Table 1 active.

### Step 3: Kitchen Prepares Food
1. In the Kitchen Display, click **"Start Preparing"** on Table 1's ticket. The ticket moves to **Preparing**.
2. Notice that on the customer's phone, the dish status automatically updates to **"🔒 Cooking"** without reloading the page.
3. In the Kitchen, click **"Order Ready"**. The ticket moves to **Ready** for table runners.

### Step 4: Dynamic UPI Payment & Settlement
1. On the customer's phone, click **"Pay via UPI"**. A dynamic NPCI QR code is rendered for the exact bill total.
2. Diners click **"I Have Paid via UPI"** and enter their 12-digit UTR reference.
3. The Admin cashier dashboard flashes the payment notification.
4. The cashier clicks **"Settle & Free Table"**.
5. **Notice:** Table 1 is cleared, and the customer's phone automatically pops open the **5-Star Celebration Review Modal**.

---

## 🛠️ 3. Architecture & Tech Stack

```
[Customer Mobile / Tablet]       [Kitchen Display Board]       [Admin & Cashier Portal]
        │                                    │                                  │
        └─────────────────┬──────────────────┴──────────────────────────────────┘
                          │ (Vercel Anycast Edge CDN - 16 KB Gzipped Bundle)
                          ▼
             [Node.js + Express API Engine]
             - Joi Request Schema Validation
             - Helmet & Compression Middleware
             - Multi-Bank UPI Limit Router
                          │
                          │ (PgBouncer Connection Pooling)
                          ▼
             [Supabase PostgreSQL Cloud DB]
             - Row-level transactions & locks
             - 7 High-performance composite indexes
             - Auto-fallback for feedback ratings
```

---

## 🔐 4. Multi-Bank UPI Switcher with Passkey Protection

To prevent Indian bank daily UPI transaction limits (e.g., SBI ₹1,00,000 / day) from blocking diner payments:
- The restaurant manager can switch the active payment destination between **SBI**, **HDFC**, **ICICI**, or any custom VPA in 1 click under **Admin -> UPI Settings**.
- Changes require the **Manager Passkey (`1234`)** to ensure waitstaff cannot tamper with payment VPAs.
- The manager passkey can be reset anytime using the **Admin Master Password**.

---

## 💾 5. How to Run Locally

```bash
# 1. Clone repository
git clone https://github.com/sarathi07-coder/cafaqr.git
cd cafaqr

# 2. Setup backend
cd qr-menu-backend
npm install
npm run seed  # Populates menu, tables, and promo coupons
npm start     # Starts API on port 3000

# 3. Setup frontend (in a new terminal)
cd ../qr-menu-frontend
npm install
npm run dev   # Starts Vite React on port 5173
```

---

## ⚡ 6. Cloudflare Native Stack (Workers + D1 SQLite)

The repository also includes a **100% native Cloudflare Workers + Cloudflare D1 (SQLite)** backend inside `cloudflare-backend/`:

```bash
# Navigate to Cloudflare backend
cd cloudflare-backend

# Run all 10 Module verification test suites
npm run test:all

# Deploy to Cloudflare Workers & D1
npm run db:create        # Creates remote D1 database
npm run db:seed:remote   # Runs schema & seed on Cloudflare edge
npm run deploy           # Deploys Worker to Cloudflare edge
```


