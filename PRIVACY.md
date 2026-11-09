# 🔒 RELIEFRAIL Zero-PII Privacy & Humanitarian Protection

## 1. The Humanitarian Privacy Imperative

Disaster survivors, displaced persons, and political refugees are among the world's most vulnerable populations. Storing personal information on an immutable public ledger exposes them to:
- State persecution and retaliatory tracking.
- Identity theft and extortion by local cartels or traffickers.
- Permanent irreversible exposure of family locations and medical vulnerabilities.

> **RELIEFRAIL's First Principle: No Personally Identifiable Information (PII) is ever written to the Stellar blockchain or public audit logs.**

---

## 2. Zero-Knowledge Commitment Scheme

Instead of recording names, national identity numbers, or biometric vectors on-chain, RELIEFRAIL uses a **Cryptographic Commitment Scheme**:

$$Commitment = \text{SHA256}(Identifier_{\text{raw}} \parallel Salt_{\text{local}})$$

1. **Local Enrollment**: When a field worker registers a family, the NGO application generates a random 256-bit salt.
2. **Commitment Hashing**: The family's identification document is hashed together with the salt, generating a 32-byte hexadecimal digest.
3. **Smart Contract Storage**: The Soroban smart contract records only the 32-byte hash commitment. Even with quantum computing or total public ledger inspection, reversing the hash without the offline salt is mathematically infeasible ($2^{256}$ search space).
4. **Pseudonymous Presentation**: On dashboards and merchant slips, the family is identified strictly by an operational alias: `Household AF-409` or `Household KR-122`.

---

## 3. Privacy Boundary Matrix

| Data Field | Visible to Public / Donors | Visible to Merchants | Visible to Managing NGO | Recorded On-Chain |
| :--- | :---: | :---: | :---: | :---: |
| **Aid Amount Allocated** | ✅ (Aggregated) | ❌ | ✅ | ✅ |
| **Voucher Category (`FOOD`)** | ✅ | ✅ | ✅ | ✅ |
| **Family Legal Names** | ❌ | ❌ | ❌ (Never stored) | ❌ |
| **Pseudonymous Alias** | ❌ | ✅ (`Household AF-409`) | ✅ | ❌ |
| **Hashed Commitment** | ✅ | ❌ | ✅ | ✅ |
| **Geographic Zone** | ❌ | ❌ | ✅ (`ZONE_NORTH`) | ❌ |
| **Voucher Secret** | ❌ | ❌ (Verified at POS) | ✅ (Hashed) | ❌ (Pre-image checked) |

---

## 4. International Regulatory Compliance

- **UNHCR Policy on the Protection of Personal Data of Persons of Concern (2015)**: Complies with Chapter 2 (Purpose Specification and Minimization) and Chapter 3 (Confidentiality and Security).
- **European General Data Protection Regulation (GDPR)**: Satisfies "Right to be Forgotten" (Article 17) and Data Minimization (Article 5(1)(c)) because no immutable personal data is published to the blockchain.
- **ICRC Professional Standards for Protection Work**: Ensures neutrality and prevents humanitarian databases from being converted into surveillance vectors.

