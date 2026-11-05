#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, BytesN, Env, Symbol,
};

fn setup_test() -> (
    Env,
    Address,
    ReliefRailContractClient<'static>,
    Address,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
    Address, // admin
    Address, // org
    Address, // donor
    Address, // merchant
) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ReliefRailContract, ());
    let client = ReliefRailContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_client = token::Client::new(&env, &token_contract.address());
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract.address());

    let admin = Address::generate(&env);
    let org = Address::generate(&env);
    let donor = Address::generate(&env);
    let merchant = Address::generate(&env);

    client.initialize(&admin);

    (
        env,
        contract_id,
        client,
        token_contract.address(),
        token_client,
        token_admin_client,
        admin,
        org,
        donor,
        merchant,
    )
}

#[test]
fn test_org_registration_and_merchant_approval() {
    let (env, _contract_id, client, _token_addr, _tc, _tac, _admin, org, _donor, merchant) = setup_test();

    let name = Symbol::new(&env, "RED_CROSS");
    let org_data = client.register_org(&org, &name);
    assert_eq!(org_data.name, name);
    assert!(org_data.is_verified);

    let cat_food = Symbol::new(&env, "FOOD");
    client.approve_merchant(&org, &merchant, &cat_food);

    assert!(client.is_merchant_approved(&org, &merchant, &cat_food));
    let cat_meds = Symbol::new(&env, "MEDS");
    assert!(!client.is_merchant_approved(&org, &merchant, &cat_meds));
}

#[test]
fn test_campaign_creation_and_donor_funding() {
    let (env, contract_id, client, token_addr, token_client, token_admin_client, _admin, org, donor, _merchant) =
        setup_test();

    client.register_org(&org, &Symbol::new(&env, "UNICEF"));

    // Mint 10,000 USDC (in 7 decimals: 10_000_0000000)
    token_admin_client.mint(&donor, &10_000_0000000);

    let camp_id = 101u64;
    let target = 5_000_0000000i128;
    let start = 1000u64;
    let end = 50_000u64;

    let camp = client.create_campaign(
        &camp_id,
        &org,
        &token_addr,
        &target,
        &Symbol::new(&env, "GAZA_RELIEF"),
        &start,
        &end,
    );
    assert_eq!(camp.total_contributed, 0);

    // Donor funds 2,500 USDC
    let funded = client.fund_campaign(&camp_id, &donor, &2_500_0000000);
    assert_eq!(funded.total_contributed, 2_500_0000000);
    assert_eq!(token_client.balance(&contract_id), 2_500_0000000);
    assert_eq!(token_client.balance(&donor), 7_500_0000000);
}

#[test]
fn test_beneficiary_allocation_and_voucher_lifecycle() {
    let (env, contract_id, client, token_addr, token_client, token_admin_client, _admin, org, donor, _merchant) =
        setup_test();

    client.register_org(&org, &Symbol::new(&env, "WFP"));
    token_admin_client.mint(&donor, &5_000_0000000);

    let camp_id = 1u64;
    client.create_campaign(
        &camp_id,
        &org,
        &token_addr,
        &5_000_0000000,
        &Symbol::new(&env, "FOOD_AID"),
        &1000,
        &100_000,
    );

    client.fund_campaign(&camp_id, &donor, &2_000_0000000);

    let cat_food = Symbol::new(&env, "FOOD");
    client.approve_merchant(&org, &merchant, &cat_food);

    // 1. Allocate 100 USDC aid to beneficiary (using hash commitment)
    let alloc_id = 11u64;
    let commitment = BytesN::from_array(&env, &[7u8; 32]);
    let expiry = 20_000u64;
    let alloc = client.allocate_aid(
        &alloc_id,
        &camp_id,
        &org,
        &commitment,
        &100_0000000,
        &cat_food,
        &expiry,
    );
    assert_eq!(alloc.amount, 100_0000000);

    // 2. Issue voucher (max 50 USDC per transaction)
    let voucher_id = 201u64;
    let voucher = client.issue_voucher(&voucher_id, &alloc_id, &org, &50_0000000);
    assert_eq!(voucher.remaining_amount, 100_0000000);
    assert_eq!(voucher.max_redemption_per_tx, 50_0000000);
    assert_eq!(voucher.status, VoucherStatus::Active);

    // 3. Partial redemption: Merchant redeems 30 USDC
    let nonce1 = BytesN::from_array(&env, &[1u8; 32]);
    let rdm1 = client.redeem_voucher(&voucher_id, &merchant, &30_0000000, &nonce1);
    assert_eq!(rdm1.remaining_amount, 70_0000000);
    assert_eq!(token_client.balance(&merchant), 30_0000000);

    // 4. Second partial redemption: Merchant redeems 40 USDC
    let nonce2 = BytesN::from_array(&env, &[2u8; 32]);
    let rdm2 = client.redeem_voucher(&voucher_id, &merchant, &40_0000000, &nonce2);
    assert_eq!(rdm2.remaining_amount, 30_0000000);
    assert_eq!(token_client.balance(&merchant), 70_0000000);

    // 5. Final redemption: Merchant redeems remaining 30 USDC
    let nonce3 = BytesN::from_array(&env, &[3u8; 32]);
    let rdm3 = client.redeem_voucher(&voucher_id, &merchant, &30_0000000, &nonce3);
    assert_eq!(rdm3.remaining_amount, 0);
    assert_eq!(rdm3.status, VoucherStatus::Redeemed);
    assert_eq!(token_client.balance(&merchant), 100_0000000);

    // Verify campaign stats
    let (_target, contributed, allocated, redeemed) = client.get_campaign_stats(&camp_id);
    assert_eq!(contributed, 2_000_0000000);
    assert_eq!(allocated, 100_0000000);
    assert_eq!(redeemed, 100_0000000);
    assert_eq!(token_client.balance(&contract_id), 1_900_0000000);
}

