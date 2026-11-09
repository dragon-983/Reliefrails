#![no_std]
use soroban_sdk::{
    contract, contractimpl, token, Address, BytesN, Env, Symbol,
};

pub mod events;
pub mod types;

use crate::events::*;
use crate::types::*;

const LEDGER_THRESHOLD: u32 = 100_000;
const LEDGER_EXTEND_TO: u32 = 200_000;

#[contract]
pub struct ReliefRailContract;

#[contractimpl]
impl ReliefRailContract {
    /// Initialize contract with platform administrator
    pub fn initialize(env: Env, admin: Address) -> Result<(), ReliefRailError> {
        let admin_key = DataKey::Admin;
        if env.storage().instance().has(&admin_key) {
            return Err(ReliefRailError::AlreadyInitialized);
        }
        env.storage().instance().set(&admin_key, &admin);
        Ok(())
    }

    /// Organisation registers profile
    pub fn register_org(env: Env, org: Address, name: Symbol) -> Result<Organisation, ReliefRailError> {
        org.require_auth();

        let org_key = DataKey::Org(org.clone());
        if env.storage().persistent().has(&org_key) {
            return Err(ReliefRailError::Unauthorized);
        }

        let org_data = Organisation {
            admin: org.clone(),
            name: name.clone(),
            is_verified: true, // Self-governed or platform verified
            registered_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&org_key, &org_data);
        env.storage()
            .persistent()
            .extend_ttl(&org_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_org_registered(&env, &org, &name);
        Ok(org_data)
    }

    /// Platform admin verifies or suspends an organisation
    pub fn verify_org(env: Env, admin: Address, org: Address, is_verified: bool) -> Result<(), ReliefRailError> {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ReliefRailError::Unauthorized)?;

        if admin != stored_admin {
            return Err(ReliefRailError::Unauthorized);
        }

        let org_key = DataKey::Org(org.clone());
        let mut org_data: Organisation = env
            .storage()
            .persistent()
            .get(&org_key)
            .ok_or(ReliefRailError::OrgNotFound)?;

        org_data.is_verified = is_verified;
        env.storage().persistent().set(&org_key, &org_data);
        env.storage()
            .persistent()
            .extend_ttl(&org_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_org_verified(&env, &org, is_verified);
        Ok(())
    }

    /// Organisation approves a verified merchant for a specific aid category
    pub fn approve_merchant(
        env: Env,
        org: Address,
        merchant: Address,
        category: Symbol,
    ) -> Result<(), ReliefRailError> {
        org.require_auth();

        let org_key = DataKey::Org(org.clone());
        let org_data: Organisation = env
            .storage()
            .persistent()
            .get(&org_key)
            .ok_or(ReliefRailError::OrgNotFound)?;

        if !org_data.is_verified {
            return Err(ReliefRailError::OrgNotVerified);
        }

        let approval_key = DataKey::MerchantApproval(org.clone(), merchant.clone(), category.clone());
        env.storage().persistent().set(&approval_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&approval_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_merchant_approved(&env, &org, &merchant, &category);
        Ok(())
    }

    /// Organisation suspends or removes approval for a merchant
    pub fn suspend_merchant(
        env: Env,
        org: Address,
        merchant: Address,
        category: Symbol,
    ) -> Result<(), ReliefRailError> {
        org.require_auth();
        let approval_key = DataKey::MerchantApproval(org, merchant, category);
        env.storage().persistent().remove(&approval_key);
        Ok(())
    }

    /// Organisation creates a new programmable humanitarian aid campaign
    pub fn create_campaign(
        env: Env,
        campaign_id: u64,
        org: Address,
        token: Address,
        target_amount: i128,
        name: Symbol,
        start_time: u64,
        end_time: u64,
    ) -> Result<Campaign, ReliefRailError> {
        org.require_auth();

        if target_amount <= 0 {
            return Err(ReliefRailError::InvalidAmount);
        }

        if end_time <= start_time {
            return Err(ReliefRailError::InvalidTimebounds);
        }

        let org_key = DataKey::Org(org.clone());
        let org_data: Organisation = env
            .storage()
            .persistent()
            .get(&org_key)
            .ok_or(ReliefRailError::OrgNotFound)?;

        if !org_data.is_verified {
            return Err(ReliefRailError::OrgNotVerified);
        }

        let camp_key = DataKey::Campaign(campaign_id);
        if env.storage().persistent().has(&camp_key) {
            return Err(ReliefRailError::CampaignAlreadyExists);
        }

        let campaign = Campaign {
            campaign_id,
            org: org.clone(),
            token,
            name,
            target_amount,
            total_contributed: 0,
            total_allocated: 0,
            total_redeemed: 0,
            start_time,
            end_time,
            status: CampaignStatus::Active,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&camp_key, &campaign);
        env.storage()
            .persistent()
            .extend_ttl(&camp_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_campaign_created(&env, campaign_id, &org, target_amount);
        Ok(campaign)
    }

    /// Donor contributes funds (USDC or native XLM) to a campaign escrow
    pub fn fund_campaign(
        env: Env,
        campaign_id: u64,
        donor: Address,
        amount: i128,
    ) -> Result<Campaign, ReliefRailError> {
        donor.require_auth();

        if amount <= 0 {
            return Err(ReliefRailError::InvalidAmount);
        }

        let camp_key = DataKey::Campaign(campaign_id);
        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&camp_key)
            .ok_or(ReliefRailError::CampaignNotFound)?;

        if campaign.status == CampaignStatus::Closed {
            return Err(ReliefRailError::CampaignClosed);
        }

        if campaign.status == CampaignStatus::Paused {
            return Err(ReliefRailError::CampaignPaused);
        }

        let token_client = token::Client::new(&env, &campaign.token);
        token_client.transfer(&donor, &env.current_contract_address(), &amount);

        campaign.total_contributed = campaign
            .total_contributed
            .checked_add(amount)
            .ok_or(ReliefRailError::ArithmeticOverflow)?;

        env.storage().persistent().set(&camp_key, &campaign);
        env.storage()
            .persistent()
            .extend_ttl(&camp_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_donation_received(&env, campaign_id, &donor, amount);
        Ok(campaign)
    }

    /// Emergency pause / resume for a campaign
    pub fn pause_campaign(
        env: Env,
        campaign_id: u64,
        org: Address,
        is_paused: bool,
    ) -> Result<Campaign, ReliefRailError> {
        let camp_key = DataKey::Campaign(campaign_id);
        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&camp_key)
            .ok_or(ReliefRailError::CampaignNotFound)?;

        if campaign.org != org {
            return Err(ReliefRailError::Unauthorized);
        }
        org.require_auth();

        campaign.status = if is_paused {
            CampaignStatus::Paused
        } else {
            CampaignStatus::Active
        };

        env.storage().persistent().set(&camp_key, &campaign);
        Ok(campaign)
    }

    /// Mark campaign as closed
    pub fn close_campaign(env: Env, campaign_id: u64, org: Address) -> Result<Campaign, ReliefRailError> {
        let camp_key = DataKey::Campaign(campaign_id);
        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&camp_key)
            .ok_or(ReliefRailError::CampaignNotFound)?;

        if campaign.org != org {
            return Err(ReliefRailError::Unauthorized);
        }
        org.require_auth();

        campaign.status = CampaignStatus::Closed;
        env.storage().persistent().set(&camp_key, &campaign);
        Ok(campaign)
    }

    /// Organisation allocates aid to a beneficiary (identified by privacy-preserving commitment)
    pub fn allocate_aid(
        env: Env,
        allocation_id: u64,
        campaign_id: u64,
        org: Address,
        beneficiary_commitment: BytesN<32>,
        amount: i128,
        category: Symbol,
        expiry: u64,
    ) -> Result<AidAllocation, ReliefRailError> {
        org.require_auth();

        if amount <= 0 {
            return Err(ReliefRailError::InvalidAmount);
        }

        let camp_key = DataKey::Campaign(campaign_id);
        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&camp_key)
            .ok_or(ReliefRailError::CampaignNotFound)?;

        if campaign.org != org {
            return Err(ReliefRailError::Unauthorized);
        }

        if campaign.status != CampaignStatus::Active {
            return Err(ReliefRailError::CampaignClosed);
        }

        // Check campaign unallocated funds: total_contributed - total_allocated >= amount
        let unallocated = campaign
            .total_contributed
            .checked_sub(campaign.total_allocated)
            .ok_or(ReliefRailError::ArithmeticOverflow)?;

        if unallocated < amount {
            return Err(ReliefRailError::InsufficientCampaignFunds);
        }

        let alloc_key = DataKey::Allocation(allocation_id);
        if env.storage().persistent().has(&alloc_key) {
            return Err(ReliefRailError::AllocationAlreadyExists);
        }

        campaign.total_allocated = campaign
            .total_allocated
            .checked_add(amount)
            .ok_or(ReliefRailError::ArithmeticOverflow)?;

        let allocation = AidAllocation {
            allocation_id,
            campaign_id,
            org: org.clone(),
            beneficiary_commitment,
            amount,
            category: category.clone(),
            expiry,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&camp_key, &campaign);
        env.storage()
            .persistent()
            .extend_ttl(&camp_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        env.storage().persistent().set(&alloc_key, &allocation);
        env.storage()
            .persistent()
            .extend_ttl(&alloc_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_aid_allocated(&env, allocation_id, campaign_id, amount, &category);
        Ok(allocation)
    }

    /// Issues a programmable aid voucher corresponding to an allocation
    pub fn issue_voucher(
        env: Env,
        voucher_id: u64,
        allocation_id: u64,
        org: Address,
        max_redemption_per_tx: i128,
    ) -> Result<AidVoucher, ReliefRailError> {
        org.require_auth();

        let alloc_key = DataKey::Allocation(allocation_id);
        let allocation: AidAllocation = env
            .storage()
            .persistent()
            .get(&alloc_key)
            .ok_or(ReliefRailError::AllocationNotFound)?;

        if allocation.org != org {
            return Err(ReliefRailError::Unauthorized);
        }

        let camp_key = DataKey::Campaign(allocation.campaign_id);
        let campaign: Campaign = env
            .storage()
            .persistent()
            .get(&camp_key)
            .ok_or(ReliefRailError::CampaignNotFound)?;

        let vch_key = DataKey::Voucher(voucher_id);
        if env.storage().persistent().has(&vch_key) {
            return Err(ReliefRailError::VoucherAlreadyExists);
        }

        let max_tx = if max_redemption_per_tx <= 0 || max_redemption_per_tx > allocation.amount {
            allocation.amount
        } else {
            max_redemption_per_tx
        };

        let voucher = AidVoucher {
            voucher_id,
            allocation_id,
            campaign_id: allocation.campaign_id,
            token: campaign.token.clone(),
            initial_amount: allocation.amount,
            remaining_amount: allocation.amount,
            category: allocation.category.clone(),
            expiry: allocation.expiry,
            max_redemption_per_tx: max_tx,
            status: VoucherStatus::Active,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&vch_key, &voucher);
        env.storage()
            .persistent()
            .extend_ttl(&vch_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_voucher_issued(&env, voucher_id, allocation_id, allocation.amount, &allocation.category);
        Ok(voucher)
    }

    /// Approved merchant redeems authorized voucher amount and receives immediate token settlement
    pub fn redeem_voucher(
        env: Env,
        voucher_id: u64,
        merchant: Address,
        amount: i128,
        credential_nonce: BytesN<32>,
    ) -> Result<AidVoucher, ReliefRailError> {
        merchant.require_auth();

        if amount <= 0 {
            return Err(ReliefRailError::InvalidAmount);
        }

        // Replay attack prevention: verify nonce has never been used
        let nonce_key = DataKey::UsedNonce(credential_nonce.clone());
        if env.storage().persistent().has(&nonce_key) {
            return Err(ReliefRailError::CredentialNonceReused);
        }

        let vch_key = DataKey::Voucher(voucher_id);
        let mut voucher: AidVoucher = env
            .storage()
            .persistent()
            .get(&vch_key)
            .ok_or(ReliefRailError::VoucherNotFound)?;

        if voucher.status != VoucherStatus::Active {
            return Err(ReliefRailError::VoucherNotActive);
        }

        // Check expiration
        if env.ledger().timestamp() > voucher.expiry {
            voucher.status = VoucherStatus::Expired;
            env.storage().persistent().set(&vch_key, &voucher);
            return Err(ReliefRailError::VoucherExpired);
        }

        // Check campaign status
        let camp_key = DataKey::Campaign(voucher.campaign_id);
        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&camp_key)
            .ok_or(ReliefRailError::CampaignNotFound)?;

        if campaign.status == CampaignStatus::Paused {
            return Err(ReliefRailError::CampaignPaused);
        }

        // Check merchant approval for this organisation and category
        let approval_key = DataKey::MerchantApproval(campaign.org.clone(), merchant.clone(), voucher.category.clone());
        if !env.storage().persistent().has(&approval_key) {
            return Err(ReliefRailError::MerchantNotApproved);
        }

        // Verify balance and limits
        if amount > voucher.remaining_amount {
            return Err(ReliefRailError::InsufficientVoucherBalance);
        }

        if amount > voucher.max_redemption_per_tx {
            return Err(ReliefRailError::ExceedsMaxRedemptionPerTx);
        }

        // Mark nonce consumed
        env.storage().persistent().set(&nonce_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&nonce_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        // Execute token settlement to merchant
        let token_client = token::Client::new(&env, &voucher.token);
        token_client.transfer(&env.current_contract_address(), &merchant, &amount);

        // Update voucher balance
        voucher.remaining_amount = voucher
            .remaining_amount
            .checked_sub(amount)
            .ok_or(ReliefRailError::ArithmeticOverflow)?;

        if voucher.remaining_amount == 0 {
            voucher.status = VoucherStatus::Redeemed;
        }

        // Update campaign redeemed total
        campaign.total_redeemed = campaign
            .total_redeemed
            .checked_add(amount)
            .ok_or(ReliefRailError::ArithmeticOverflow)?;

        env.storage().persistent().set(&vch_key, &voucher);
        env.storage()
            .persistent()
            .extend_ttl(&vch_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        env.storage().persistent().set(&camp_key, &campaign);
        env.storage()
            .persistent()
            .extend_ttl(&camp_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_voucher_redeemed(&env, voucher_id, &merchant, amount, voucher.remaining_amount);
        Ok(voucher)
    }

    /// Organisation revokes a voucher; remaining balance is returned to campaign unallocated pool
    pub fn revoke_voucher(env: Env, voucher_id: u64, org: Address) -> Result<AidVoucher, ReliefRailError> {
        let vch_key = DataKey::Voucher(voucher_id);
        let mut voucher: AidVoucher = env
            .storage()
            .persistent()
            .get(&vch_key)
            .ok_or(ReliefRailError::VoucherNotFound)?;

        let camp_key = DataKey::Campaign(voucher.campaign_id);
        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&camp_key)
            .ok_or(ReliefRailError::CampaignNotFound)?;

        if campaign.org != org {
            return Err(ReliefRailError::Unauthorized);
        }
        org.require_auth();

        if voucher.status != VoucherStatus::Active {
            return Err(ReliefRailError::VoucherNotActive);
        }

        let reclaimed = voucher.remaining_amount;
        voucher.remaining_amount = 0;
        voucher.status = VoucherStatus::Revoked;

        // Restore unallocated funds in campaign by reducing total_allocated
        campaign.total_allocated = campaign
            .total_allocated
            .checked_sub(reclaimed)
            .ok_or(ReliefRailError::ArithmeticOverflow)?;

        env.storage().persistent().set(&vch_key, &voucher);
        env.storage().persistent().set(&camp_key, &campaign);

        emit_voucher_revoked(&env, voucher_id, reclaimed);
        Ok(voucher)
    }

    /// Organisation reclaims remaining funds from an expired voucher back to unallocated campaign pool
    pub fn reclaim_expired_voucher(env: Env, voucher_id: u64, org: Address) -> Result<AidVoucher, ReliefRailError> {
        let vch_key = DataKey::Voucher(voucher_id);
        let mut voucher: AidVoucher = env
            .storage()
            .persistent()
            .get(&vch_key)
            .ok_or(ReliefRailError::VoucherNotFound)?;

        let camp_key = DataKey::Campaign(voucher.campaign_id);
        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&camp_key)
            .ok_or(ReliefRailError::CampaignNotFound)?;

        if campaign.org != org {
            return Err(ReliefRailError::Unauthorized);
        }
        org.require_auth();

        if env.ledger().timestamp() <= voucher.expiry {
            return Err(ReliefRailError::VoucherNotExpired);
        }

        if voucher.status == VoucherStatus::Revoked || voucher.status == VoucherStatus::Redeemed {
            return Err(ReliefRailError::VoucherNotActive);
        }

        let reclaimed = voucher.remaining_amount;
        voucher.remaining_amount = 0;
        voucher.status = VoucherStatus::Expired;

        // Return reclaimed amount to campaign unallocated pool
        campaign.total_allocated = campaign
            .total_allocated
            .checked_sub(reclaimed)
            .ok_or(ReliefRailError::ArithmeticOverflow)?;

        env.storage().persistent().set(&vch_key, &voucher);
        env.storage().persistent().set(&camp_key, &campaign);

        emit_voucher_reclaimed(&env, voucher_id, reclaimed);
        Ok(voucher)
    }

    /// Organisation withdraws unallocated funds after campaign is closed
    pub fn withdraw_unallocated_funds(
        env: Env,
        campaign_id: u64,
        org: Address,
        recipient: Address,
    ) -> Result<i128, ReliefRailError> {
        let camp_key = DataKey::Campaign(campaign_id);
        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&camp_key)
            .ok_or(ReliefRailError::CampaignNotFound)?;

        if campaign.org != org {
            return Err(ReliefRailError::Unauthorized);
        }
        org.require_auth();

        if campaign.status != CampaignStatus::Closed {
            return Err(ReliefRailError::CampaignStillActive);
        }

        // Unallocated = total_contributed - total_allocated
        let unallocated = campaign
            .total_contributed
            .checked_sub(campaign.total_allocated)
            .ok_or(ReliefRailError::ArithmeticOverflow)?;

        if unallocated <= 0 {
            return Err(ReliefRailError::InvalidAmount);
        }

        let token_client = token::Client::new(&env, &campaign.token);
        token_client.transfer(&env.current_contract_address(), &recipient, &unallocated);

        campaign.total_contributed = campaign
            .total_contributed
            .checked_sub(unallocated)
            .ok_or(ReliefRailError::ArithmeticOverflow)?;

        env.storage().persistent().set(&camp_key, &campaign);
        Ok(unallocated)
    }

    // --- Query Getters ---

    pub fn get_campaign(env: Env, campaign_id: u64) -> Result<Campaign, ReliefRailError> {
        env.storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .ok_or(ReliefRailError::CampaignNotFound)
    }

    pub fn get_allocation(env: Env, allocation_id: u64) -> Result<AidAllocation, ReliefRailError> {
        env.storage()
            .persistent()
            .get(&DataKey::Allocation(allocation_id))
            .ok_or(ReliefRailError::AllocationNotFound)
    }

    pub fn get_voucher(env: Env, voucher_id: u64) -> Result<AidVoucher, ReliefRailError> {
        env.storage()
            .persistent()
            .get(&DataKey::Voucher(voucher_id))
            .ok_or(ReliefRailError::VoucherNotFound)
    }

    pub fn get_org(env: Env, org: Address) -> Result<Organisation, ReliefRailError> {
        env.storage()
            .persistent()
            .get(&DataKey::Org(org))
            .ok_or(ReliefRailError::OrgNotFound)
    }

    pub fn is_merchant_approved(
        env: Env,
        org: Address,
        merchant: Address,
        category: Symbol,
    ) -> bool {
        let key = DataKey::MerchantApproval(org, merchant, category);
        env.storage().persistent().has(&key)
    }

    pub fn get_campaign_stats(env: Env, campaign_id: u64) -> Result<(i128, i128, i128, i128), ReliefRailError> {
        let campaign = Self::get_campaign(env, campaign_id)?;
        Ok((
            campaign.target_amount,
            campaign.total_contributed,
            campaign.total_allocated,
            campaign.total_redeemed,
        ))
    }
}

#[cfg(test)]
mod test;

