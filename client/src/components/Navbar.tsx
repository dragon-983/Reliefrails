import React, { useState, useEffect } from 'react';
import {
  Shield,
  Activity,
  Wallet,
  Bell,
  Heart,
  Store,
  FileCheck,
  ChevronDown,
  CheckCircle,
} from 'lucide-react';
import { UserSession, getNotifications, markNotificationRead } from '../lib/api.js';
import { formatAddress } from '../lib/stellar.js';

interface NavbarProps {
  currentTab: 'donor' | 'organisation' | 'beneficiary' | 'merchant' | 'transparency';
  setCurrentTab: (tab: 'donor' | 'organisation' | 'beneficiary' | 'merchant' | 'transparency') => void;
  session: UserSession | null;
  onOpenWalletModal: () => void;
  onSelectRole: (role: UserSession['role']) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  session,
  onOpenWalletModal,
  onSelectRole,
}) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  useEffect(() => {
    if (session?.wallet) {
      loadNotifications();
    }
  }, [session?.wallet]);

  const loadNotifications = async () => {
    try {
      const res = await getNotifications();
      if (res.success) {
        setNotifications(res.notifications);
      }
    } catch {
      // ignore
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      // ignore
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const roleLabels: Record<string, { title: string; color: string; desc: string }> = {
    donor: { title: 'Global Donor', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', desc: 'Donate USDC & track aid' },
    organisation: { title: 'NGO Administrator', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', desc: 'Create campaigns & issue vouchers' },
    beneficiary: { title: 'Aid Beneficiary', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', desc: 'View vouchers & generate QR' },
    merchant: { title: 'Verified Merchant', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30', desc: 'Scan QR & instant settlement' },
    auditor: { title: 'Independent Auditor', color: 'bg-sky-500/10 text-sky-400 border-sky-500/30', desc: 'Inspect reconciliation & audit trail' },
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => setCurrentTab('donor')}
            className="flex cursor-pointer items-center gap-3 group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  RELIEFRAIL
                </span>
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-500/20">
                  SOROBAN
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Zero-Leakage Humanitarian Aid on Stellar
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-800">
            <button
              onClick={() => setCurrentTab('donor')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'donor'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Heart className="h-3.5 w-3.5 text-emerald-400" />
              <span>Donate</span>
            </button>

            <button
              onClick={() => setCurrentTab('organisation')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'organisation'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Shield className="h-3.5 w-3.5 text-cyan-400" />
              <span>NGO Command</span>
            </button>

            <button
              onClick={() => setCurrentTab('beneficiary')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'beneficiary'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              <span>Beneficiary</span>
            </button>

            <button
              onClick={() => setCurrentTab('merchant')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'merchant'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Store className="h-3.5 w-3.5 text-purple-400" />
              <span>Merchant POS</span>
            </button>

            <button
              onClick={() => setCurrentTab('transparency')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'transparency'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileCheck className="h-3.5 w-3.5 text-sky-400" />
              <span>Zero-Leakage Audit</span>
            </button>
          </nav>
        </div>

        {/* Right Section: Testnet indicator, Role switcher, Wallet */}
        <div className="flex items-center gap-3">
          {/* Testnet Badge */}
          <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs text-slate-300 border border-slate-800">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Stellar Testnet</span>
          </div>

          {/* Quick Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                session?.role ? roleLabels[session.role]?.color : 'bg-slate-900 text-slate-300 border-slate-800'
              }`}
            >
              <span>{session?.role ? roleLabels[session.role]?.title : 'Select Role'}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-800 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-md z-50">
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Switch Sandbox Role
                </div>
                {(Object.keys(roleLabels) as Array<UserSession['role']>).map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      onSelectRole(role);
                      setShowRoleMenu(false);
                      if (role === 'donor') setCurrentTab('donor');
                      else if (role === 'organisation') setCurrentTab('organisation');
                      else if (role === 'beneficiary') setCurrentTab('beneficiary');
                      else if (role === 'merchant') setCurrentTab('merchant');
                      else if (role === 'auditor') setCurrentTab('transparency');
                    }}
                    className={`w-full flex flex-col items-start p-2 rounded-lg text-left text-xs transition-colors hover:bg-slate-800/80 ${
                      session?.role === role ? 'bg-slate-800 text-white' : 'text-slate-300'
                    }`}
                  >
                    <div className="font-medium flex items-center justify-between w-full">
                      <span>{roleLabels[role].title}</span>
                      {session?.role === role && <CheckCircle className="h-3.5 w-3.5 text-cyan-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400">{roleLabels[role].desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-bold text-slate-950">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-800 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md z-50">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-semibold text-white">Notifications</span>
                  <span className="text-[10px] text-slate-400">{unreadCount} unread</span>
                </div>
                <div className="mt-2 max-h-60 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-500">No notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkRead(n.id)}
                        className={`p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          n.read ? 'bg-slate-950/40 text-slate-400' : 'bg-slate-800/60 text-slate-200 border-l-2 border-cyan-400'
                        }`}
                      >
                        <div className="font-semibold text-[11px]">{n.title}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{n.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Wallet Button */}
          <button
            onClick={onOpenWalletModal}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white border border-slate-800 transition-all shadow-sm"
          >
            <Wallet className="h-3.5 w-3.5 text-cyan-400" />
            <span>{session?.wallet ? formatAddress(session.wallet) : 'Connect'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