#[test]
fn test_replay_attack_rejected() {
    let (env, _contract_id, client, token_addr, _tc, token_admin_client, _admin, org, donor, merchant) =
        setup_test();

    client.register_org(&org, &Symbol::new(&env, "CARE"));
    token_admin_client.mint(&donor, &1_000_0000000);

    let camp_id = 2u64;
    client.create_campaign(
        &camp_id,
        &org,
        &token_addr,
        &1_000_0000000,
        &Symbol::new(&env, "CAMP_CARE"),
        &100,
        &50_000,
    );
    client.fund_campaign(&camp_id, &donor, &500_0000000);

    let cat = Symbol::new(&env, "FOOD");
    client.approve_merchant(&org, &merchant, &cat);

    let alloc_id = 22u64;
    client.allocate_aid(
        &alloc_id,
        &camp_id,
        &org,
        &BytesN::from_array(&env, &[9u8; 32]),
        &100_0000000,
        &cat,
        &10_000,
    );

    let vch_id = 202u64;
    client.issue_voucher(&vch_id, &alloc_id, &org, &100_0000000);

    let nonce = BytesN::from_array(&env, &[88u8; 32]);
    client.redeem_voucher(&vch_id, &merchant, &20_0000000, &nonce);

    // Attempting same nonce again must fail with CredentialNonceReused
    let err = client.try_redeem_voucher(&vch_id, &merchant, &20_0000000, &nonce);
    assert_eq!(err, Err(Ok(ReliefRailError::CredentialNonceReused)));
}

#[test]
fn test_unapproved_merchant_or_category_mismatch() {
    let (env, _contract_id, client, token_addr, _tc, token_admin_client, _admin, org, donor, _merchant) =
        setup_test();

    let unapproved_merchant = Address::generate(&env);
    client.register_org(&org, &Symbol::new(&env, "OXFAM"));
    token_admin_client.mint(&donor, &1_000_0000000);

    let camp_id = 3u64;
    client.create_campaign(
        &camp_id,
        &org,
        &token_addr,
        &1_000_0000000,
        &Symbol::new(&env, "SHELTER_AID"),
        &100,
        &50_000,
    );
    client.fund_campaign(&camp_id, &donor, &500_0000000);

    let cat = Symbol::new(&env, "SHELTER");
    let alloc_id = 33u64;
    client.allocate_aid(
        &alloc_id,
        &camp_id,
        &org,
        &BytesN::from_array(&env, &[3u8; 32]),
        &80_0000000,
        &cat,
        &10_000,
    );

    let vch_id = 203u64;
    client.issue_voucher(&vch_id, &alloc_id, &org, &80_0000000);

    let nonce = BytesN::from_array(&env, &[11u8; 32]);
    let err = client.try_redeem_voucher(&vch_id, &unapproved_merchant, &40_0000000, &nonce);
    assert_eq!(err, Err(Ok(ReliefRailError::MerchantNotApproved)));
}

