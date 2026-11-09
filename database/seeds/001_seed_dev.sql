-- RELIEFRAIL: Realistic Dev Seed Data

BEGIN;

-- Clear previous test/dev data safely
TRUNCATE TABLE audit_events, notifications, redemptions, vouchers, allocations, donations, beneficiaries, merchants, campaigns, organisation_members, organisations RESTART IDENTITY CASCADE;

-- 1. Insert Organisations
INSERT INTO organisations (id, wallet_address, name, description, ein_registration, contact_email, website, is_verified)
VALUES
(1, 'GAORGANIZATION11111111111111111111111111111111111111111111111', 'Global Emergency Relief Network', 'International UN-partnered humanitarian NGO providing disaster response and food security.', 'EIN-83-920194', 'operations@globalrelief.org', 'https://globalrelief.example.org', true),
(2, 'GAORGANIZATION22222222222222222222222222222222222222222222222', 'Mercy Food & Shelter Corps', 'Community-driven humanitarian response providing shelter and sustainable nutrition in conflict zones.', 'EIN-54-118823', 'relief@mercycorps.example.org', 'https://mercyfood.example.org', true);

SELECT setval('organisations_id_seq', 2);

-- 2. Insert Organisation Members
INSERT INTO organisation_members (org_id, member_wallet, role)
VALUES
(1, 'GAORGANIZATION11111111111111111111111111111111111111111111111', 'admin'),
(1, 'GAFIELDWORKER11111111111111111111111111111111111111111111111', 'field_worker'),
(2, 'GAORGANIZATION22222222222222222222222222222222222222222222222', 'admin');

-- 3. Insert Approved Merchants
INSERT INTO merchants (id, wallet_address, business_name, category, location, contact_phone, org_id, is_approved, total_redeemed_amount)
VALUES
(1, 'GAMERCHANT11111111111111111111111111111111111111111111111', 'City Central Food Hub & Market', 'FOOD', 'Sector 4, Central Relief Corridor', '+1-555-0192', 1, true, 8500.0000000),
(2, 'GAMERCHANT22222222222222222222222222222222222222222222222', 'Apothecary & Emergency Health Pharmacy', 'MEDS', 'East Ward Medical Plaza, Suite 101', '+1-555-0841', 1, true, 4200.0000000),
(3, 'GAMERCHANT33333333333333333333333333333333333333333333333', 'Apex Shelter & Modular Hardware Supplies', 'SHELTER', 'North Logistics Industrial Park', '+1-555-0377', 2, true, 15400.0000000);

SELECT setval('merchants_id_seq', 3);

