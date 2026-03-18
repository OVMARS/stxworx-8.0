import React from 'react';
import * as Shared from '../../shared';

export const WalletInfo = () => {
  const { walletAddress, userRole, isSignedIn } = Shared.useWallet();

  if (!isSignedIn || !walletAddress) {
    return <div className="text-xs text-muted">Wallet not connected</div>;
  }

  return (
    <div className="rounded-[15px] border border-border bg-ink/5 px-4 py-3 text-xs">
      <div className="font-mono break-all">{walletAddress}</div>
      <div className="mt-1 text-muted">{userRole || 'no role selected'}</div>
    </div>
  );
};
