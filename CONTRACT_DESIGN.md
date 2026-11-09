# 📜 RELIEFRAIL Soroban Smart Contract Design

## 1. Overview & Technology Stack

The RELIEFRAIL smart contract is written in Rust using official **Soroban SDK v22.0.11** for the Stellar blockchain.

- **Crate Name**: `reliefrail-contract`
- **Target**: `wasm32-unknown-unknown`
- **WASM Size**: ~23 KB (optimized release build)
- **SHA256 Checksum**: `cd1d027bd3e1c52e96b953932f99beb000d8318f0a5e29b99603d244de57e4a5`
- **Test Suite**: 8 comprehensive Rust unit and integration tests passing in `contracts/soroban/src/test.rs`.

---

## 2. Storage Architecture & Keys

Soroban separates storage into `Instance`, `Persistent`, and `Temporary` storage tiers. RELIEFRAIL leverages:
- **Instance Storage**: Global contract settings (Super Admin, Global Campaign Counter, Platform Token Address).
- **Persistent Storage**: Campaigns, Registered NGOs, Approved Merchants, Allocations, and Vouchers.

### Storage DataKey Enum
```rust
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    TokenAddress,
    CampaignCount,
    Organisation(Address),
    Merchant(Address),
    Campaign(u64),
    Allocation(u64),
    Voucher(u64),
}
```

---

## 3. Data Structures

### 3.1 Organisation
```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Organisation {
    pub admin: Address,
    pub name: String,
    pub ein_registration: String,
    pub is_verified: bool,
    pub created_at: u64,
}
```

### 3.2 Campaign
```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Campaign {
    pub id: u64,
    pub org_admin: Address,
    pub title: String,
    pub target_amount: i128,
    pub total_contributed: i128,
    pub total_allocated: i128,
    pub total_redeemed: i128,
    pub token_address: Address,
    pub status: CampaignStatus,
    pub start_date: u64,
    pub end_date: u64,
}
```

### 3.3 AidVoucher
```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AidVoucher {
    pub id: u64,
    pub campaign_id: u64,
    pub allocation_id: u64,
    pub initial_amount: i128,
    pub remaining_amount: i128,
    pub max_per_tx: i128,
    pub category: Symbol,
    pub expiry_date: u64,
    pub commitment_hash: BytesN<32>,
    pub status: VoucherStatus,
}
```

---

## 4. Contract Public Entry Points

| Method | Parameters | Caller | Description |
| :--- | :--- | :--- | :--- |
| `initialize` | `admin: Address, token: Address` | Deployer | Initializes contract storage and platform stablecoin address. |
| `register_org` | `admin: Address, name: String, ein: String` | NGO Admin | Self-registers a humanitarian organization profile. |
| `verify_org` | `org_admin: Address, verified: bool` | Super Admin | Approves or suspends NGO credential status. |
| `approve_merchant` | `caller: Address, merchant: Address, cat: Symbol` | Verified NGO | Clears a local vendor to redeem vouchers in a specific category. |
| `suspend_merchant` | `caller: Address, merchant: Address` | Verified NGO | Suspends a merchant due to irregularities or audit findings. |
| `create_campaign` | `org_admin: Address, title: String, target: i128, duration: u64` | Verified NGO | Deploys a new humanitarian campaign vault. |
| `fund_campaign` | `donor: Address, campaign_id: u64, amount: i128` | Any Donor | Transfers USDC into the smart escrow and credits campaign. |
| `pause_campaign` | `org_admin: Address, campaign_id: u64` | NGO Admin | Temporarily halts allocations and redemptions. |
| `close_campaign` | `org_admin: Address, campaign_id: u64` | NGO Admin | Formally closes campaign when relief operations conclude. |
| `allocate_aid` | `org_admin: Address, camp_id: u64, alloc_id: u64, amount: i128, cat: Symbol, expiry: u64` | NGO Admin | Reserves funds from campaign pool for a verified family. |
| `issue_voucher` | `org_admin: Address, camp_id: u64, alloc_id: u64, voucher_id: u64, hash: BytesN<32>, amount: i128, max_tx: i128, cat: Symbol, expiry: u64` | NGO Admin | Commits a programmable voucher with category restrictions and spending limits. |
| `redeem_voucher` | `merchant: Address, voucher_id: u64, amount: i128, secret: Bytes` | Approved Merchant | Validates category, checks SHA256 pre-image, and transfers USDC to merchant. |
| `revoke_voucher` | `org_admin: Address, voucher_id: u64` | NGO Admin | Revokes an unused voucher and refunds remaining balance to campaign reserve. |
| `reclaim_expired` | `org_admin: Address, voucher_id: u64` | NGO Admin | Reclaims funds from an expired voucher after its expiration deadline. |
| `withdraw_unallocated` | `org_admin: Address, camp_id: u64, recipient: Address` | NGO Admin | Allows withdrawing leftover unallocated funds when campaign closes. |
| `get_campaign` | `campaign_id: u64` -> `Campaign` | Public View | Returns complete campaign financial and operational status. |
| `get_voucher` | `voucher_id: u64` -> `AidVoucher` | Public View | Returns voucher status, remaining balance, and category. |

---

## 5. Event Schema

All financial state mutations emit strongly typed events for indexers and auditors:

```rust
// contracts/soroban/src/events.rs
env.events().publish(
    (Symbol::new(&env, "campaign_funded"), campaign_id),
    (donor, amount),
);

env.events().publish(
    (Symbol::new(&env, "voucher_redeemed"), voucher_id),
    (merchant, amount, remaining),
);
```

---

## 6. Testing Methodology

The Soroban test suite (`src/test.rs`) runs in an isolated Soroban environment with mock token contracts:
1. `test_initialize_and_register_org`
2. `test_create_and_fund_campaign`
3. `test_allocate_aid_and_issue_voucher`
4. `test_redeem_voucher_success`
5. `test_category_mismatch_fails`
6. `test_exceeds_max_per_tx_fails`
7. `test_revoke_voucher_refunds_campaign`
8. `test_reclaim_expired_voucher`

All 8 tests pass deterministically via `cargo test`.

