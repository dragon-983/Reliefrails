# 🏗️ RELIEFRAIL Architecture Specification

## 1. System Overview

RELIEFRAIL is engineered as a hybrid on-chain / off-chain programmable humanitarian aid delivery system. The core architectural philosophy is:

> **"Financial invariants and monetary custody belong on-chain in Soroban smart contracts; sensitive identity, logistical indexing, and low-latency POS coordination belong off-chain in private, privacy-preserving infrastructure."**

---

## 2. On-Chain vs. Off-Chain Separation

| Component | Layer | Storage / Execution | Rationale |
| :--- | :--- | :--- | :--- |
| **Aid Escrow Vault** | On-Chain | Soroban Smart Contract | Guarantees funds cannot be embezzled or redirected; programmatic custody. |
| **Voucher State Machine** | On-Chain | Soroban Smart Contract | Cryptographically enforces spending caps, expiration dates, and category validity. |
| **Settlement Clearing** | On-Chain | Soroban Smart Contract | Disburses Circle USDC directly to verified merchant wallets with 0% intermediary cut. |
| **Beneficiary Identity** | Off-Chain | PostgreSQL with RLS | **Zero PII on-chain**. Only hashed cryptographic commitments are recorded. |
| **Audit Log Indexer** | Off-Chain | PostgreSQL / Horizon Worker | Indexes on-chain contract events for real-time sub-second queries and mathematical reconciliation. |
| **Offline Merchant Sync** | Edge / Client | Local Storage / PWA | Allows point-of-sale scanning in disconnected disaster areas, syncing when connectivity resumes. |

---

## 3. Core Interaction Workflows

### 3.1 Donation & Escrow Funding Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Donor as Global Donor
    participant Web as Client UI (Vite)
    participant API as ReliefRail Server
    participant Soroban as Soroban Smart Contract
    participant Horizon as Stellar Ledger

    Donor->>Web: Selects Campaign & Enters Donation Amount (USDC)
    Web->>Donor: Requests Freighter Signature / Testnet Auth
    Donor->>Web: Signs Transaction
    Web->>Soroban: fund_campaign(campaign_id, amount)
    Soroban->>Horizon: Transfers USDC from Donor to Contract Escrow
    Soroban-->>Web: Emits CampaignFunded Event
    Web->>API: POST /api/campaigns/:id/donate (records tx_hash)
    API->>API: Inserts into donations & audit_events tables
    API-->>Web: Confirmed 100% Escrow Allocation
```

---

### 3.2 Beneficiary Enrollment & Programmable Voucher Issuance

```mermaid
sequenceDiagram
    autonumber
    actor NGO as NGO Field Officer
    participant API as ReliefRail Server
    participant Soroban as Soroban Smart Contract
    actor Ben as Beneficiary (Displaced Family)

    NGO->>API: POST /api/beneficiaries (Alias: "Household AF-409", Zone: North)
    API->>API: Computes SHA256(RawID + Nonce) -> privacy_commitment
    API->>API: Stores zero-PII record under Org RLS policy
    NGO->>API: POST /api/vouchers/issue (Campaign 1, Beneficiary 1, $200 USDC, FOOD)
    API->>API: Generates cryptographically random Secret: AID-VOUCH-FOOD-9021-SEC
    API->>API: Computes Commitment Hash = SHA256(Secret)
    API->>Soroban: issue_voucher(camp_id, alloc_id, hash, amount, max_tx, cat, expiry)
    Soroban-->>API: Voucher state locked in smart contract storage
    API-->>NGO: Voucher Issued
    NGO->>Ben: Delivers physical QR pass or SMS link
```

---

### 3.3 Merchant Redemption & Instant Settlement

```mermaid
sequenceDiagram
    autonumber
    actor Ben as Beneficiary
    actor Merch as Store Cashier
    participant Terminal as Merchant POS Terminal
    participant API as ReliefRail Server
    participant Soroban as Soroban Smart Contract
    participant Horizon as Stellar Ledger

    Ben->>Merch: Presents QR Voucher Credential at checkout
    Merch->>Terminal: Scans QR Code
    Terminal->>API: POST /api/merchants/verify-voucher (checks category match)
    API-->>Terminal: Valid: Category Match (FOOD), $200 Available, Max $75/tx
    Merch->>Terminal: Enters Purchase Amount ($50) & Clicks Settle
    Terminal->>API: POST /api/merchants/redeem (voucher_id, amount, secret)
    API->>Soroban: redeem_voucher(voucher_id, merchant_addr, amount, secret)
    Soroban->>Soroban: Verify SHA256(secret) == commitment_hash
    Soroban->>Soroban: Verify merchant.is_approved && merchant.category == voucher.category
    Soroban->>Soroban: Decrement voucher.remaining_amount
    Soroban->>Horizon: Disburse $50 USDC from contract escrow to merchant_addr
    Soroban-->>API: Emits VoucherRedeemed Event
    API-->>Terminal: Instant Settlement Confirmed (Tx Hash returned)
    Merch->>Ben: Hands over food supplies
```

---

## 4. Disaster Resilience & Low-Bandwidth Operation

In active catastrophe regions (earthquakes, cyclones, armed conflicts), cell networks are frequently degraded or severed:

1. **Self-Contained QR Credentials**: The generated QR barcode encodes the cryptographic commitment, expiration timestamp, category tag, and maximum transaction cap.
2. **Offline POS Verification**: Approved merchants with cached public keys can perform cryptographic format validation locally without active internet.
3. **Store-and-Forward Settlement Queue**: Once the merchant terminal regains satellite, mesh, or cellular data, queued redemption payloads are submitted to the Stellar network in batches. Replay attacks are prevented because each redemption requires an incrementing nonce verified by Soroban.

---

## 5. Security & Isolation Boundaries

- **Local Cargo Isolation**: Local `.cargo/config.toml` targets `x86_64-unknown-linux-gnu` with empty flags, isolating the workspace from conflicting global WASM NEAR flags.
- **PostgreSQL Row-Level Security**: Beneficiary privacy rows are visible strictly to the registering NGO organization via `current_wallet()` session context. Public users and external auditors can only query aggregated metrics and anonymized commitments.
- **Contract Nonce Deduplication**: Each Soroban voucher entry uses unique identifiers; redemptions cannot be double-spent or submitted twice.

