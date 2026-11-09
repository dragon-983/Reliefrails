# 🚂 RELIEFRAIL — Programmable Humanitarian Aid Infrastructure on Stellar

> **Cryptographically Enforced, Zero-Leakage Disaster Relief Settlement powerewd by Soroban Smart Contracts and Native USDC on Stellar.**

[![Soroban Contract Tests](https://img.shields.io/badge/Soroban%20Contract-8%20Passed-emerald.svg)](./contracts/soroban)
[![Backend Integration Tests](https://img.shields.io/badge/API%20Tests-8%20Passed-cyan.svg)](./server)
[![Client Vitest](https://img.shields.io/badge/Client%20Tests-4%20Passed-blue.svg)](./client)
[![Stellar Network](https://img.shields.io/badge/Network-Stellar%20Testnet-purple.svg)](https://stellar.org)
[![Zero-Leakage Parity](https://img.shields.io/badge/Reconciliation-100%25%20Verified-green.svg)](http://localhost:5176)

---

## 🌟 Executive Summary

Traditional disaster relief suffers from administrative overhead, intermediary corruption, and currency depreciation. An estimated **15% to 30%** of international aid is lost to leakage before reaching families on the ground.

**RELIEFRAIL** fixes humanitarian aid distribution using the Stellar blockchain and Soroban smart contracts:
1. **Donor Funds Locked in Smart Escrow**: Donated Circle USDC or XLM is held in an immutable on-chain Soroban escrow contract. Funds cannot be extracted as arbitrary cash.
2. **Programmable Aid Vouchers**: Vouchers are mathematically restricted to designated categories (e.g., `FOOD`, `MEDS`, `SHELTER`), per-transaction spending caps, and strict expiration dates.
3. **Zero-PII Privacy Protection**: No refugee or disaster victim names, biometric data, or government IDs are ever stored on-chain. Identities are protected with deterministic cryptographic commitment hashes.
4. **Instant Merchant Settlement**: Local verified pharmacies, groceries, and hardware suppliers scan beneficiary QR passes. The Soroban smart contract validates category rules and transfers funds directly to the merchant's wallet in under 5 seconds.
5. **Universal Public Reconciliation**: Real-time mathematical proof that `Donations = Escrow Balance + Settled Merchant Payments` with 0.00% unaccounted leakage.

---

## 🏗️ Architecture at a Glance

```
                         ┌────────────────────────────────────────────────────────┐
                         │                 RELIEFRAIL ECOSYSTEM                   │
                         └────────────────────────────────────────────────────────┘
                                                    │
                 ┌──────────────────────────────────┴──────────────────────────────────┐
                 ▼                                                                     ▼
    ┌─────────────────────────┐                                           ┌─────────────────────────┐
    │   DONOR / PHILANTHROPY  │                                           │  HUMANITARIAN NGO ADMIN │
    │    (Contributes USDC)   │                                           │ (Campaigns & Vouchers)  │
    └────────────┬────────────┘                                           └────────────┬────────────┘
                 │                                                                     │
                 ▼                                                                     ▼
    ┌───────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                  SOROBAN SMART CONTRACT                                       │
    │                              (ReliefRail Escrow on Testnet)                                   │
    │                                                                                               │
    │  • fund_campaign()       • allocate_aid()       • issue_voucher()      • redeem_voucher()     │
    │  • verify_org()          • approve_merchant()   • revoke_voucher()     • reclaim_expired()    │
    └──────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                           │
                 ┌─────────────────────────┴─────────────────────────┐
                 ▼                                                   ▼
    ┌─────────────────────────┐                         ┌─────────────────────────┐
    │     AID BENEFICIARY     │    QR Credential        │    APPROVED MERCHANT    │
    │ (Presents Hashed Pass)  │ ──────────────────────> │ (Scans & Claims Payout) │
    └─────────────────────────┘                         └─────────────────────────┘
```

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- **Node.js**: v20+ or v22+
- **Rust & Cargo**: 1.80+ with `wasm32-unknown-unknown` target
- **PostgreSQL**: 14+ running locally with peer socket access or standard connection
- **Stellar Wallet**: [Freighter Extension](https://www.freighter.app) (optional; sandbox profiles built-in)

### 1. Clone & Install Dependencies
```bash
cd ~/Desktop/RELIEFRAIL

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..
```

### 2. Database Migration & Seed
```bash
# Setup database and apply migrations
psql -d reliefrail -f database/migrations/001_initial_schema.sql
psql -d reliefrail -f database/migrations/002_rls_policies.sql
psql -d reliefrail -f database/seeds/001_seed_dev.sql
```

### 3. Run All Test Suites
```bash
# 1. Run Soroban Rust Smart Contract Tests (8 unit/integration tests)
cd contracts/soroban && cargo test

# 2. Run Backend API Tests (8 integration tests)
cd ../../server && npm test

# 3. Run Frontend Unit Tests (4 tests)
cd ../client && npm test
```

### 4. Launch Full-Stack Application
```bash
cd ~/Desktop/RELIEFRAIL
npm run dev
```

- **Frontend Application**: [http://localhost:5176](http://localhost:5176)
- **Backend REST API**: [http://localhost:3004](http://localhost:3004)
- **API Health Check**: [http://localhost:3004/api/health](http://localhost:3004/api/health)

---

## 🎭 5 Role-Based Demo Walkthrough

RELIEFRAIL includes instant 1-click sandbox role switching in the navigation bar:

| Role | Wallet Address | Capability |
| :--- | :--- | :--- |
| **Global Donor** | `GADONOR11111...` | Donate USDC, track aid impact, view zero-leakage proof. |
| **NGO Administrator** | `GAORGANIZATION11111...` | Launch campaigns, register beneficiaries, issue programmable vouchers. |
| **Aid Beneficiary** | `GABENEFICIARY11111...` | View allocated vouchers, generate QR redemption credential pass. |
| **Verified Merchant** | `GAMERCHANT11111...` | POS terminal, scan voucher QR, enforce category rules, instant settlement. |
| **Independent Auditor** | `GAAUDITOR11111...` | Inspect financial reconciliation, live contract escrow balance, audit trail. |

---

## 📦 Project Structure

```
RELIEFRAIL/
├── contracts/
│   └── soroban/                 # Soroban Rust Smart Contract
│       ├── src/
│       │   ├── lib.rs           # Core smart contract logic (16 methods)
│       │   ├── types.rs         # DataKey, Campaign, Voucher, Errors
│       │   ├── events.rs        # Typed contract events
│       │   └── test.rs          # Soroban test harness (8 tests)
│       └── Cargo.toml           # soroban-sdk v22.0.11
├── database/
│   ├── migrations/              # PostgreSQL schema & Row-Level Security
│   └── seeds/                   # Dev seed data with realistic relief scenarios
├── server/                      # Node.js Express TypeScript API
│   ├── src/
│   │   ├── app.ts               # Express configuration & middleware
│   │   ├── db.ts                # PostgreSQL connection pool with RLS session
│   │   ├── stellar.ts           # Horizon / Soroban RPC & signature verification
│   │   └── routes/              # Modular routes (campaigns, vouchers, etc.)
│   └── test/                    # Vitest API test suite
├── client/                      # React 19 + Vite + Tailwind v4 UI
│   ├── src/
│   │   ├── components/          # 5 role-specific views + Navbar + WalletModal
│   │   ├── lib/                 # Stellar Freighter & REST client
│   │   └── App.tsx              # Root application router
│   └── test/                    # Vitest client tests
└── scripts/
    └── dev.js                   # Concurrent multi-service runner
```

---

## 📜 Documentation Reference

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture, data flow, offline mesh, and Stellar integration.
- [SECURITY.md](./SECURITY.md) — Security model, RLS policies, threat mitigation, and cryptographic proofs.
- [CONTRACT_DESIGN.md](./CONTRACT_DESIGN.md) — Soroban smart contract storage model, entry points, and events.
- [API.md](./API.md) — REST API reference, endpoints, and schemas.
- [DATABASE.md](./DATABASE.md) — PostgreSQL schema, entity relations, and indexing.
- [PRIVACY.md](./PRIVACY.md) — Zero-PII commitment scheme, GDPR compliance, and refugee data protection.
- [TESTNET_DEPLOYMENT.md](./TESTNET_DEPLOYMENT.md) — Deploying to Stellar Testnet via `stellar-cli`.
- [DEMO_GUIDE.md](./DEMO_GUIDE.md) — Live evaluator evaluation script.

---

## ⚖️ License
MIT License. Built for the Stellar Community and Humanitarian Relief Organizations Worldwide.

