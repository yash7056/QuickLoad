# QuickLoad — Next-Gen Cargo Booking & Fleet Tracking Platform

QuickLoad is a premium, two-sided logistics and cargo booking platform designed to streamline freight transportation. The system connects customers who need cargo moved with drivers, utilizing an AI-powered pricing engine that calculates dynamic, weather- and traffic-aware fare quotes in real time.

## 🌐 Live Access Link
Experience the live application on the web:
*   🚀 **QuickLoad Gateway**: [https://quickload-customer-portal.vercel.app/](https://quickload-customer-portal.vercel.app/) — Access both the Cargo Shipper Portal and the Truck Driver Portal from a single unified landing page.

---

## 🏗️ Project Architecture
```
QuickLoad/
├── ai-engine/        FastAPI service — dynamic distance, weather integration, ML fare pricing
├── backend/          Express + MongoDB + Socket.io API — handles secure auth, booking states, live tracking
├── customer-portal/  React (Vite) app — clean customer booking interface, live map tracking, rating system
└── driver-portal/    React (Vite) app — driver job pipeline, glassmorphic dropdowns, earnings dashboard
```

---

## 🎨 Visual Identity & Styling
Both portals share a unified, premium visual language (rich dark navy backgrounds, glassmorphic cards, smooth micro-animations, and modern fonts like `Outfit` / `Inter` / `JetBrains Mono`). They feature distinct accent themes to easily differentiate between them:

| Portal | Theme Accent | Purpose / Interface Tagline |
| :--- | :--- | :--- |
| **Customer Portal** | 🟢 **Teal** | *"Book a truck in seconds, watch it move, live."* |
| **Driver Portal** | 🟡 **Amber** | *"Open jobs near you, one tap to accept."* |

---

## ⚡ Core Features

### 1. Dynamic AI Pricing Engine
*   Before booking, the customer receives an itemized fare breakdown (base fare, distance charges, weather-based surcharges, and peak-hour adjustments) queried directly from the **FastAPI AI Engine**.
*   Fares are recalculated during confirmation to prevent stale pricing.

### 2. Live Shipment Tracking
*   Powered by **Socket.io** web sockets. Every trip progression step updated by the driver (Pickup ➔ In Transit ➔ Delivered) is broadcast instantly and updates the customer's tracking map in real time.

### 3. Professional Tax Invoicing & Rating
*   Once a delivery completes, the platform automatically generates a detailed GST tax invoice with sequential formatting.
*   Customers can download invoice PDFs and rate drivers, while drivers see their earnings updated immediately.

### 4. Advanced Security & Constraints
*   **Password Hashing**: Securely encrypts account credentials using `bcryptjs` hashing middleware.
*   **Unique License Plates**: Enforces vehicle constraints ensuring a unique license plate cannot be registered by multiple drivers.

---

## 🛠️ Running Locally

### Prerequisites
*   Node.js (v18+)
*   Python (3.9+)
*   MongoDB instance

### Local Launch Instructions
Run the following in four separate terminals:

1.  **AI Pricing Engine** (FastAPI, Port `8000`)
    ```bash
    cd ai-engine
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000
    ```
2.  **Backend Server** (Express + Node, Port `5000`)
    ```bash
    cd backend
    npm install
    # Create a .env file and set MONGO_URI
    node server_gps.js
    ```
3.  **Customer Portal** (React, Port `5173`)
    ```bash
    cd customer-portal
    npm install
    npm run dev
    ```
4.  **Driver Portal** (React, Port `5174`)
    ```bash
    cd driver-portal
    npm install
    npm run dev
    ```
