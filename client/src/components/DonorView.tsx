import React, { useState, useEffect } from 'react';
import {
  Heart,
  Search,
  Filter,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  DollarSign,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { getCampaigns, donateToCampaign, Campaign, UserSession } from '../lib/api.js';
import { formatAmount } from '../lib/stellar.js';

interface DonorViewProps {
  session: UserSession | null;
  onOpenWalletModal: () => void;
}

export const DonorView: React.FC<DonorViewProps> = ({ session, onOpenWalletModal }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [donatingCampaign, setDonatingCampaign] = useState<Campaign | null>(null);
  const [donationAmount, setDonationAmount] = useState<number>(100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [donationSuccess, setDonationSuccess] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await getCampaigns({
        category: selectedCategory || undefined,
        search: searchQuery || undefined,
      });
      if (res.success) {
        setCampaigns(res.campaigns);
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [selectedCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadCampaigns();
  };

  const handleDonate = async () => {
    if (!session?.wallet) {
      onOpenWalletModal();
      return;
    }

    if (!donatingCampaign || donationAmount <= 0) return;

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await donateToCampaign(donatingCampaign.id, donationAmount);
      if (res.success) {
        setDonationSuccess(res.donation);
        loadCampaigns();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Donation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryBadges: Record<string, { label: string; bg: string; text: string }> = {
    FOOD: { label: 'Food Security', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    MEDS: { label: 'Medical Relief', bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
    SHELTER: { label: 'Emergency Shelter', bg: 'bg-amber-500/10', text: 'text-amber-400' },
    EDU: { label: 'Education Aid', bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
    SUPPLIES: { label: 'Supplies & Tools', bg: 'bg-purple-500/10', text: 'text-purple-400' },
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 p-6 md:p-10 shadow-2xl">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <Sparkles className="h-4 w-4" />
            <span>Stellar Programmable Aid</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Direct, Provable Humanitarian Support
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            Send digital aid directly to disaster-affected communities in USDC on Stellar. Your funds are held in Soroban smart escrow and can only be claimed when verified local merchants fulfill food, medicine, or shelter vouchers.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="relative w-full sm:w-96">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search campaigns, disasters, or NGOs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400 mr-1" />
          {['', 'FOOD', 'MEDS', 'SHELTER'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat === '' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Campaigns Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="py-20 text-center text-xs text-slate-500">
          No active humanitarian campaigns found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((camp) => {
            const pct = Math.min(Number(camp.funding_progress_pct) || 0, 100);
            return (
              <div
                key={camp.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm hover:border-slate-700 transition-all shadow-lg"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {camp.categories?.map((cat) => (
                        <span
                          key={cat}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            categoryBadges[cat]?.bg || 'bg-slate-800'
                          } ${categoryBadges[cat]?.text || 'text-slate-300'}`}
                        >
                          {categoryBadges[cat]?.label || cat}
                        </span>
                      ))}
                    </div>
                    {camp.org_verified && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                        <ShieldCheck className="h-3 w-3" />
                        <span>Verified NGO</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white line-clamp-1">{camp.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                      {camp.description}
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Organized by: <span className="text-slate-300 font-medium">{camp.org_name}</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">
                        ${formatAmount(camp.total_contributed)}{' '}
                        <span className="text-slate-400 font-normal">raised</span>
                      </span>
                      <span className="text-slate-400">
                        Goal: ${formatAmount(camp.target_amount)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{pct.toFixed(0)}% Funded</span>
                      <span>${formatAmount(camp.unallocated_balance)} unallocated</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-[10px] text-slate-500 font-mono">
                    Token: {camp.token_symbol} (Stellar)
                  </div>
                  <button
                    onClick={() => {
                      setDonatingCampaign(camp);
                      setDonationSuccess(null);
                      setErrorMsg('');
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md shadow-emerald-900/30"
                  >
                    <Heart className="h-3.5 w-3.5" />
                    <span>Support Campaign</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Donation Modal */}
      {donatingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Make a Direct Aid Donation</h3>
              </div>
              <button
                onClick={() => setDonatingCampaign(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {donationSuccess ? (
              <div className="space-y-4 text-center py-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Donation Successfully Locked in Escrow!</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Your contribution has been recorded on the Stellar Testnet ledger and added to the campaign reserve.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-left text-xs space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Amount:</span>
                    <span className="font-bold text-white">${formatAmount(donationSuccess.amount)} USDC</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Tx Hash:</span>
                    <span className="font-mono text-cyan-400 truncate max-w-[200px]">
                      {donationSuccess.tx_hash}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setDonatingCampaign(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="text-xs text-slate-400">Target Campaign:</div>
                  <div className="text-sm font-bold text-white">{donatingCampaign.title}</div>
                  <div className="text-[11px] text-slate-400">
                    Managing NGO: {donatingCampaign.org_name}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Select Contribution Amount (USDC)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[25, 50, 100, 250].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setDonationAmount(amt)}
                        className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                          donationAmount === amt
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>

                  <div className="relative mt-2">
                    <DollarSign className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(Number(e.target.value))}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      placeholder="Custom amount"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>100% Escrow Protection</span>
                  </div>
                  <p>
                    Funds remain in the Soroban contract escrow and cannot be withdrawn as cash. Only verified local merchants can claim reimbursement upon fulfilling vouchers.
                  </p>
                </div>

                <button
                  onClick={handleDonate}
                  disabled={isSubmitting || donationAmount <= 0}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span>Submitting On-Chain Transaction...</span>
                  ) : (
                    <>
                      <Heart className="h-4 w-4" />
                      <span>Confirm Donation of ${formatAmount(donationAmount)} USDC</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

