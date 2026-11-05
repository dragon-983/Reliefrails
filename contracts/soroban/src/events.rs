use soroban_sdk::{symbol_short, Address, Env, Symbol};

pub fn emit_org_registered(env: &Env, org: &Address, name: &Symbol) {
    let topics = (symbol_short!("org_reg"), org);
    env.events().publish(topics, name.clone());
}

pub fn emit_org_verified(env: &Env, org: &Address, is_verified: bool) {
    let topics = (symbol_short!("org_ver"), org);
    env.events().publish(topics, is_verified);
}

pub fn emit_merchant_approved(env: &Env, org: &Address, merchant: &Address, category: &Symbol) {
    let topics = (symbol_short!("mch_app"), org, merchant);
    env.events().publish(topics, category.clone());
}

pub fn emit_campaign_created(env: &Env, campaign_id: u64, org: &Address, target_amount: i128) {
    let topics = (symbol_short!("camp_new"), org);
    env.events().publish(topics, (campaign_id, target_amount));
}

pub fn emit_donation_received(env: &Env, campaign_id: u64, donor: &Address, amount: i128) {
    let topics = (symbol_short!("donate"), donor);
    env.events().publish(topics, (campaign_id, amount));
}

pub fn emit_aid_allocated(env: &Env, allocation_id: u64, campaign_id: u64, amount: i128, category: &Symbol) {
    let topics = (symbol_short!("aid_alloc"), campaign_id);
    env.events().publish(topics, (allocation_id, amount, category.clone()));
}

pub fn emit_voucher_issued(env: &Env, voucher_id: u64, allocation_id: u64, amount: i128, category: &Symbol) {
    let topics = (symbol_short!("vch_issue"), allocation_id);
    env.events().publish(topics, (voucher_id, amount, category.clone()));
}

pub fn emit_voucher_redeemed(env: &Env, voucher_id: u64, merchant: &Address, amount: i128, remaining: i128) {
    let topics = (symbol_short!("vch_rdm"), merchant);
    env.events().publish(topics, (voucher_id, amount, remaining));
}

pub fn emit_voucher_revoked(env: &Env, voucher_id: u64, reclaimed_amount: i128) {
    let topics = (symbol_short!("vch_rev"), voucher_id);
    env.events().publish(topics, reclaimed_amount);
}

pub fn emit_voucher_reclaimed(env: &Env, voucher_id: u64, reclaimed_amount: i128) {
    let topics = (symbol_short!("vch_recl"), voucher_id);
    env.events().publish(topics, reclaimed_amount);
}
