import React, { useState, useEffect } from 'react';
import {
  Store,
  QrCode,
  CheckCircle,
  AlertCircle,
  DollarSign,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  ExternalLink,
  History,
} from 'lucide-react';
import {
  verifyVoucherForMerchant,
  redeemVoucherAtMerchant,
  getMerchants,
  Merchant,
  UserSession,
} from '../lib/api.js';
import { formatAmount, formatAddress } from '../lib/stellar.js';

interface MerchantTerminalViewProps {
  session: UserSession | null;
  onOpenWalletModal: () => void;
}

export const MerchantTerminalView: React.FC<MerchantTerminalViewProps> = ({ session, onOpenWalletModal }) => {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [currentMerchant, setCurrentMerchant] = useState<Merchant | null>(null);

  // Scan & Verify state
  const [inputVoucherId, setInputVoucherId] = useState<string>('1');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Redeem state
  const [redeemAmount, setRedeemAmount] = useState<number>(50);
  const [redeemSecret, setRedeemSecret] = useState<string>('AID-VOUCH-FOOD-9021-SEC');
  const [submittingRedeem, setSubmittingRedeem] = useState(false);
  const [settlementReceipt, setSettlementReceipt] = useState<any>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const loadMerchants = async () => {
    try {
      const res = await getMerchants();
      if (res.success && res.merchants.length > 0) {
        setMerchants(res.merchants);
        setCurrentMerchant(res.merchants[0]); // City Central Food Hub
      }
    } catch (err) {
      console.error('Error loading merchants:', err);
    }
  };

  useEffect(() => {
    loadMerchants();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.wallet) return onOpenWalletModal();
    if (!inputVoucherId) return;

    setVerifying(true);
    setVerificationResult(null);
    setVerificationError(null);
    setSettlementReceipt(null);
    setRedeemError(null);

    try {
      const res = await verifyVoucherForMerchant(inputVoucherId);
      if (res.valid) {
        setVerificationResult(res);
        setRedeemAmount(Math.min(50, Number(res.remainingAmount)));
      } else {
        setVerificationError(res.reason || 'Voucher cannot be redeemed at this merchant.');
      }
    } catch (err: any) {
      setVerificationError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationResult) return;

    setSubmittingRedeem(true);
    setRedeemError(null);

    try {
      const res = await redeemVoucherAtMerchant({
        voucher_id: verificationResult.voucherId,
        amount: redeemAmount,
        secret: redeemSecret || undefined,
      });

      if (res.success) {
        setSettlementReceipt(res);
        setVerificationResult(null);
        loadMerchants();
      }
    } catch (err: any) {
      setRedeemError(err.message || 'Redemption failed');
    } finally {
      setSubmittingRedeem(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-purple-950/40 p-6 md:p-10 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400 border border-purple-500/20">
              <Store className="h-4 w-4" />
              <span>Merchant Point-of-Sale (POS)</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Instant Aid Settlement Terminal
            </h1>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              Verify and redeem customer aid vouchers in real-time. Smart contract automatically validates category compliance and deposits USDC directly into your merchant wallet on the Stellar ledger.
            </p>
          </div>

          {currentMerchant && (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
              <div className="text-slate-400">Terminal Merchant Profile:</div>
              <div className="text-sm font-bold text-white">{currentMerchant.business_name}</div>
              <div className="text-[11px] text-purple-400 font-semibold">
                Category: [{currentMerchant.category}] | Total Revenue: ${formatAmount(currentMerchant.total_redeemed_amount)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Verification Terminal */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 backdrop-blur-sm space-y-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <QrCode className="h-5 w-5 text-purple-400" />
              <span>Step 1: Scan or Input Voucher Credential</span>
            </h2>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">
                  Voucher Barcode / ID Number
                </label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    required
                    placeholder="Enter voucher # (e.g. 1 or 2)"
                    value={inputVoucherId}
                    onChange={(e) => setInputVoucherId(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={verifying}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-900/30 flex items-center gap-2"
                  >
                    {verifying ? 'Verifying...' : 'Validate'}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                  <span>Quick demo shortcuts:</span>
                  <button
                    type="button"
                    onClick={() => setInputVoucherId('1')}
                    className="text-cyan-400 hover:underline"
                  >
                    #1 (Food - Valid)
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setInputVoucherId('3')}
                    className="text-rose-400 hover:underline"
                  >
                    #3 (Meds - Category Mismatch Test)
                  </button>
                </div>
              </div>
            </form>

            {/* Error rejection banner */}
            {verificationError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-400">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Voucher Rejected by Policy</span>
                </div>
                <p>{verificationError}</p>
              </div>
            )}

            {/* Validated Voucher Data */}
            {verificationResult && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    <span className="font-bold text-white text-sm">
                      Voucher #{verificationResult.voucherId} Verified
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Category Match: {verificationResult.category}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Customer Alias:</span>
                    <div className="font-semibold text-white mt-0.5">
                      {verificationResult.beneficiaryAlias}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">Available Balance:</span>
                    <div className="font-bold text-emerald-400 mt-0.5">
                      ${formatAmount(verificationResult.remainingAmount)} USDC
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">Per-Tx Limit:</span>
                    <div className="font-medium text-slate-200 mt-0.5">
                      ${formatAmount(verificationResult.maxPerTx)} USDC
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">Expires:</span>
                    <div className="font-medium text-slate-200 mt-0.5">
                      {new Date(verificationResult.expiryDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Step 2: Settle Payment */}
                <form onSubmit={handleRedeem} className="pt-4 border-t border-slate-800 space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Step 2: Enter Purchase Total & Settle
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-300">
                        Purchase Total (USDC)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={verificationResult.maxPerTx}
                        step="1"
                        value={redeemAmount}
                        onChange={(e) => setRedeemAmount(Number(e.target.value))}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500 font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300">
                        Secret (From Customer QR)
                      </label>
                      <input
                        type="text"
                        value={redeemSecret}
                        onChange={(e) => setRedeemSecret(e.target.value)}
                        placeholder="AID-VOUCH-FOOD-..."
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  {redeemError && (
                    <div className="text-xs text-rose-400 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      {redeemError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingRedeem || redeemAmount <= 0}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
                  >
                    {submittingRedeem ? (
                      <span>Settling via Soroban Smart Contract...</span>
                    ) : (
                      <>
                        <DollarSign className="h-4 w-4" />
                        <span>Confirm Instant Settlement of ${formatAmount(redeemAmount)} USDC</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Settlement Receipt */}
            {settlementReceipt && (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle className="h-5 w-5" />
                  <span>Payment Settled & Deposited Instantly!</span>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  The Soroban smart contract released ${formatAmount(settlementReceipt.redemption.amount)} USDC from the campaign escrow directly into your merchant wallet.
                </div>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1 font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Settlement Tx:</span>
                    <span className="text-cyan-400 truncate max-w-[200px]">
                      {settlementReceipt.txHash}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Remaining Voucher Balance:</span>
                    <span className="text-white">
                      ${formatAmount(settlementReceipt.voucher.remaining_amount)} USDC
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Approved Merchants Network */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Store className="h-4 w-4 text-purple-400" />
              <span>Approved Relief Merchant Network</span>
            </h2>
            <p className="text-xs text-slate-400">
              Only verified local retailers in critical disaster zones are pre-cleared to redeem programmable vouchers.
            </p>

            <div className="space-y-3">
              {merchants.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setCurrentMerchant(m)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    currentMerchant?.id === m.id
                      ? 'bg-slate-950 border-purple-500/50 shadow-md'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-xs text-white">{m.business_name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{m.location}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        Wallet: {formatAddress(m.wallet_address)}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {m.category}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Total Settled:</span>
                    <span className="font-bold text-emerald-400">
                      ${formatAmount(m.total_redeemed_amount)} USDC
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

