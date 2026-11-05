# 📡 RELIEFRAIL REST API Reference

Base URL: `http://localhost:3004` (Development) / `/api` (Production Proxy)

---

## 1. Authentication Headers

All authenticated endpoints accept identification via HTTP headers:

| Header | Type | Description |
| :--- | :--- | :--- |
| `x-wallet-address` | String | Stellar G-address (ed25519 public key) |
| `x-user-role` | String | Role: `donor`, `organisation`, `beneficiary`, `merchant`, `auditor`, `user` |
| `x-demo-role` | String | Quick sandbox switcher: `donor`, `organisation`, `beneficiary`, `merchant`, `auditor` |

---

## 2. System & Auth Endpoints

### `GET /api/health`
Returns system health, network details, and Soroban contract addresses.
```json
{
  "status": "healthy",
  "product": "RELIEFRAIL - Programmable Humanitarian Aid Infrastructure",
  "stellar": {
    "network": "testnet",
    "rpcUrl": "https://soroban-testnet.stellar.org",
    "horizonUrl": "https://horizon-testnet.stellar.org",
    "contractId": "CC5J3P7BEXAMPLE6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6RELIEF"
  }
}
```

### `GET /api/auth/demo-profiles`
Returns preset sandbox identities for all 5 roles.

### `GET /api/auth/balances?wallet={address}`
Returns Stellar Testnet balances (native XLM and Circle USDC).

---

## 3. Campaigns Endpoints

### `GET /api/campaigns`
List campaigns with optional filters:
- Query parameters: `status` (active/paused/closed), `category` (FOOD, MEDS, etc.), `search` (text)

### `GET /api/campaigns/:id`
Returns campaign detail, recent donor contributions, and immutable audit events.

### `POST /api/campaigns`
Creates a new humanitarian campaign (requires role `organisation`).
```json
{
  "title": "Flooding Emergency Nutrition Support",
  "description": "Direct food vouchers for coastal displaced families",
  "target_amount": 50000,
  "categories": ["FOOD", "MEDS"],
  "duration_days": 60
}
```

### `POST /api/campaigns/:id/donate`
Records a donation from a donor wallet.
```json
{
  "amount": 250,
  "token_symbol": "USDC",
  "tx_hash": "optional_onchain_hash"
}
```

---

## 4. Beneficiaries Endpoints (Privacy-Guaranteed)

### `GET /api/beneficiaries`
Lists beneficiaries registered under the calling NGO organization. Protected by PostgreSQL Row-Level Security.

### `POST /api/beneficiaries`
Enrolls a displaced family with a zero-PII commitment hash.
```json
{
  "alias_label": "Household AF-502",
  "family_size": 4,
  "location_zone": "ZONE_NORTH_B",
  "verification_tier": "tier_1"
}
```

### `GET /api/beneficiaries/me/vouchers`
Returns active programmable vouchers assigned to the authenticated beneficiary.

---

## 5. Programmable Vouchers Endpoints

### `POST /api/vouchers/issue`
Issues a programmable voucher with specific spending restrictions.
```json
{
  "campaign_id": 1,
  "beneficiary_id": 1,
  "amount": 200,
  "max_per_tx": 75,
  "category": "FOOD",
  "expiry_days": 30
}
```
**Response**:
```json
{
  "success": true,
  "voucher": {
    "id": 4,
    "remaining_amount": "200.0000000",
    "category": "FOOD",
    "redemption_credential_secret": "AID-FOOD-9A8B7C6D"
  },
  "commitmentHash": "9a8b...32bytes"
}
```

### `POST /api/vouchers/:id/qr`
Generates verifiable barcode payload for point-of-sale scanning.

### `POST /api/vouchers/:id/revoke`
Revokes an unredeemed voucher, refunding remaining balance to the campaign pool.

---

## 6. Merchants & Point-of-Sale Endpoints

### `GET /api/merchants`
Lists verified approved relief merchants.

### `POST /api/merchants/verify-voucher`
Validates a voucher presented by a survivor against the merchant's category.
```json
{
  "voucher_id": 1
}
```
**Success Response**:
```json
{
  "valid": true,
  "voucherId": 1,
  "category": "FOOD",
  "remainingAmount": "320.0000000",
  "maxPerTx": "150.0000000"
}
```
**Category Mismatch Response (HTTP 400)**:
```json
{
  "valid": false,
  "reason": "Category mismatch! Voucher is restricted to [MEDS], but merchant category is [FOOD]."
}
```

### `POST /api/merchants/redeem`
Submits voucher redemption for instant settlement to the merchant's wallet.
```json
{
  "voucher_id": 1,
  "amount": 50,
  "secret": "AID-VOUCH-FOOD-9021-SEC"
}
```

---

## 7. Audits & Zero-Leakage Reconciliation Endpoints

### `GET /api/audits/reconciliation`
Returns mathematical financial reconciliation verifying exact balance match:
```json
{
  "success": true,
  "reconciliation": {
    "totalDonated": 93250.0,
    "totalAllocated": 62000.0,
    "totalRedeemed": 28100.0,
    "unallocatedPool": 31250.0,
    "inFlightAid": 33900.0,
    "contractEscrowBalance": 65150.0,
    "isReconciled": true,
    "leakagePercent": 0.0,
    "auditTimestamp": "2026-11-05T13:58:48.000Z"
  }
}
```

### `GET /api/audits/trail`
Public immutable audit trail of all transactions and system events.
