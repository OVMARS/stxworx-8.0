import React from 'react';
import { NFTBadgeCollection } from '../../components/profile/NFTBadgeCollection';

export const BadgeGallery = () => {
  return (
    <div className="pt-28 pb-20 px-6 md:pl-[92px]">
      <div className="container-custom">
        <h1 className="text-5xl font-black tracking-tighter mb-6">Badge Gallery</h1>
        <div className="card p-6">
          <NFTBadgeCollection />
        </div>
      </div>
    </div>
  );
};
