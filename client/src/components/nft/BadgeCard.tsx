import React from 'react';

type BadgeCardProps = {
  title?: string;
  description?: string;
};

export const BadgeCard = ({ title = 'Reputation Badge', description = 'Collect badges for verified work and completed milestones.' }: BadgeCardProps) => {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-black mb-2">{title}</h3>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
};
