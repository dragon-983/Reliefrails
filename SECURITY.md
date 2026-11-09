# 🛡️ RELIEFRAIL Security & Threat Mitigation Specification

## 1. Security Principles

RELIEFRAIL is engineered for high-consequence humanitarian deployments where financial funds, refugee privacy, and emergency supplies are vulnerable to theft, coercion, or electronic fraud.

The platform enforces five core security guarantees:
1. **Custodial Invariant**: Humanitarian funds are held exclusively in Soroban smart escrow. No administrator, NGO executive, or third party has arbitrary withdrawal capability.
2. **Category Confinement**: Smart contracts enforce that vouchers can only be claimed by merchants registered in matching category registries.
3. **Privacy by Design**: Zero personally identifiable information (PII) is committed to public blockchains or unencrypted tables.
4. **Replay & Double-Spend Defense**: All redemptions consume state on-chain atomically; secrets are verified via SHA256 pre-images.
5. **Fail-Safe Reclamation**: If vouchers expire unredeemed or a disaster zone is evacuated, organizations can reclaim locked funds back to the unallocated relief pool.

---

## 2. Threat Model & Mitigations

| Threat Vector | Attack Scenario | Defense Mechanism |
| :--- | :--- | :--- |
| **Merchant Category Spoofing** | A liquor store or electronics vendor attempts to cash out a food aid voucher. | The contract checks `merchant.category == voucher.category`. If unequal, execution aborts with `ReliefRailError::CategoryMismatch`. |
| **Voucher Overspending** | A corrupt actor attempts to redeem more than the voucher's balance or per-transaction limit. | `redeem_voucher` checks `amount <= voucher.remaining_amount` and `amount <= voucher.max_per_tx`. Balance decrements atomically. |
| **Beneficiary Identity Tracking** | Malicious state actors or human traffickers attempt to identify refugees by querying public ledger transactions. | The contract and public audit events record only a 32-byte hash commitment (`SHA256`). Names, photos, biometric data, and physical coordinates are never committed. |
| **Replay Attacks** | A merchant or intermediary attempts to resubmit a previously settled redemption transaction. | Each voucher decrements `remaining_amount`. If remaining reaches 0, status transitions to `Redeemed`. Subsequent attempts fail with `VoucherAlreadyRedeemed`. |
| **Stale / Abandoned Escrow** | Displaced families migrate out of area, leaving vouchers unspent. | Smart contract allows `reclaim_expired_voucher` once `env.ledger().timestamp() > voucher.expiry_date`, returning funds to the campaign's active relief pool. |
| **Front-Running / MEV** | A front-runner observes a voucher secret in the mempool and attempts to claim funds to their own address. | `redeem_voucher` requires the merchant to pass their registered address and enforces that the merchant was pre-approved by the organization (`merchant.is_approved == true`). A front-runner cannot redirect funds to an unauthorized wallet. |

---

## 3. Database Row-Level Security (RLS)

PostgreSQL Row-Level Security is strictly enabled across all database tables:

```sql
-- Enforce beneficiary privacy
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY beneficiaries_policy ON beneficiaries FOR ALL USING (
    current_wallet() IS NULL OR EXISTS (
        SELECT 1 FROM organisations o 
        WHERE o.id = org_id AND o.wallet_address = current_wallet()
    )
);
```

- When an NGO officer queries `/api/beneficiaries`, the session executes `set_config('app.current_wallet', wallet, true)`.
- Foreign NGOs, merchants, donors, and anonymous users receive 0 rows from `beneficiaries`.
- Public audit trails are queryable via `audit_events_read_policy` for transparency without exposing protected columns.

---

## 4. Soroban Smart Contract Invariants

1. **Integer Arithmetic**: All balance updates use safe checked arithmetic (`checked_add`, `checked_sub`). Arithmetic overflow or underflow triggers immediate contract panic.
2. **Authorization Enforcement**: Administrative functions (`create_campaign`, `allocate_aid`, `issue_voucher`, `pause_campaign`) require cryptographic signature verification:
   ```rust
   org_admin.require_auth();
   ```
3. **Token Transfer Atomicity**: Soroban's cross-contract call to the Stellar Asset Contract (SAC) executes atomically within the same transaction. If the transfer fails (e.g., insufficient liquidity or frozen trustline), the entire transaction reverts.

---

## 5. Key Management & Private Key Hygiene

- **Client-Side Signing**: Secret keys never leave the user's browser or device. All transaction signing is performed through the Freighter wallet extension or hardware wallets.
- **No Stored Keys**: The RELIEFRAIL server does not hold donor, NGO, or merchant private keys.
- **Ephemeral Sandbox Keys**: In development / demonstration mode, predefined deterministic test addresses are used solely on Stellar Testnet.

