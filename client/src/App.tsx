import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { TransparencyView } from './components/TransparencyView.js';
import { DonorView } from './components/DonorView.js';
import { OrganisationView } from './components/OrganisationView.js';
import { BeneficiaryView } from './components/BeneficiaryView.js';
import { MerchantTerminalView } from './components/MerchantTerminalView.js';
import { WalletModal } from './components/WalletModal.js';
import { UserSession, getSession, setSession, getHealth } from './lib/api.js';
import { Shield, ExternalLink, Heart } from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<
    'donor' | 'organisation' | 'beneficiary' | 'merchant' | 'transparency'
  >('donor');
  const [session, setCurrentUserSession] = useState<UserSession | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [healthInfo, setHealthInfo] = useState<any>(null);

  useEffect(() => {
    const existing = getSession();
    setCurrentUserSession(existing);

    getHealth()
      .then((res) => setHealthInfo(res))
      .catch(() => {});
  }, []);

  const handleSelectSession = (newSession: UserSession) => {
    setCurrentUserSession(newSession);
    setSession(newSession);
  };

  const handleDisconnect = () => {
    setCurrentUserSession(null);
    setSession(null);
  };

  const handleSelectRole = (role: UserSession['role']) => {
    const newSession: UserSession = {
      wallet: `GA${role.toUpperCase()}11111111111111111111111111111111111111111111111`,
      role,
      name: `${role.toUpperCase()} Sandbox`,
    };
    handleSelectSession(newSession);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-950">
      <div>
        <Navbar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          session={session}
          onOpenWalletModal={() => setWalletModalOpen(true)}
          onSelectRole={handleSelectRole}
        />

        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
          {currentTab === 'donor' && (
            <DonorView session={session} onOpenWalletModal={() => setWalletModalOpen(true)} />
          )}

          {currentTab === 'organisation' && (
            <OrganisationView
              session={session}
              onOpenWalletModal={() => setWalletModalOpen(true)}
            />
          )}

          {currentTab === 'beneficiary' && (
            <BeneficiaryView
              session={session}
              onOpenWalletModal={() => setWalletModalOpen(true)}
            />
          )}

          {currentTab === 'merchant' && (
            <MerchantTerminalView
              session={session}
              onOpenWalletModal={() => setWalletModalOpen(true)}
            />
          )}

          {currentTab === 'transparency' && <TransparencyView />}
        </main>
      </div>

      {/* Global Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 mt-12">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-cyan-400" />
            <span className="font-semibold text-slate-300">RELIEFRAIL</span>
            <span>— Programmable Humanitarian Aid Infrastructure on Stellar</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px] text-slate-400">
              Contract: {healthInfo?.stellar?.contractId ? healthInfo.stellar.contractId.slice(0, 10) + '...' : 'Soroban Testnet'}
            </span>
            <a
              href="https://stellar.org"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>Stellar.org</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>

      {/* Wallet / Sandbox Modal */}
      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        session={session}
        onSelectSession={handleSelectSession}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
}
export default App;
