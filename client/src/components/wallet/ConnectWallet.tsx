import React from 'react';
import * as Shared from '../../shared';

export const ConnectWallet = () => {
  const { walletAddress, connect, disconnect, isSignedIn } = Shared.useWallet();

  if (isSignedIn && walletAddress) {
    return <button onClick={disconnect} className="btn-outline py-2 px-4 text-xs">Disconnect Wallet</button>;
  }

  return <button onClick={() => connect()} className="btn-primary py-2 px-4 text-xs">Connect Wallet</button>;
};
