# 🎬 RELIEFRAIL Live Evaluation & Demo Script

Follow this step-by-step evaluation guide to test all 5 personas and verify the zero-leakage humanitarian aid architecture.

---

## ⚡ Preparation

1. Confirm dev servers are running:
   - Web Client: [http://localhost:5176](http://localhost:5176)
   - REST API: [http://localhost:3004](http://localhost:3004)
2. Open browser to [http://localhost:5176](http://localhost:5176).

---

## 🎭 Step 1: Global Donor Experience

1. **Active Role**: Ensure **Global Donor** is selected in the top-right navbar pill.
2. **Navigate to**: **Donate** tab (`/`).
3. **Inspect Active Relief Campaigns**:
   - Observe real-time campaigns: *East Coast Storm & Flood Nutrition Aid*, *Pediatric Emergency Medicine*, *Winter Emergency Shelter*.
   - Filter by category (`FOOD`, `MEDS`, `SHELTER`).
4. **Execute Aid Contribution**:
   - Click **"Support Campaign"** on *East Coast Storm Aid*.
   - Select preset **$100 USDC** (or custom amount).
   - Click **"Confirm Donation of $100.00 USDC"**.
   - **Verification**: Modal confirms instant locking of funds in Soroban contract escrow with transaction hash. Campaign raised total increments.

---

## 🏢 Step 2: Humanitarian NGO Command Center

1. **Switch Role**: In the top-right dropdown, switch to **NGO Administrator**.
2. **Navigate to**: **NGO Command** tab.
3. **Register Displaced Family (Zero-PII)**:
   - Click **"Add Beneficiary"**.
   - Enter Alias: `Household AF-502`, Family Size: `4`, Relief Zone: `ZONE_NORTH_B`.
   - Click **"Register Beneficiary"**.
   - **Verification**: Green banner confirms registration with a 32-byte cryptographic hash commitment. No PII is logged on-chain.
4. **Issue Programmable Aid Voucher**:
   - Click **"Issue Voucher"**.
   - Select Campaign: *East Coast Storm & Flood Nutrition Aid*.
   - Select Beneficiary: *Household AF-409*.
   - Amount: `150` USDC, Per-Tx Limit: `50`, Category: `FOOD`.
   - Click **"Issue Programmable Voucher"**.
   - **Verification**: Smart contract issues voucher with unique cryptographic secret (e.g., `AID-FOOD-9021...`).

---

## 🎫 Step 3: Aid Beneficiary Portal

1. **Switch Role**: In the top-right dropdown, switch to **Aid Beneficiary**.
2. **Navigate to**: **Beneficiary** tab.
3. **Inspect Family Pass**:
   - Notice assigned beneficiary alias: **Household AF-409** (4 members, Zone North).
   - Observe active programmable vouchers with category badges (`FOOD AID`, `MEDS AID`).
4. **Generate Point-of-Sale QR Credential**:
   - Click **"Present QR Credential"** on Voucher #1.
   - **Verification**: High-contrast QR barcode credential displays with category, available balance, transaction limit, and offline verification secret.

---

## 🛒 Step 4: Local Merchant POS Terminal & Category Rule Enforcement

1. **Switch Role**: In the top-right dropdown, switch to **Verified Merchant**.
2. **Navigate to**: **Merchant POS** tab.
3. **Profile Notice**: Terminal identifies as **City Central Food Hub & Market** (Category: `FOOD`).
4. **Test Category Enforcement (Negative Test)**:
   - In Step 1, enter Voucher ID `3` (which is restricted to `MEDS`).
   - Click **"Validate"**.
   - **Verification**: Policy rejection banner appears:
     > *"Category mismatch! Voucher is restricted to [MEDS], but merchant category is [FOOD]."*
     *Funds cannot be drained by incorrect merchants!*
5. **Execute Valid Redemption (Positive Test)**:
   - Enter Voucher ID `1` (which is restricted to `FOOD`).
   - Click **"Validate"**.
   - Terminal verifies voucher validity, displaying Available Balance and Per-Tx Limit.
   - Purchase Total: `50` USDC.
   - Click **"Confirm Instant Settlement of $50.00 USDC"**.
   - **Verification**: Soroban smart contract releases $50 USDC from escrow directly to merchant wallet. Settlement receipt appears with on-chain transaction hash.

---

## 📊 Step 5: Independent Auditor & Public Zero-Leakage Reconciliation

1. **Switch Role**: In the top-right dropdown, switch to **Independent Auditor**.
2. **Navigate to**: **Zero-Leakage Audit** tab.
3. **Inspect Mathematical Financial Parity**:
   - Review live formula:
     $$\text{Total Donated} = \text{Contract Escrow Balance} + \text{Settled Merchant Payouts}$$
   - Verify green checkmark: **"Balance Check: EXACT MATCH"**.
   - Leakage Percentage: **0.00%**.
4. **Immutable Audit Trail Feed**:
   - Filter events by `donation`, `allocation`, `voucher_issuance`, and `redemption`.
   - Click on transaction hashes to inspect on Stellar Testnet explorer.

