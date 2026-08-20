# 🍽️ DineSmart — Smart Restaurant Table Reservation & Operations Platform

> **An intelligent, high-performance restaurant reservation and dining management platform powered by custom C++ Data Structures and Algorithms (DSA) Engine, modern React + Vite frontend, and Node.js + MongoDB backend.**

---

## 📌 1. Project Overview

**DineSmart** bridges modern web application engineering with low-level **Data Structures & Algorithms (DSA)** to solve core operational bottlenecks in high-volume dining environments:
- **Intelligent Table Recommendation**: Evaluates capacity fit, seating preference (Window, Center, Outdoor), table ratings, and real-time availability using a custom **C++ Priority Queue (Max-Heap)**.
- **Smart Seating Assistant**: Solves NP-hard / subset-sum style table combinations for large parties using **C++ Backtracking Optimization** to minimize unused seats.
- **Real-Time Operational Floor Plan**: Interactive floor map with live status chips (*Free*, *Occupied*, *Reserved*), active dining timers, and table drawers.
- **Automated Waitlist & Multi-Table Seating**: FIFO Queue management with 1-click single or multi-table split allocations for large groups.
- **Enterprise-Grade Security & Integrity**: Role-Based Access Control (RBAC), atomic global concurrency locks, append-only lifecycle audit trail, and automated notifications.

---

## 🏗️ 2. System Architecture

```mermaid
graph TD
    A[Customer Portal / Manager Console] -->|HTTP / REST + JWT| B[Express.js API Gateway]
    B -->|Mongoose ODM| C[(MongoDB Database)]
    B -->|Global Async Mutex Lock| D[Concurrency Control]
    B -->|JSON IPC stdin/stdout (5s Timeout)| E[C++ DSA Engine Executable]
    E --> F[Backtracking Solver: Large-Party Combinations]
    E --> G[Priority Queue: Multi-Factor Table Recommendation]
    E --> H[Custom HashMap: O(1) Table Lookups]
    E --> I[FIFO Queue: Waitlist Ordering]
    B -->|Append-Only Trail| J[(Booking Audit Trail)]
```

---

## ⚡ 3. Custom C++ DSA Engine Specifications

The backend integrates directly with a compiled C++ binary (`dsa-engine/engine.exe`) via high-speed standard I/O streaming.

| Algorithm / Data Structure | Implementation File | Purpose & Complexity |
| :--- | :--- | :--- |
| **Backtracking (Table Combiner)** | `dsa-engine/src/Backtracking.hpp` | Finds optimal subsets of free tables for large parties ($\ge 6$ guests) with minimal capacity waste. Complexity: $O(2^N)$ with aggressive branch pruning. |
| **Priority Queue / Max-Heap** | `dsa-engine/src/PriorityQueue.hpp` | Multi-factor table scoring function: $\text{Score} = (\text{Fit} \times 10) + (\text{LocationMatch} \times 5) + (\text{Rating} \times 2)$. Returns highest-ranked tables in $O(N \log K)$. |
| **Custom HashMap** | `dsa-engine/src/HashMap.hpp` | $O(1)$ table metadata and ID lookup using quadratic probing and polynomial string hashing. |
| **FIFO Waitlist Queue** | `dsa-engine/src/Queue.hpp` | Strict arrival-time sequencing for waitlisted customers. |

---

## 💻 4. Core Modules & Specific Fields

### 🧑‍💼 Customer Portal
- **Table Search & Booking**: Select Party Size (1–10+ guests), Preferred Location (*Window*, *Center*, *Outdoor*), Date, and Time slots.
- **Recommendation Engine**: Surfaces top-recommended tables with visual fit scores and badges.
- **Waitlist Join**: When all tables for a requested slot are booked, customers can seamlessly join the digital queue.
- **My Reservations & Active Tickets**: Live booking status (*Confirmed*, *Checked In*, *Seated*, *Completed*, *Cancelled*) with 1-click self-cancellation.
- **Notification Inbox**: Instant notifications for confirmations, cancellations, and waitlist table availability.

### 🛡️ Management Portal (Host / Manager Console)
- **Operations Dashboard**:
  - Live KPI cards: *Total Tables*, *Available*, *Occupied*, *Reserved*, and *Live Waiting Queue*.
  - **Currently Seated Guests**: Real-time dining elapsed timer, party size, and 1-click *"Free Table / Complete Dining"*.
  - **Operational Alerts**: Real-time detection of overdue dining parties ($\ge 90$ mins) and waitlisted guests.
  - **Smart Seating Assistant**: Backtracking combination solver with auto-adjusting 90-minute time slots.
