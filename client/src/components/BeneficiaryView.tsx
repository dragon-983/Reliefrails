import React, { useState, useEffect } from 'react';
import {
  Ticket,
  QrCode,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  Info,
} from 'lucide-react';
import { getMyBeneficiaryVouchers, getVoucherQr, UserSession } from '../lib/api.js';
import { formatAmount } from '../lib/stellar.js';

interface BeneficiaryViewProps {
  session: UserSession | null;
  onOpenWalletModal: () => void;
}

export const BeneficiaryView: React.FC<BeneficiaryViewProps> = ({ session, onOpenWalletModal }) => {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [beneficiary, setBeneficiary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVoucherQr, setSelectedVoucherQr] = useState<any>(null);
  const [qrString, setQrString] = useState('');
  const [generatingQr, setGeneratingQr] = useState(false);

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const res = await getMyBeneficiaryVouchers(1); // Demo beneficiary Household AF-409
      if (res.success) {
        setBeneficiary(res.beneficiary);
        setVouchers(res.vouchers);
      }
    } catch (err) {
      console.error('Error fetching beneficiary vouchers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVouchers();
  }, []);

  const handleShowQr = async (voucherId: number) => {
    setGeneratingQr(true);
    try {
      const res = await getVoucherQr(voucherId);
      if (res.success) {
        setSelectedVoucherQr(res.qrPayload);
        setQrString(res.qrString);
      }
    } catch (err) {
      console.error('Error getting QR credential:', err);
    } finally {
      setGeneratingQr(false);
    }
  };

  const categoryColor: Record<string, { bg: string; text: string; border: string }> = {
    FOOD: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    MEDS: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    SHELTER: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    SUPPLIES: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/40 p-6 md:p-10 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
              <Ticket className="h-4 w-4" />
              <span>Digital Aid Vouchers</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Family Aid & Redemption Pass
            </h1>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              Assigned to: <strong className="text-white">{beneficiary?.alias_label || 'Household AF-409'}</strong> ({beneficiary?.family_size || 4} members, Zone {beneficiary?.location_zone || 'North'}). Present the QR credential below at any verified local partner grocery, medical clinic, or hardware merchant for instant checkout.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
            <div className="text-slate-400">Total Unspent Aid:</div>
            <div className="text-2xl font-black text-amber-400">
              $
              {formatAmount(
                vouchers.reduce((acc, v) => acc + (v.status === 'active' ? Number(v.remaining_amount) : 0), 0)
              )}{' '}
              <span className="text-xs text-slate-400 font-normal">USDC</span>
            </div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              <span>Zero-PII Privacy Protection</span>
            </div>
          </div>
        </div>
      </div>

      {/* Vouchers List */}
      <div>
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span>Active Programmable Vouchers ({vouchers.filter((v) => v.status === 'active').length})</span>
        </h2>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading your vouchers...</div>
        ) : vouchers.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No vouchers allocated yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vouchers.map((v) => {
              const catCfg = categoryColor[v.category] || categoryColor.FOOD;
              const isExpired = new Date(v.expiry_date) < new Date();
              return (
                <div
                  key={v.id}
                  className={`rounded-2xl border p-6 flex flex-col justify-between transition-all backdrop-blur-sm ${
                    v.status === 'active' && !isExpired
                      ? `${catCfg.border} bg-slate-900/80 shadow-lg`
                      : 'border-slate-800 bg-slate-950/40 opacity-60'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${catCfg.bg} ${catCfg.text} ${catCfg.border}`}>
                        {v.category} AID
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Voucher #{v.id}
                      </span>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400">Remaining Balance</div>
                      <div className="text-2xl font-black text-white mt-0.5">
                        ${formatAmount(v.remaining_amount)}{' '}
                        <span className="text-xs text-slate-400 font-normal">USDC</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Initial: ${formatAmount(v.initial_amount)} | Per-Tx Limit: ${formatAmount(v.max_per_tx)}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <span>Campaign:</span>
                        <span className="text-slate-200 font-medium truncate max-w-[160px]">{v.campaign_title}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Valid Until:</span>
                        <span className="text-slate-300 flex items-center gap-1 font-mono text-[11px]">
                          <Clock className="h-3 w-3 text-slate-500" />
                          {new Date(v.expiry_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Status:</span>
                        <span className="capitalize font-semibold text-slate-200">{v.status}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800">
                    <button
                      onClick={() => handleShowQr(v.id)}
                      disabled={v.status !== 'active' || isExpired}
                      className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-cyan-900/30 flex items-center justify-center gap-2"
                    >
                      <QrCode className="h-4 w-4" />
                      <span>Present QR Credential</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Credential Modal */}
      {selectedVoucherQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Ticket className="h-4 w-4 text-cyan-400" />
                <span>Aid Redemption Credential</span>
              </span>
              <button onClick={() => setSelectedVoucherQr(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Simulated QR Code Visual */}
            <div className="p-6 rounded-2xl bg-white text-slate-950 flex flex-col items-center justify-center space-y-3 shadow-inner">
              <div className="p-3 bg-slate-950 rounded-xl">
                {/* SVG QR Code Pattern */}
                <svg className="h-36 w-36 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 0h4v4h-4v-4zm-4 4h4v4h-4v-4zm0-4h2v2h-2v-2zm4 4v2h2v-2h-2zm-6-2h2v2h-2v-2zm0-4h2v2h-2v-2zm4 0h2v2h-2v-2zm2 2h2v2h-2v-2z" />
                </svg>
              </div>

              <div>
                <div className="text-sm font-black tracking-wide text-slate-950 uppercase">
                  {selectedVoucherQr.category} VOUCHER #{selectedVoucherQr.voucherId}
                </div>
                <div className="text-xs font-semibold text-emerald-600 mt-0.5">
                  Available: ${formatAmount(selectedVoucherQr.remainingAmount)} USDC
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Max: ${formatAmount(selectedVoucherQr.maxPerTx)} / checkout
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 text-left space-y-1">
              <div className="flex items-center gap-1 text-cyan-400 font-semibold">
                <Info className="h-3.5 w-3.5" />
                <span>Instructions for Survivor</span>
              </div>
              <p>
                Show this barcode to the cashier at any approved partner store. The terminal will automatically verify your category and settle directly on Stellar.
              </p>
              <div className="pt-1 text-[10px] font-mono text-slate-500 break-all">
                Secret: {selectedVoucherQr.secret}
              </div>
            </div>

            <button
              onClick={() => setSelectedVoucherQr(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
            >
              Close Credential
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