-- 4. Insert Campaigns
INSERT INTO campaigns (id, on_chain_id, org_id, title, description, target_amount, total_contributed, total_allocated, total_redeemed, token_address, token_symbol, categories, start_date, end_date, status, tx_hash)
VALUES
(1, 1, 1, 'East Coast Storm & Flood Nutrition Aid', 'Providing instant programmable food vouchers directly to displaced families in coastal flooded zones. Zero intermediary leakage.', 50000.0000000, 35000.0000000, 20000.0000000, 8500.0000000, 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCUSDC', 'USDC', '{"FOOD","MEDS","SHELTER"}', NOW() - INTERVAL '10 days', NOW() + INTERVAL '50 days', 'active', '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b'),
(2, 2, 1, 'Pediatric Emergency Medicine & Critical Care', 'Targeted pharmaceutical assistance vouchers for children, nursing mothers, and elderly patients in emergency shelters.', 25000.0000000, 18000.0000000, 12000.0000000, 4200.0000000, 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCUSDC', 'USDC', '{"MEDS"}', NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days', 'active', '8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a'),
(3, 3, 2, 'Winter Emergency Shelter & Heating Fuel', 'Providing pre-approved modular emergency insulation materials and heat fuel vouchers for displaced residents facing sub-zero weather.', 40000.0000000, 40000.0000000, 30000.0000000, 15400.0000000, 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCUSDC', 'USDC', '{"SHELTER","SUPPLIES"}', NOW() - INTERVAL '15 days', NOW() + INTERVAL '45 days', 'active', '7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f');

SELECT setval('campaigns_id_seq', 3);

-- 5. Insert Beneficiaries (Privacy Preserved: SHA256 hashed commitments)
INSERT INTO beneficiaries (id, org_id, privacy_commitment, alias_label, family_size, location_zone, is_verified, verification_tier)
VALUES
(1, 1, '4d03923d6a2f7c6e5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a21', 'Household AF-409', 4, 'ZONE_NORTH_A', true, 'tier_2'),
(2, 1, '8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a72', 'Household KR-122', 2, 'ZONE_EAST_C', true, 'tier_1'),
(3, 2, '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a23', 'Household MN-884', 6, 'ZONE_SOUTH_B', true, 'tier_3');

SELECT setval('beneficiaries_id_seq', 3);

-- 6. Insert Allocations
INSERT INTO allocations (id, on_chain_id, campaign_id, beneficiary_id, amount, category, expiry_date, status, tx_hash)
VALUES
(1, 1, 1, 1, 500.0000000, 'FOOD', NOW() + INTERVAL '30 days', 'issued', '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff'),
(2, 2, 1, 2, 350.0000000, 'FOOD', NOW() + INTERVAL '30 days', 'issued', '222233334444555566667777888899990000aaaabbbbccccddddeeeeffff1111'),
(3, 3, 2, 1, 250.0000000, 'MEDS', NOW() + INTERVAL '20 days', 'issued', '33334444555566667777888899990000aaaabbbbccccddddeeeeffff11112222');

SELECT setval('allocations_id_seq', 3);

-- 7. Insert Programmable Vouchers
INSERT INTO vouchers (id, on_chain_id, allocation_id, campaign_id, beneficiary_id, initial_amount, remaining_amount, max_per_tx, category, expiry_date, redemption_credential_secret, status, tx_hash)
VALUES
(1, 1, 1, 1, 1, 500.0000000, 320.0000000, 150.0000000, 'FOOD', NOW() + INTERVAL '30 days', 'AID-VOUCH-FOOD-9021-SEC', 'active', '4444555566667777888899990000aaaabbbbccccddddeeeeffff111122223333'),
(2, 2, 2, 1, 2, 350.0000000, 350.0000000, 100.0000000, 'FOOD', NOW() + INTERVAL '30 days', 'AID-VOUCH-FOOD-8134-SEC', 'active', '555566667777888899990000aaaabbbbccccddddeeeeffff1111222233334444'),
(3, 3, 3, 2, 1, 250.0000000, 175.0000000, 100.0000000, 'MEDS', NOW() + INTERVAL '20 days', 'AID-VOUCH-MEDS-4412-SEC', 'active', '66667777888899990000aaaabbbbccccddddeeeeffff11112222333344445555');

SELECT setval('vouchers_id_seq', 3);

-- 8. Insert Redemptions
INSERT INTO redemptions (id, voucher_id, merchant_id, amount, credential_nonce, settlement_tx_hash, status)
VALUES
(1, 1, 1, 180.0000000, 'NONCE-FOOD-001', '7777888899990000aaaabbbbccccddddeeeeffff111122223333444455556666', 'settled'),
(2, 3, 2, 75.0000000, 'NONCE-MEDS-001', '888899990000aaaabbbbccccddddeeeeffff1111222233334444555566667777', 'settled');

SELECT setval('redemptions_id_seq', 2);

-- 9. Insert Donations
INSERT INTO donations (id, campaign_id, donor_wallet, amount, token_symbol, tx_hash)
VALUES
(1, 1, 'GADONOR1111111111111111111111111111111111111111111111111111', 20000.0000000, 'USDC', 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222'),
(2, 1, 'GADONOR2222222222222222222222222222222222222222222222222222', 15000.0000000, 'USDC', 'bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333'),
(3, 2, 'GADONOR1111111111111111111111111111111111111111111111111111', 18000.0000000, 'USDC', 'cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444'),
(4, 3, 'GADONOR2222222222222222222222222222222222222222222222222222', 40000.0000000, 'USDC', 'dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444eeee5555');

SELECT setval('donations_id_seq', 4);

-- 10. Insert Audit Events (Universal transparency)
INSERT INTO audit_events (campaign_id, event_type, actor_wallet, amount, tx_hash, metadata)
VALUES
(1, 'donation', 'GADONOR1111111111111111111111111111111111111111111111111111', 20000.0000000, 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222', '{"donor": "Anonymous Philanthropy Fund", "token": "USDC"}'::jsonb),
(1, 'donation', 'GADONOR2222222222222222222222222222222222222222222222222222', 15000.0000000, 'bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333', '{"donor": "Disaster Relief Alliance", "token": "USDC"}'::jsonb),
(1, 'allocation', 'GAORGANIZATION11111111111111111111111111111111111111111111111', 500.0000000, '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff', '{"beneficiary_alias": "Household AF-409", "category": "FOOD"}'::jsonb),
(1, 'voucher_issuance', 'GAORGANIZATION11111111111111111111111111111111111111111111111', 500.0000000, '4444555566667777888899990000aaaabbbbccccddddeeeeffff111122223333', '{"voucher_id": 1, "category": "FOOD", "max_per_tx": 150}'::jsonb),
(1, 'redemption', 'GAMERCHANT11111111111111111111111111111111111111111111111', 180.0000000, '7777888899990000aaaabbbbccccddddeeeeffff111122223333444455556666', '{"merchant": "City Central Food Hub & Market", "voucher_id": 1, "remaining": 320}'::jsonb);

-- 11. Insert Demo Notifications
INSERT INTO notifications (recipient_wallet, title, message, type, read, link)
VALUES
('GADONOR1111111111111111111111111111111111111111111111111111', 'Impact Update: Aid Disbursed', 'Your 20,000 USDC donation to East Coast Storm Aid has been disbursed to 30 verified families.', 'success', false, '/transparency'),
('GAORGANIZATION11111111111111111111111111111111111111111111111', 'Voucher Redeemed in Sector 4', 'Merchant City Central Food Hub redeemed 180.00 USDC for Household AF-409.', 'info', true, '/campaigns/1'),
('GAMERCHANT11111111111111111111111111111111111111111111111', 'Instant Settlement Successful', '180.00 USDC settlement received from Soroban contract into your merchant wallet.', 'success', false, '/merchant');

COMMIT;

