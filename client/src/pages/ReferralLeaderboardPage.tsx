import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, DollarSign, Sparkles, Users } from 'lucide-react';
import { getReferralLeaderboard, getUserProfilePath, toDisplayName, toHandle, type ApiReferralLeaderboardEntry } from '../lib/api';

const rankColors = ['bg-accent-orange', 'bg-accent-red', 'bg-accent-blue', 'bg-accent-cyan', 'bg-accent-lightblue', 'bg-accent-yellow'];

export const ReferralLeaderboardPage = () => {
  const [leaders, setLeaders] = useState<ApiReferralLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true);
      try {
        const entries = await getReferralLeaderboard();
        setLeaders(entries);
      } catch (error) {
        console.error('Failed to load referral leaderboard:', error);
        setLeaders([]);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, []);

  return (
    <div className="pt-28 pb-20 px-6 md:pl-[92px]">
      <div className="container-custom space-y-12">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(26,188,156,0.18),transparent_36%)] pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row p-8 lg:items-end lg:justify-between gap-6 border-b border-border pb-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-accent-cyan mb-4">
                <Sparkles size={12} />
                Referral Leaderboard
              </div>
              <h1 className="text-4xl md:text-7xl font-black tracking-tighter leading-none mb-4">Top partners this week.</h1>
              <p className="text-sm md:text-base text-muted max-w-2xl leading-relaxed">
                Ranked by qualified referrals first, pending pipeline second, and visible payout value third.
              </p>
            </div>
            <Link to="/referrals" className="btn-outline justify-center">
              Open Partner Program
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-0">
          {loading ? (
            <div className="text-sm text-muted py-4">Loading referral leaderboard…</div>
          ) : leaders.length ? (
            leaders.map((leader, index) => {
              const profilePath = getUserProfilePath(leader);
              return (
                <div key={leader.id} className="py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 group hover:bg-ink/5 transition-colors border-b border-border/50 px-4 -mx-4 rounded-[16px]">
                  <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                    <div className="text-3xl font-black text-muted/20 w-12 text-center group-hover:text-accent-cyan transition-colors">
                      {leader.rank}
                    </div>
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full border border-border bg-ink/5 flex items-center justify-center text-base font-black uppercase">
                        {toDisplayName(leader).slice(0, 2)}
                      </div>
                      <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-bg ${rankColors[index % rankColors.length]}`}>
                        {leader.rank === 1 ? '👑' : leader.rank}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <Link to={profilePath} className="block hover:text-accent-cyan transition-colors">
                        <h3 className="text-xl md:text-2xl font-black tracking-tighter leading-none mb-1">{toDisplayName(leader)}</h3>
                      </Link>
                      <Link to={profilePath} className="block text-xs font-bold text-accent-cyan hover:opacity-80 transition-opacity">{toHandle(leader)}</Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-8 w-full lg:w-auto lg:min-w-[460px]">
                    <div className="text-left sm:text-right">
                      <div className="flex items-center justify-start sm:justify-end gap-2 mb-1 text-muted">
                        <Users size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Qualified</span>
                      </div>
                      <p className="text-xl font-black leading-none">{leader.qualifiedReferrals}</p>
                    </div>
                    <div className="text-left sm:text-right border-l border-border/50 pl-4 sm:pl-0 sm:border-l-0">
                      <div className="flex items-center justify-start sm:justify-end gap-2 mb-1 text-muted">
                        <Sparkles size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Pending</span>
                      </div>
                      <p className="text-xl font-black leading-none">{leader.pendingReferrals}</p>
                    </div>
                    <div className="text-left sm:text-right border-l border-border/50 pl-4 sm:pl-0 sm:border-l-0">
                      <div className="flex items-center justify-start sm:justify-end gap-2 mb-1 text-muted">
                        <DollarSign size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Visible USD</span>
                      </div>
                      <p className="text-xl font-black leading-none">${leader.totalPayoutUsd.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-muted py-4">
              Referral leaderboard data is not available yet.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
