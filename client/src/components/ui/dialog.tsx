import React from 'react';

type DialogProps = {
  open?: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
};

export const Dialog = ({ open = false, onClose, children }: DialogProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-xl p-6" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};
