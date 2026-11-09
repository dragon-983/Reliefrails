export interface UserSession {
  wallet: string;
  role: 'donor' | 'organisation' | 'beneficiary' | 'merchant' | 'auditor' | 'user';
  name?: string;
}

let currentSession: UserSession | null = {
  wallet: 'GADONOR1111111111111111111111111111111111111111111111111111',
  role: 'donor',
  name: 'Disaster Philanthropy Fund',
};

export function setSession(session: UserSession | null) {
  currentSession = session;
  if (session) {
    localStorage.setItem('reliefrail_session', JSON.stringify(session));
  } else {
    localStorage.removeItem('reliefrail_session');
  }
}

export function getSession(): UserSession | null {
  if (currentSession) return currentSession;
  try {
    const saved = localStorage.getItem('reliefrail_session');
    if (saved) {
      currentSession = JSON.parse(saved);
      return currentSession;
    }
  } catch {
    // ignore
  }
  return null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const session = getSession();
  const headers = new Headers(options.headers || {});

  headers.set('Content-Type', 'application/json');
  if (session?.wallet) {
    headers.set('x-wallet-address', session.wallet);
    headers.set('x-user-role', session.role);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }
  return data;
}

// 1. System & Auth APIs
export async function getHealth() {
  return request<any>('/api/health');
}

export async function getDemoProfiles() {
  return request<{ success: boolean; profiles: Record<string, UserSession> }>(
    '/api/auth/demo-profiles'
  );
}

export async function getWalletBalances(wallet: string) {
  return request<{ success: boolean; wallet: string; balances: { xlm: string; usdc: string } }>(
    `/api/auth/balances?wallet=${encodeURIComponent(wallet)}`
  );
}

// 2. Campaigns
export interface Campaign {
  id: number;
  on_chain_id: number;
  org_id: number;
  org_name: string;
  org_wallet: string;
  org_verified: boolean;
  title: string;
  description: string;
  target_amount: string;
  total_contributed: string;
  total_allocated: string;
  total_redeemed: string;
  token_symbol: string;
  token_address: string;
  categories: string[];
  funding_progress_pct: string;
  unallocated_balance: string;
  status: 'active' | 'paused' | 'closed';
  start_date: string;
  end_date: string;
  tx_hash?: string;
}

export async function getCampaigns(params: { status?: string; category?: string; search?: string } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.category) query.set('category', params.category);
  if (params.search) query.set('search', params.search);
  return request<{ success: boolean; campaigns: Campaign[] }>(`/api/campaigns?${query.toString()}`);
}

export async function getCampaignById(id: number | string) {
  return request<{
    success: boolean;
    campaign: Campaign;
    recentDonations: any[];
    auditTrail: any[];
  }>(`/api/campaigns/${id}`);
}

export async function createCampaign(data: {
  title: string;
  description: string;
  target_amount: number;
  categories: string[];
  duration_days?: number;
}) {
  return request<{ success: boolean; campaign: Campaign }>('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function donateToCampaign(campaignId: number | string, amount: number) {
  return request<{ success: boolean; donation: any }>(`/api/campaigns/${campaignId}/donate`, {
    method: 'POST',
    body: JSON.stringify({ amount, token_symbol: 'USDC' }),
  });
}

// 3. Beneficiaries
export interface Beneficiary {
  id: number;
  org_id: number;
  privacy_commitment: string;
  alias_label: string;
  family_size: number;
  location_zone: string;
  is_verified: boolean;
  verification_tier: string;
  voucher_count: string;
  total_unspent_aid: string;
  created_at: string;
}

export async function getBeneficiaries() {
  return request<{ success: boolean; beneficiaries: Beneficiary[] }>('/api/beneficiaries');
}

export async function registerBeneficiary(data: {
  alias_label: string;
  family_size: number;
  location_zone: string;
  verification_tier: string;
}) {
  return request<{ success: boolean; beneficiary: Beneficiary }>('/api/beneficiaries', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMyBeneficiaryVouchers(beneficiaryId?: number) {
  const query = beneficiaryId ? `?beneficiary_id=${beneficiaryId}` : '';
  return request<{
    success: boolean;
    beneficiary: any;
    vouchers: any[];
  }>(`/api/beneficiaries/me/vouchers${query}`);
}

// 4. Vouchers
export async function issueVoucher(data: {
  campaign_id: number;
  beneficiary_id: number;
  amount: number;
  max_per_tx: number;
  category: string;
  expiry_days?: number;
}) {
  return request<{ success: boolean; voucher: any; commitmentHash: string }>('/api/vouchers/issue', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getVoucherQr(voucherId: number | string) {
  return request<{ success: boolean; qrPayload: any; qrString: string }>(
    `/api/vouchers/${voucherId}/qr`,
    {
      method: 'POST',
    }
  );
}

export async function revokeVoucher(voucherId: number | string) {
  return request<{ success: boolean; voucher: any }>(`/api/vouchers/${voucherId}/revoke`, {
    method: 'POST',
  });
}

// 5. Merchants
export interface Merchant {
  id: number;
  wallet_address: string;
  business_name: string;
  category: string;
  location: string;
  contact_phone: string;
  is_approved: boolean;
  total_redeemed_amount: string;
}

export async function getMerchants() {
  return request<{ success: boolean; merchants: Merchant[] }>('/api/merchants');
}

export async function registerMerchant(data: {
  business_name: string;
  category: string;
  location: string;
  contact_phone: string;
}) {
  return request<{ success: boolean; merchant: Merchant }>('/api/merchants/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function verifyVoucherForMerchant(voucherId: number | string) {
  return request<any>('/api/merchants/verify-voucher', {
    method: 'POST',
    body: JSON.stringify({ voucher_id: voucherId }),
  });
}

export async function redeemVoucherAtMerchant(data: {
  voucher_id: number | string;
  amount: number;
  secret?: string;
}) {
  return request<{ success: boolean; redemption: any; voucher: any; txHash: string }>(
    '/api/merchants/redeem',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

// 6. Audits & Transparency
export async function getAuditTrail(params: { campaign_id?: number; event_type?: string } = {}) {
  const query = new URLSearchParams();
  if (params.campaign_id) query.set('campaign_id', params.campaign_id.toString());
  if (params.event_type) query.set('event_type', params.event_type);
  return request<{ success: boolean; events: any[] }>(`/api/audits/trail?${query.toString()}`);
}

export async function getReconciliation() {
  return request<{
    success: boolean;
    reconciliation: {
      totalDonated: number;
      totalAllocated: number;
      totalRedeemed: number;
      unallocatedPool: number;
      inFlightAid: number;
      unspentInVouchers: number;
      pendingVoucherIssuance: number;
      contractEscrowBalance: number;
      isReconciled: boolean;
      leakagePercent: number;
      auditTimestamp: string;
    };
    campaignsBreakdown: any[];
  }>('/api/audits/reconciliation');
}

export async function getAuditStats() {
  return request<{
    success: boolean;
    stats: {
      totalDonated: number;
      totalDelivered: number;
      activeCampaigns: number;
      verifiedBeneficiaries: number;
      approvedMerchants: number;
      redemptionsCount: number;
      auditTrailCount: number;
      leakageRate: string;
      settlementSpeed: string;
    };
  }>('/api/audits/stats');
}

// 7. Notifications
export async function getNotifications() {
  return request<{ success: boolean; notifications: any[] }>('/api/notifications');
}

export async function markNotificationRead(id: number) {
  return request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' });
}