- **Interactive Floor Plan**:
  - Visual restaurant map showing physical table numbers, seat capacity, location icons, and real-time state.
  - Glowing combination highlight mode for assigned multi-table parties.
- **Waitlist & Multi-Table Seating Dialog**:
  - 1-click **"Auto-Fit Best Tables"** AI assistant integration.
  - Multi-table checkbox selection with live capacity meter (e.g., Party of 8 assigned across `T-101 (4s) + T-102 (2s) + T-1A (2s)`).
  - Seating distribution preview and customer notification dispatch.
- **Reservation History & Audit Trail**:
  - Append-only audit logging: records timestamp, previous state, new state, user ID, and manager notes.
  - Filterable by Date, Booking Status, and Customer Name / Phone.
- **Business Intelligence & Analytics**:
  - Date-range analytics: Completion Rate, Cancellation Rate, No-Show Rate, Average Dining Duration, Table Utilization %, and DSA Engine metrics.
  - 1-Click CSV Export for operational reporting.

---

## 🛡️ 5. Edge Cases & Resilience Handled

1. **Race Conditions & Double-Booking Prevention**:
   - Protected by global asynchronous mutex locks (`acquireGlobalLock` / `releaseGlobalLock`) during booking creation, check-in, completion, and waitlist promotion.
2. **C++ DSA Engine Fault Tolerance**:
   - 5000ms execution timeout with automatic child process termination.
   - Non-zero exit code and JSON parse failure safety wrappers — API falls back gracefully without 500 crashes or memory leaks.
3. **Time-Slot & Clock Inversions**:
   - Auto-correcting start-to-end time offsets (+90 minutes default dining window).
   - Inline visual validation warning if end time is earlier than start time.
4. **Party Size vs. Table Capacity Discrepancies**:
   - Multi-table split allocation automatically divides large parties across multiple tables without overbooking single units.
   - Manager confirmation modal prompts when attempting to seat parties with remaining unassigned guests.
5. **Physical Table State vs. Advance Reservations**:
   - Physical table occupancy is updated only if the reservation corresponds to the current live time slot (`isCurrentTimeSlot`). Advance bookings preserve `isOccupied: false`.
6. **Role-Based Access Control (RBAC)**:
   - Protected API routes strictly enforce `CUSTOMER` vs `MANAGER` roles.
   - Passwords and password hashes are strictly filtered and never returned in API responses.

---

## 🚀 6. Installation & Setup Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or higher)
- [MongoDB](https://www.mongodb.com/) (Local instance on `mongodb://127.0.0.1:27017/dinesmart` or MongoDB Atlas URI)
- C++ Compiler (`g++` / MinGW on Windows) for building the DSA engine.

---

### Step 1: Compile C++ DSA Engine
```bash
cd dsa-engine
# Windows (MinGW / GCC)
g++ -std=c++17 src/main.cpp -o engine.exe

# Linux / macOS
g++ -std=c++17 src/main.cpp -o engine
```

---

### Step 2: Backend Setup
```bash
cd backend
npm install

# Configure .env file (or use defaults)
# PORT=5000
# MONGO_URI=mongodb://127.0.0.1:27017/dinesmart
# JWT_SECRET=dinesmart_super_secure_secret_key_2026

# Seed initial tables and demo accounts
npm run seed

# Run dev server
npm run dev
```

---

### Step 3: Frontend Setup
```bash
cd frontend
npm install

# Run dev server
npm run dev
```

---

## 🧪 7. Automated Test Suite

DineSmart includes a comprehensive test suite with **145 automated integration and unit test scenarios** covering:
- C++ DSA Engine validation (Backtracking, Priority Queue, Custom HashMap, Queue).
- Authentication, Registration, and RBAC Security.
- Operations, Lifecycle state machines, Audit logging, and Notifications.
- Business Intelligence, Date Filtering, and CSV Analytics Export.

To execute the test runner:
```bash
cd backend
node tests/run.js
```

**Test Summary:**
```text
==========================================================
DINESMART TEST RUNNER REPORT SUMMARY
==========================================================
TOTAL RUN: 145
PASSED: 145
FAILED: 0
==========================================================
```

---

## 👥 Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Restaurant Manager** | `manager@dinesmart.com` | `manager123` |
| **Customer** | `customer@dinesmart.com` | `customer123` |

---

## 📄 License
This project is licensed under the MIT License.
