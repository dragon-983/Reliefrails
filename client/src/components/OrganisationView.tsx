import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Users,
  Ticket,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Lock,
  ArrowRight,
} from 'lucide-react';
import {
  getCampaigns,
  getBeneficiaries,
  createCampaign,
  registerBeneficiary,
  issueVoucher,
  Campaign,
  Beneficiary,
  UserSession,
} from '../lib/api.js';
import { formatAmount } from '../lib/stellar.js';

interface OrganisationViewProps {
  session: UserSession | null;
  onOpenWalletModal: () => void;
}

export const OrganisationView: React.FC<OrganisationViewProps> = ({ session, onOpenWalletModal }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [showRegisterBeneficiary, setShowRegisterBeneficiary] = useState(false);
  const [showIssueVoucher, setShowIssueVoucher] = useState(false);

  // Form states
  const [campTitle, setCampTitle] = useState('');
  const [campDesc, setCampDesc] = useState('');
  const [campTarget, setCampTarget] = useState<number>(25000);
  const [campCategories, setCampCategories] = useState<string[]>(['FOOD', 'MEDS']);

  const [benAlias, setBenAlias] = useState('');
  const [benFamilySize, setBenFamilySize] = useState<number>(4);
  const [benZone, setBenZone] = useState('ZONE_NORTH_A');

  const [voucherCampaignId, setVoucherCampaignId] = useState<number | ''>('');
  const [voucherBenId, setVoucherBenId] = useState<number | ''>('');
  const [voucherAmount, setVoucherAmount] = useState<number>(200);
  const [voucherMaxPerTx, setVoucherMaxPerTx] = useState<number>(75);
  const [voucherCategory, setVoucherCategory] = useState('FOOD');

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [campRes, benRes] = await Promise.all([getCampaigns(), getBeneficiaries()]);
      if (campRes.success) setCampaigns(campRes.campaigns);
      if (benRes.success) setBeneficiaries(benRes.beneficiaries);
    } catch (err) {
      console.error('Error loading NGO data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.wallet) return onOpenWalletModal();

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await createCampaign({
        title: campTitle,
        description: campDesc,
        target_amount: campTarget,
        categories: campCategories,
      });
      if (res.success) {
        setActionSuccess(`Campaign "${res.campaign.title}" created successfully!`);
        setShowCreateCampaign(false);
        setCampTitle('');
        setCampDesc('');
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.wallet) return onOpenWalletModal();

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await registerBeneficiary({
        alias_label: benAlias,
        family_size: benFamilySize,
        location_zone: benZone,
        verification_tier: 'tier_1',
      });
      if (res.success) {
        setActionSuccess(
          `Beneficiary "${res.beneficiary.alias_label}" registered with zero-PII privacy commitment!`
        );
        setShowRegisterBeneficiary(false);
        setBenAlias('');
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register beneficiary');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIssueVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.wallet) return onOpenWalletModal();
    if (!voucherCampaignId || !voucherBenId) return;

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await issueVoucher({
        campaign_id: Number(voucherCampaignId),
        beneficiary_id: Number(voucherBenId),
        amount: voucherAmount,
        max_per_tx: voucherMaxPerTx,
        category: voucherCategory,
      });
      if (res.success) {
        setActionSuccess(
          `Issued ${voucherAmount} USDC ${voucherCategory} voucher (Secret: ${res.voucher.redemption_credential_secret})`
        );
        setShowIssueVoucher(false);
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to issue voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-cyan-950/40 p-6 md:p-10 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
              <Shield className="h-4 w-4" />
              <span>Humanitarian Organization Portal</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              NGO Field & Aid Command
            </h1>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              Manage crisis relief operations, launch smart-contract campaigns, enroll verified families with zero-PII privacy protection, and issue programmable vouchers restricted to essential categories.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setShowCreateCampaign(true);
                setActionSuccess(null);
                setErrorMsg('');
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-900/30"
            >
              <Plus className="h-4 w-4" />
              <span>Launch Campaign</span>
            </button>
            <button
              onClick={() => {
                setShowRegisterBeneficiary(true);
                setActionSuccess(null);
                setErrorMsg('');
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Users className="h-4 w-4 text-amber-400" />
              <span>Add Beneficiary</span>
            </button>
            <button
              onClick={() => {
                setShowIssueVoucher(true);
                setActionSuccess(null);
                setErrorMsg('');
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Ticket className="h-4 w-4 text-emerald-400" />
              <span>Issue Voucher</span>
            </button>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Sections: Campaigns & Beneficiaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Managed Campaigns */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-400" />
              <span>Active Relief Campaigns ({campaigns.length})</span>
            </h2>
          </div>

          <div className="space-y-3">
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-sm text-white">{camp.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Goal: ${formatAmount(camp.target_amount)} USDC | Status:{' '}
                      <span className="text-emerald-400 font-medium capitalize">{camp.status}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">
                    ${formatAmount(camp.total_contributed)} Raised
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Allocated</div>
                    <div className="font-bold text-cyan-400 mt-0.5">
                      ${formatAmount(camp.total_allocated)}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Redeemed</div>
                    <div className="font-bold text-purple-400 mt-0.5">
                      ${formatAmount(camp.total_redeemed)}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Reserve Pool</div>
                    <div className="font-bold text-amber-400 mt-0.5">
                      ${formatAmount(camp.unallocated_balance)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Beneficiaries List */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-400" />
              <span>Registered Families ({beneficiaries.length})</span>
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <Lock className="h-3 w-3" />
              <span>Zero-PII Hashed</span>
            </div>
          </div>

          <div className="space-y-3">
            {beneficiaries.map((ben) => (
              <div
                key={ben.id}
                className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-sm text-white">{ben.alias_label}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Family Size: {ben.family_size} | Zone: {ben.location_zone}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 truncate max-w-xs mt-1">
                    Commitment: {ben.privacy_commitment.slice(0, 16)}...
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-cyan-400">
                    ${formatAmount(ben.total_unspent_aid)} USDC
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {ben.voucher_count} Active Vouchers
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal: Create Campaign */}
      {showCreateCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Launch New Humanitarian Campaign</h3>
              <button onClick={() => setShowCreateCampaign(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Campaign Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cyclone Relocation Food & Shelter"
                  value={campTitle}
                  onChange={(e) => setCampTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Target Amount (USDC)</label>
                <input
                  type="number"
                  required
                  min="100"
                  step="50"
                  value={campTarget}
                  onChange={(e) => setCampTarget(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Description & Mission</label>
                <textarea
                  rows={3}
                  placeholder="Explain how funds will be distributed via programmable vouchers..."
                  value={campDesc}
                  onChange={(e) => setCampDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {errorMsg && (
                <div className="text-xs text-rose-400 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-cyan-900/30"
              >
                {isSubmitting ? 'Creating Campaign...' : 'Launch On-Chain Campaign'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Register Beneficiary */}
      {showRegisterBeneficiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Register Verified Family (Zero-PII)</h3>
              <button onClick={() => setShowRegisterBeneficiary(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleRegisterBeneficiary} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Pseudonymous Alias Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Household AF-502"
                  value={benAlias}
                  onChange={(e) => setBenAlias(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Names or government IDs are never uploaded or stored on-chain.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Family Size</label>
                  <input
                    type="number"
                    min="1"
                    value={benFamilySize}
                    onChange={(e) => setBenFamilySize(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Relief Zone</label>
                  <input
                    type="text"
                    value={benZone}
                    onChange={(e) => setBenZone(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="text-xs text-rose-400 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-amber-900/30"
              >
                {isSubmitting ? 'Registering...' : 'Register Beneficiary'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Issue Voucher */}
      {showIssueVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Issue Programmable Aid Voucher</h3>
              <button onClick={() => setShowIssueVoucher(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleIssueVoucher} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Source Campaign</label>
                <select
                  required
                  value={voucherCampaignId}
                  onChange={(e) => setVoucherCampaignId(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Select a Campaign</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} (Available: ${formatAmount(c.unallocated_balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Recipient Beneficiary</label>
                <select
                  required
                  value={voucherBenId}
                  onChange={(e) => setVoucherBenId(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Select Beneficiary</option>
                  {beneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.alias_label} (Zone: {b.location_zone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Amount (USDC)</label>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    value={voucherAmount}
                    onChange={(e) => setVoucherAmount(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Per-Tx Limit</label>
                  <input
                    type="number"
                    min="10"
                    step="5"
                    value={voucherMaxPerTx}
                    onChange={(e) => setVoucherMaxPerTx(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Restricted Category</label>
                <select
                  value={voucherCategory}
                  onChange={(e) => setVoucherCategory(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="FOOD">FOOD (Groceries, Bakeries, Nutrition)</option>
                  <option value="MEDS">MEDS (Pharmacies, Clinics, First Aid)</option>
                  <option value="SHELTER">SHELTER (Building Materials, Insulation)</option>
                  <option value="SUPPLIES">SUPPLIES (Tools, Fuel, Hygiene)</option>
                </select>
              </div>

              {errorMsg && (
                <div className="text-xs text-rose-400 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-900/30"
              >
                {isSubmitting ? 'Issuing...' : 'Issue Programmable Voucher'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

