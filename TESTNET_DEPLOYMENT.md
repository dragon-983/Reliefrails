# 🚀 RELIEFRAIL Stellar Testnet Deployment Guide

## 1. Prerequisites

- **Stellar CLI / Soroban CLI**: v22+
- **Rust Toolchain**: 1.80+ with `wasm32-unknown-unknown` target
- **Circle USDC Issuer (Testnet)**: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
- **Circle USDC SAC Contract (Testnet)**: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCUSDC`

---

## 2. Compile Release WASM

Navigate to the contract directory and build the release wasm artifact:

```bash
cd ~/Desktop/RELIEFRAIL/contracts/soroban
cargo build --target wasm32-unknown-unknown --release
```

The optimized WASM binary will be produced at:
`contracts/soroban/target/wasm32-unknown-unknown/release/reliefrail_contract.wasm`

Verify the SHA256 checksum:
```bash
sha256sum target/wasm32-unknown-unknown/release/reliefrail_contract.wasm
# cd1d027bd3e1c52e96b953932f99beb000d8318f0a5e29b99603d244de57e4a5
```

---

## 3. Configure Stellar Network & Identity

```bash
# 1. Add Stellar Testnet network configuration
stellar network add \
  --global testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

# 2. Generate a deployment identity
stellar keys generate deployer --network testnet

# 3. Fund deployer via Stellar Friendbot
stellar keys fund deployer --network testnet
```

---

## 4. Install & Deploy Smart Contract

```bash
# 1. Install contract WASM code on-chain
WASM_HASH=$(stellar contract install \
  --wasm target/wasm32-unknown-unknown/release/reliefrail_contract.wasm \
  --source deployer \
  --network testnet)

echo "Installed WASM Hash: $WASM_HASH"

# 2. Deploy smart contract instance
CONTRACT_ID=$(stellar contract deploy \
  --wasm-hash $WASM_HASH \
  --source deployer \
  --network testnet)

echo "Deployed RELIEFRAIL Contract ID: $CONTRACT_ID"
```

---

## 5. Initialize Contract Instance

Initialize the contract with the deployer as Super Admin and Circle Testnet USDC as the settlement token:

```bash
DEPLOYER_ADDR=$(stellar keys address deployer)
USDC_CONTRACT="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCUSDC"

stellar contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin $DEPLOYER_ADDR \
  --token $USDC_CONTRACT
```

---

## 6. Verification on Stellar Expert

Inspect the contract transactions and storage on the Stellar Testnet Explorer:
`https://stellar.expert/explorer/testnet/contract/{CONTRACT_ID}`

Update `.env` in `~/Desktop/RELIEFRAIL`:
```env
RELIEFRAIL_CONTRACT_ID={CONTRACT_ID}
```
Restart dev server:
```bash
npm run dev
```

