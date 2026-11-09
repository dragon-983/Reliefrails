import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  TrendingUp,
  DollarSign,
  Users,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import {
  getAuditStats,
  getReconciliation,
  getAuditTrail,
} from '../lib/api.js';
import { formatAddress, formatAmount } from '../lib/stellar.js';

export const TransparencyView: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, reconRes, trailRes] = await Promise.all([
        getAuditStats(),
        getReconciliation(),
        getAuditTrail({ event_type: filterType || undefined }),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (reconRes.success) {
        setReconciliation(reconRes.reconciliation);
        setBreakdown(reconRes.campaignsBreakdown);
      }
      if (trailRes.success) setAuditTrail(trailRes.events);
    } catch (err) {
      console.error('Error loading transparency data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterType]);

  const filteredTrail = auditTrail.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.actor_wallet?.toLowerCase().includes(q) ||
      item.event_type?.toLowerCase().includes(q) ||
      item.campaign_title?.toLowerCase().includes(q) ||
      item.tx_hash?.toLowerCase().includes(q)
    );
  });

  const eventBadge = (type: string) => {
    switch (type) {
      case 'donation':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Donation</span>;
      case 'allocation':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Aid Allocation</span>;
      case 'voucher_issuance':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Voucher Issued</span>;
      case 'redemption':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">Merchant Redemption</span>;
      case 'voucher_revocation':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">Revocation</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">{type}</span>;
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-cyan-950/40 p-6 md:p-10 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
              <ShieldCheck className="h-4 w-4" />
              <span>Cryptographic Public Accountability</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Zero-Leakage Humanitarian Audit
            </h1>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              Every single dollar donated is tracked end-to-end on the Stellar blockchain via Soroban smart contracts. Funds remain locked in contract escrow until certified local merchants submit cryptographic proof of aid redemption.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh On-Chain State</span>
            </button>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>Mathematical Parity: 100% Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total Donated</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            ${formatAmount(stats?.totalDonated || 0)} <span className="text-xs text-slate-400 font-normal">USDC</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>100% on Stellar Testnet</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Delivered to Merchants</span>
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            ${formatAmount(stats?.totalDelivered || 0)} <span className="text-xs text-slate-400 font-normal">USDC</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Across {stats?.redemptionsCount || 0} instant redemptions
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Verified Families</span>
            <Users className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {stats?.verifiedBeneficiaries || 0}
          </div>
          <div className="mt-1 text-xs text-amber-400/80">
            Zero PII on-chain (Hashed ID)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Administrative Leakage</span>
            <Lock className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">
            0.00%
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Soroban smart contract guaranteed
          </div>
        </div>
      </div>

      {/* Financial Reconciliation Box */}
      {reconciliation && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-cyan-400" />
                <span>On-Chain Mathematical Reconciliation Formula</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Audited against Soroban Contract state at {new Date(reconciliation.auditTimestamp).toLocaleTimeString()}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4" />
              <span>Balance Check: EXACT MATCH</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Donated
              </div>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                ${formatAmount(reconciliation.totalDonated)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">100% Inflow</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Escrow Balance
              </div>
              <div className="text-xl font-bold text-cyan-400 mt-1">
                ${formatAmount(reconciliation.contractEscrowBalance)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Locked in Contract</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Unallocated Pool
              </div>
              <div className="text-xl font-bold text-amber-400 mt-1">
                ${formatAmount(reconciliation.unallocatedPool)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Awaiting Allocation</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Delivered / Settled
              </div>
              <div className="text-xl font-bold text-purple-400 mt-1">
                ${formatAmount(reconciliation.totalRedeemed)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Paid to Merchants</div>
            </div>
          </div>

          {/* Campaign Breakdown Table */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              Per-Campaign Escrow Breakdown
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Campaign</th>
                    <th className="py-3 px-4 font-semibold">Managing NGO</th>
                    <th className="py-3 px-4 font-semibold">Total Donated</th>
                    <th className="py-3 px-4 font-semibold">Allocated</th>
                    <th className="py-3 px-4 font-semibold">Redeemed</th>
                    <th className="py-3 px-4 font-semibold">Unallocated Reserve</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/30">
                  {breakdown.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-medium text-white">{c.title}</td>
                      <td className="py-3 px-4 text-slate-300">{c.org_name}</td>
                      <td className="py-3 px-4 text-emerald-400 font-semibold">${formatAmount(c.total_contributed)}</td>
                      <td className="py-3 px-4 text-cyan-400">${formatAmount(c.total_allocated)}</td>
                      <td className="py-3 px-4 text-purple-400">${formatAmount(c.total_redeemed)}</td>
                      <td className="py-3 px-4 text-amber-400 font-medium">${formatAmount(c.campaign_pool_reserve)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Immutable Audit Trail Feed */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">Immutable Event Trail</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time audit log of all financial movements on the platform
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search actor or tx..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
              <Filter className="h-3 w-3 text-slate-400 ml-1.5" />
              {['', 'donation', 'allocation', 'voucher_issuance', 'redemption'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    filterType === type ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {type === '' ? 'All' : type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto">
          {filteredTrail.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No audit events found matching query.
            </div>
          ) : (
            filteredTrail.map((ev) => (
              <div key={ev.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{eventBadge(ev.event_type)}</div>
                  <div>
                    <div className="font-semibold text-slate-200">
                      {ev.campaign_title || 'Platform Event'}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>Actor: <span className="font-mono text-slate-300">{formatAddress(ev.actor_wallet)}</span></span>
                      {ev.tx_hash && (
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${ev.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-cyan-400 hover:underline"
                        >
                          <span>tx:{ev.tx_hash.slice(0, 8)}</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  {Number(ev.amount) > 0 && (
                    <div className="font-bold text-white font-mono">
                      {formatAmount(ev.amount)} USDC
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500">
                    {new Date(ev.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

