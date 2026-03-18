import React from 'react';

type EscrowCardProps = {
  title?: string;
  amount?: string;
  status?: string;
  children?: React.ReactNode;
};

export const EscrowCard = ({ title = 'Escrow', amount = '0', status = 'pending', children }: EscrowCardProps) => {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black">{title}</h3>
          <p className="text-sm text-muted">{amount}</p>
        </div>
        <span className="rounded-full bg-accent-orange/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-orange">{status}</span>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
};
