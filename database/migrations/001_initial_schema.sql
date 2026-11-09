-- RELIEFRAIL: Programmable Humanitarian Aid Infrastructure
-- Migration 001: Initial Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organisations
CREATE TABLE IF NOT EXISTS organisations (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    ein_registration TEXT,
    contact_email TEXT,
    website TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organisation Members / Staff
CREATE TABLE IF NOT EXISTS organisation_members (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    member_wallet TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'officer' CHECK (role IN ('admin', 'officer', 'field_worker')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, member_wallet)
);

-- Aid Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id BIGSERIAL PRIMARY KEY,
    on_chain_id BIGINT UNIQUE,
    org_id BIGINT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_amount NUMERIC(16, 7) NOT NULL,
    total_contributed NUMERIC(16, 7) NOT NULL DEFAULT 0.00,
    total_allocated NUMERIC(16, 7) NOT NULL DEFAULT 0.00,
    total_redeemed NUMERIC(16, 7) NOT NULL DEFAULT 0.00,
    token_address TEXT NOT NULL,
    token_symbol TEXT NOT NULL DEFAULT 'USDC',
    categories TEXT[] NOT NULL DEFAULT '{"FOOD","MEDS","SHELTER"}',
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
    tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Beneficiaries (Privacy Preserved: no PII on-chain)
CREATE TABLE IF NOT EXISTS beneficiaries (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    privacy_commitment TEXT NOT NULL UNIQUE,
    alias_label TEXT NOT NULL,
    family_size INT NOT NULL DEFAULT 1,
    location_zone TEXT NOT NULL DEFAULT 'ZONE_NORTH',
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    verification_tier TEXT NOT NULL DEFAULT 'tier_1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Approved Merchants
CREATE TABLE IF NOT EXISTS merchants (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    business_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('FOOD', 'MEDS', 'SHELTER', 'EDU', 'SUPPLIES')),
    location TEXT,
    contact_phone TEXT,
    org_id BIGINT REFERENCES organisations(id) ON DELETE SET NULL,
    is_approved BOOLEAN NOT NULL DEFAULT TRUE,
    total_redeemed_amount NUMERIC(16, 7) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aid Allocations
CREATE TABLE IF NOT EXISTS allocations (
    id BIGSERIAL PRIMARY KEY,
    on_chain_id BIGINT UNIQUE,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    beneficiary_id BIGINT NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
    amount NUMERIC(16, 7) NOT NULL,
    category TEXT NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'allocated' CHECK (status IN ('allocated', 'issued', 'revoked')),
    tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Programmable Vouchers
CREATE TABLE IF NOT EXISTS vouchers (
    id BIGSERIAL PRIMARY KEY,
    on_chain_id BIGINT UNIQUE,
    allocation_id BIGINT NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    beneficiary_id BIGINT NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
    initial_amount NUMERIC(16, 7) NOT NULL,
    remaining_amount NUMERIC(16, 7) NOT NULL,
    max_per_tx NUMERIC(16, 7) NOT NULL,
    category TEXT NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL,
    redemption_credential_secret TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'revoked', 'expired')),
    tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Redemptions by Merchants
CREATE TABLE IF NOT EXISTS redemptions (
    id BIGSERIAL PRIMARY KEY,
    voucher_id BIGINT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    amount NUMERIC(16, 7) NOT NULL,
    credential_nonce TEXT NOT NULL UNIQUE,
    settlement_tx_hash TEXT,
    status TEXT NOT NULL DEFAULT 'settled' CHECK (status IN ('pending', 'settled', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Donor Contributions
CREATE TABLE IF NOT EXISTS donations (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    donor_wallet TEXT NOT NULL,
    amount NUMERIC(16, 7) NOT NULL,
    token_symbol TEXT NOT NULL DEFAULT 'USDC',
    tx_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable Public Audit Trail
CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT REFERENCES campaigns(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('donation', 'allocation', 'voucher_issuance', 'redemption', 'voucher_revocation', 'funds_withdrawal')),
    actor_wallet TEXT NOT NULL,
    amount NUMERIC(16, 7) NOT NULL DEFAULT 0.00,
    tx_hash TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_wallet TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_beneficiary ON vouchers(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_redemptions_merchant ON redemptions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_voucher ON redemptions(voucher_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_wallet);
CREATE INDEX IF NOT EXISTS idx_audit_campaign ON audit_events(campaign_id);

