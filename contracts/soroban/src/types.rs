use soroban_sdk::{contracterror, contracttype, Address, BytesN, Symbol};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ReliefRailError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    OrgNotFound = 3,
    OrgNotVerified = 4,
    CampaignNotFound = 5,
    CampaignClosed = 6,
    CampaignPaused = 7,
    InsufficientCampaignFunds = 8,
    AllocationNotFound = 9,
    VoucherNotFound = 10,
    VoucherNotActive = 11,
    VoucherExpired = 12,
    VoucherRevoked = 13,
    InsufficientVoucherBalance = 14,
    ExceedsMaxRedemptionPerTx = 15,
    MerchantNotApproved = 16,
    CategoryMismatch = 17,
    CredentialNonceReused = 18,
    InvalidAmount = 19,
    ArithmeticOverflow = 20,
    InvalidTimebounds = 21,
    VoucherNotExpired = 22,
    CampaignStillActive = 23,
    CampaignAlreadyExists = 24,
    AllocationAlreadyExists = 25,
    VoucherAlreadyExists = 26,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum CampaignStatus {
    Active = 0,
    Paused = 1,
    Closed = 2,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VoucherStatus {
    Active = 0,
    Redeemed = 1,
    Revoked = 2,
    Expired = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Organisation {
    pub admin: Address,
    pub name: Symbol,
    pub is_verified: bool,
    pub registered_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Campaign {
    pub campaign_id: u64,
    pub org: Address,
    pub token: Address,
    pub name: Symbol,
    pub target_amount: i128,
    pub total_contributed: i128,
    pub total_allocated: i128,
    pub total_redeemed: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub status: CampaignStatus,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AidAllocation {
    pub allocation_id: u64,
    pub campaign_id: u64,
    pub org: Address,
    pub beneficiary_commitment: BytesN<32>,
    pub amount: i128,
    pub category: Symbol,
    pub expiry: u64,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AidVoucher {
    pub voucher_id: u64,
    pub allocation_id: u64,
    pub campaign_id: u64,
    pub token: Address,
    pub initial_amount: i128,
    pub remaining_amount: i128,
    pub category: Symbol,
    pub expiry: u64,
    pub max_redemption_per_tx: i128,
    pub status: VoucherStatus,
    pub created_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Org(Address),
    MerchantApproval(Address, Address, Symbol), // org, merchant, category
    Campaign(u64),
    Allocation(u64),
    Voucher(u64),
    UsedNonce(BytesN<32>),
}
