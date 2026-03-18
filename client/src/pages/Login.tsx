import React from 'react';
import * as Shared from '../shared';

export const Login = () => {
  const { connect, walletAddress, isSignedIn, userRole, disconnect } = Shared.useWallet();

  return (
    <div className="pt-28 pb-20 px-6 md:pl-[92px]">
      <div className="container-custom max-w-2xl">
        <div className="card p-8">
          <h1 className="text-4xl font-black tracking-tighter mb-4">Login</h1>
          <p className="text-muted mb-8">Connect your wallet to continue into STXWORX.</p>
          {isSignedIn && walletAddress ? (
            <div className="space-y-4">
              <div className="rounded-[15px] border border-border bg-ink/5 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Connected wallet</p>
                <p className="font-mono text-sm break-all">{walletAddress}</p>
                <p className="text-xs text-muted mt-2">Role: {userRole || 'not selected'}</p>
              </div>
              <button onClick={disconnect} className="btn-outline py-3 px-6">Disconnect</button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row">
              <button onClick={() => connect('client')} className="btn-primary py-3 px-6">Connect as Client</button>
              <button onClick={() => connect('freelancer')} className="btn-outline py-3 px-6">Connect as Freelancer</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
