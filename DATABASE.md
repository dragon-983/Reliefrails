# 🗄️ RELIEFRAIL Database Architecture & Schema

## 1. Overview & Setup

The RELIEFRAIL database is powered by PostgreSQL 14+ with native Row-Level Security (RLS) and cryptographic UUID extensions.

- **Development Database**: `reliefrail`
- **Testing Database**: `reliefrail_test`
- **Socket Path**: `/var/run/postgresql` (peer authentication)
- **Migrations Directory**: `database/migrations/`
- **Seeds Directory**: `database/seeds/`

---

## 2. Entity-Relationship Diagram

```
organisations ──< organisation_members
      │
      ├──< campaigns ──< donations
      │        │
      │        ├──< allocations ──< vouchers ──< redemptions
      │        │                       │             │
      │        └──< audit_events       └──> merchants ┘
      │
      ├──< beneficiaries ──< allocations
      │
      └──< merchants
```

---

## 3. Data Dictionary

### 3.1 `organisations`
Stores humanitarian NGOs and relief coordinating agencies.
- `id` (BIGSERIAL, PK)
- `wallet_address` (TEXT, UNIQUE): Stellar ed25519 public key.
- `name` (TEXT): Legal or registered entity name.
- `ein_registration` (TEXT): Tax/registration reference.
- `is_verified` (BOOLEAN): Verification status by platform auditors.

### 3.2 `campaigns`
On-chain aid relief funds with designated escrow parameters.
- `id` (BIGSERIAL, PK)
- `on_chain_id` (BIGINT, UNIQUE): Corresponding Soroban campaign ID.
- `org_id` (BIGINT, FK -> organisations.id)
- `title` (TEXT): Disaster name or relief project title.
- `target_amount` (NUMERIC(16,7)): Funding goal in USDC.
- `total_contributed` (NUMERIC(16,7)): Total received from donors.
- `total_allocated` (NUMERIC(16,7)): Reserved for beneficiary vouchers.
- `total_redeemed` (NUMERIC(16,7)): Settled to local merchants.
- `token_address` (TEXT): Soroban stablecoin token address.
- `categories` (TEXT[]): Permitted voucher categories (`FOOD`, `MEDS`, `SHELTER`).
- `status` (TEXT): `active`, `paused`, `closed`.

### 3.3 `beneficiaries` (Privacy Preserving)
Displaced families and disaster survivors. Zero PII stored.
- `id` (BIGSERIAL, PK)
- `org_id` (BIGINT, FK -> organisations.id)
- `privacy_commitment` (TEXT, UNIQUE): 32-byte SHA256 commitment hash.
- `alias_label` (TEXT): Pseudonymous identifier (e.g. "Household AF-409").
- `family_size` (INT): Number of individuals in household.
- `location_zone` (TEXT): Sector or relief corridor identifier.
- `verification_tier` (TEXT): `tier_1`, `tier_2`, `tier_3`.

### 3.4 `merchants`
Pre-approved local retail grocers, pharmacies, and hardware distributors.
- `id` (BIGSERIAL, PK)
- `wallet_address` (TEXT, UNIQUE): Stellar merchant payout address.
- `business_name` (TEXT): Commercial name.
- `category` (TEXT): `FOOD`, `MEDS`, `SHELTER`, `EDU`, `SUPPLIES`.
- `is_approved` (BOOLEAN): Pre-cleared by managing NGO.
- `total_redeemed_amount` (NUMERIC(16,7)): Cumulative payouts received.

### 3.5 `vouchers`
Programmable smart vouchers restricted by category, spending cap, and expiry.
- `id` (BIGSERIAL, PK)
- `on_chain_id` (BIGINT, UNIQUE)
- `allocation_id` (BIGINT, FK -> allocations.id)
- `campaign_id` (BIGINT, FK -> campaigns.id)
- `beneficiary_id` (BIGINT, FK -> beneficiaries.id)
- `initial_amount` (NUMERIC(16,7))
- `remaining_amount` (NUMERIC(16,7))
- `max_per_tx` (NUMERIC(16,7)): Maximum allowable per single redemption.
- `category` (TEXT): Enforced category.
- `expiry_date` (TIMESTAMPTZ): Expiration timestamp.
- `redemption_credential_secret` (TEXT): Cryptographic secret for QR scanning.
- `status` (TEXT): `active`, `redeemed`, `revoked`, `expired`.

### 3.6 `redemptions`
Settlement records executed by merchants.
- `id` (BIGSERIAL, PK)
- `voucher_id` (BIGINT, FK -> vouchers.id)
- `merchant_id` (BIGINT, FK -> merchants.id)
- `amount` (NUMERIC(16,7))
- `credential_nonce` (TEXT, UNIQUE)
- `settlement_tx_hash` (TEXT): Stellar Testnet transaction hash.
- `status` (TEXT): `settled`, `pending`, `failed`.

### 3.7 `audit_events`
Immutable public ledger of all platform financial movements.
- `id` (BIGSERIAL, PK)
- `campaign_id` (BIGINT, FK -> campaigns.id)
- `event_type` (TEXT): `donation`, `allocation`, `voucher_issuance`, `redemption`, `voucher_revocation`.
- `actor_wallet` (TEXT)
- `amount` (NUMERIC(16,7))
- `tx_hash` (TEXT)
- `metadata` (JSONB)
- `created_at` (TIMESTAMPTZ)

---

## 4. Performance Indexes

```sql
CREATE INDEX idx_campaigns_org ON campaigns(org_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_vouchers_beneficiary ON vouchers(beneficiary_id);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_redemptions_merchant ON redemptions(merchant_id);
CREATE INDEX idx_redemptions_voucher ON redemptions(voucher_id);
CREATE INDEX idx_donations_donor ON donations(donor_wallet);
CREATE INDEX idx_audit_campaign ON audit_events(campaign_id);
```