#[test]
fn test_expired_voucher_rejection_and_reclamation() {
    let (env, _contract_id, client, token_addr, _tc, token_admin_client, _admin, org, donor, merchant) =
        setup_test();

    client.register_org(&org, &Symbol::new(&env, "SAVE_CHILDREN"));
    token_admin_client.mint(&donor, &1_000_0000000);

    let camp_id = 4u64;
    client.create_campaign(
        &camp_id,
        &org,
        &token_addr,
        &1_000_0000000,
        &Symbol::new(&env, "CHILDREN_HEALTH"),
        &100,
        &50_000,
    );
    client.fund_campaign(&camp_id, &donor, &500_0000000);

    let cat = Symbol::new(&env, "MEDS");
    client.approve_merchant(&org, &merchant, &cat);

    let alloc_id = 44u64;
    client.allocate_aid(
        &alloc_id,
        &camp_id,
        &org,
        &BytesN::from_array(&env, &[4u8; 32]),
        &100_0000000,
        &cat,
        &5_000, // expiry at 5000
    );

    let vch_id = 204u64;
    client.issue_voucher(&vch_id, &alloc_id, &org, &100_0000000);

    // Fast-forward ledger past expiry (5001)
    env.ledger().set_timestamp(5001);

    // Redemption attempt must fail with VoucherExpired
    let nonce = BytesN::from_array(&env, &[99u8; 32]);
    let err = client.try_redeem_voucher(&vch_id, &merchant, &50_0000000, &nonce);
    assert_eq!(err, Err(Ok(ReliefRailError::VoucherExpired)));

    // Organisation reclaims remaining 100 USDC back to campaign unallocated pool
    let reclaimed = client.reclaim_expired_voucher(&vch_id, &org);
    assert_eq!(reclaimed.status, VoucherStatus::Expired);
    assert_eq!(reclaimed.remaining_amount, 0);

    // Campaign total_allocated dropped from 100 back to 0
    let camp = client.get_campaign(&camp_id);
    assert_eq!(camp.total_allocated, 0);
}

#[test]
fn test_voucher_revocation_and_unallocated_restoration() {
    let (env, _contract_id, client, token_addr, _tc, token_admin_client, _admin, org, donor, merchant) =
        setup_test();

    client.register_org(&org, &Symbol::new(&env, "UNHCR"));
    token_admin_client.mint(&donor, &1_000_0000000);

    let camp_id = 5u64;
    client.create_campaign(
        &camp_id,
        &org,
        &token_addr,
        &1_000_0000000,
        &Symbol::new(&env, "REFUGEE_CAMP"),
        &100,
        &50_000,
    );
    client.fund_campaign(&camp_id, &donor, &600_0000000);

    let cat = Symbol::new(&env, "SUPPLIES");
    client.approve_merchant(&org, &merchant, &cat);

    let alloc_id = 55u64;
    client.allocate_aid(
        &alloc_id,
        &camp_id,
        &org,
        &BytesN::from_array(&env, &[5u8; 32]),
        &200_0000000,
        &cat,
        &20_000,
    );

    let vch_id = 205u64;
    client.issue_voucher(&vch_id, &alloc_id, &org, &100_0000000);

    // Partial redeem 50
    let nonce = BytesN::from_array(&env, &[15u8; 32]);
    client.redeem_voucher(&vch_id, &merchant, &50_0000000, &nonce);

    // Revoke voucher (remaining 150 reclaimed)
    let revoked = client.revoke_voucher(&vch_id, &org);
    assert_eq!(revoked.status, VoucherStatus::Revoked);
    assert_eq!(revoked.remaining_amount, 0);

    // Campaign total_allocated drops from 200 to 50
    let camp = client.get_campaign(&camp_id);
    assert_eq!(camp.total_allocated, 50_0000000);
}

#[test]
fn test_emergency_pause_and_campaign_closure() {
    let (env, contract_id, client, token_addr, token_client, token_admin_client, _admin, org, donor, _merchant) =
        setup_test();

    let recipient = Address::generate(&env);
    client.register_org(&org, &Symbol::new(&env, "MSF"));
    token_admin_client.mint(&donor, &1_000_0000000);

    let camp_id = 6u64;
    client.create_campaign(
        &camp_id,
        &org,
        &token_addr,
        &1_000_0000000,
        &Symbol::new(&env, "MEDICAL_MISSION"),
        &100,
        &50_000,
    );
    client.fund_campaign(&camp_id, &donor, &500_0000000);

    // Pause campaign
    let paused = client.pause_campaign(&camp_id, &org, &true);
    assert_eq!(paused.status, CampaignStatus::Paused);

    // Attempting to fund while paused fails
    let err_fund = client.try_fund_campaign(&camp_id, &donor, &100_0000000);
    assert_eq!(err_fund, Err(Ok(ReliefRailError::CampaignPaused)));

    // Unpause campaign
    let resumed = client.pause_campaign(&camp_id, &org, &false);
    assert_eq!(resumed.status, CampaignStatus::Active);

    // Close campaign
    client.close_campaign(&camp_id, &org);

    // Withdraw unallocated 500 USDC to recipient
    let withdrawn = client.withdraw_unallocated_funds(&camp_id, &org, &recipient);
    assert_eq!(withdrawn, 500_0000000);
    assert_eq!(token_client.balance(&recipient), 500_0000000);
    assert_eq!(token_client.balance(&contract_id), 0);
}
