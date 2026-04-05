import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Ban, CheckCircle2, Clock3, Copy, DollarSign, Sparkles, Users } from 'lucide-react';
import {
  createOrShareReferralCode,
  formatAddress,
  formatRelativeTime,
  formatTokenAmount,
  getMyReferralProgram,
  getReferralShareUrl,
  getUserProfilePath,
  toDisplayName,
  toHandle,
  type ApiReferralCode,
  type ApiReferralProgramOverview,
} from '../lib/api';

function statusClasses(status: 'pending' | 'qualified' | 'blocked') {
  switch (status) {
    case 'qualified':
      return 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20';
    case 'blocked':
      return 'bg-accent-red/10 text-accent-red border-accent-red/20';
    default:
      return 'bg-accent-orange/10 text-accent-orange border-accent-orange/20';
  }
}

export const PartnerPage = () => {
  const [overview, setOverview] = useState<ApiReferralProgramOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadProgram = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMyReferralProgram();
      setOverview(result);
    } catch (error) {
      console.error('Failed to load referral program:', error);
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgram();
  }, [loadProgram]);

  const referralLink = useMemo(() => {
    if (!overview?.code?.code) {
      return '';
    }

    return getReferralShareUrl(overview.code.code);
  }, [overview?.code?.code]);

  const ensureCode = useCallback(async () => {
    if (overview?.code) {
      return overview.code;
    }

    setActionLoading(true);
    try {
      const code = await createOrShareReferralCode();
      setOverview((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          code,
        };
      });
      return code;
    } finally {
      setActionLoading(false);
    }
  }, [overview?.code]);

  const handleGenerateLink = useCallback(async () => {
    try {
      const code = await ensureCode();
      if (!code) {
        return;
      }
      setFeedback(`Referral code ${code.code} is ready to share.`);
    } catch (error) {
      console.error('Failed to generate referral link:', error);
      setFeedback('Unable to generate your referral link right now.');
    }
  }, [ensureCode]);

  const handleCopyLink = useCallback(async () => {
    try {
      const code = await ensureCode();
      if (!code) {
        return;
      }

      const shareUrl = getReferralShareUrl(code.code);
      await navigator.clipboard.writeText(shareUrl);
      setFeedback('Referral link copied to clipboard.');
    } catch (error) {
      console.error('Failed to copy referral link:', error);
      setFeedback('Unable to copy your referral link right now.');
    }
  }, [ensureCode]);

  const summary = overview?.summary;
  const policy = overview?.policy;

  return (
    <div className="pt-28 pb-20 px-6 md:pl-[92px]">
      <div className="container-custom space-y-12">
        <section className="overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,107,53,0.18),transparent_38%)] pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row p-8 lg:items-end lg:justify-between gap-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent-orange/30 bg-accent-orange/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-accent-orange mb-4">
                <Sparkles size={12} />
                Partner Program
              </div>
              <h1 className="text-4xl md:text-7xl font-black tracking-tighter leading-none mb-4">Invite clients. Earn when they complete work.</h1>
              <p className="text-sm md:text-base text-muted max-w-2xl leading-relaxed">
                Share your STXWORX referral link with new clients. You earn {policy?.payoutRate ?? 10}% once a referred client clears the first qualifying completed job or reaches the cumulative spend threshold.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGenerateLink}
                disabled={actionLoading}
                className="btn-primary justify-center min-w-[180px] disabled:opacity-60"
              >
                {overview?.code ? 'Refresh Link' : 'Generate Link'}
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={actionLoading}
                className="btn-outline justify-center min-w-[180px] disabled:opacity-60"
              >
                <Copy size={16} />
                Copy Link
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-12 gap-y-8 border-b border-border pb-12">
          {[
            { label: 'Total Referrals', value: summary?.totalReferrals ?? 0, icon: Users },
            { label: 'Qualified', value: summary?.qualifiedReferrals ?? 0, icon: CheckCircle2 },
            { label: 'Pending', value: summary?.pendingReferrals ?? 0, icon: Clock3 },
            { label: 'Payouts Pending', value: `$${formatTokenAmount(summary?.pendingPayoutUsd ?? '0')}`, icon: DollarSign },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex flex-col gap-2 border-l-2 border-border pl-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">{item.label}</p>
                </div>
                <p className="text-3xl font-black tracking-tighter">{item.value}</p>
              </div>
            );
          })}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.9fr] gap-12 items-start">
          <div className="space-y-6">
            <div className="border-b border-border pb-12">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted mb-2">Your referral link</p>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tighter">Share once. Track everything.</h2>
                </div>
                <Link to="/referrals/leaderboard" className="btn-outline justify-center">
                  View Referral Leaderboard
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted mb-2">Referral code</p>
                  <p className="text-2xl font-black tracking-[0.18em] text-accent-orange">{overview?.code?.code || 'NOT GENERATED'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted mb-2">Referral URL</p>
                  <p className="text-sm font-medium break-all">{referralLink || 'Generate your code to unlock a shareable referral URL.'}</p>
                </div>
              </div>

              {feedback ? (
                <div className="mt-4 rounded-[16px] border border-accent-orange/20 bg-accent-orange/10 px-4 py-3 text-sm text-accent-orange">
                  {feedback}
                </div>
              ) : null}
            </div>

            <div className="border-b border-border pb-12">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted mb-2">Referral activity</p>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tighter">Client progress</h2>
                </div>
                <p className="text-sm text-muted">{overview?.referrals.length ?? 0} tracked referrals</p>
              </div>

              <div className="space-y-6">
                {loading ? (
                  <div className="text-sm text-muted">Loading referral activity…</div>
                ) : overview?.referrals.length ? (
                  overview.referrals.map((referral) => {
                    const userPath = getUserProfilePath(referral.referredUser);
                    return (
                      <div key={referral.id} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 py-4 border-t border-border/50">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <Link to={userPath} className="font-black tracking-tight hover:text-accent-orange transition-colors">
                              {toDisplayName(referral.referredUser)}
                            </Link>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${statusClasses(referral.status)}`}>
                              {referral.status}
                            </span>
                          </div>
                          <div className="text-xs text-muted space-y-1">
                            <p>{toHandle(referral.referredUser)} • {formatAddress(referral.referredUser?.stxAddress)}</p>
                            <p>
                              Completed jobs: <span className="text-ink">{referral.totalCompletedJobs}</span> • Qualified spend: <span className="text-ink">${formatTokenAmount(referral.cumulativeCompletedSpendUsd)}</span>
                            </p>
                            <p>
                              Seen {formatRelativeTime(referral.createdAt)}
                              {referral.qualificationRule ? ` • Rule: ${referral.qualificationRule.replace(/_/g, ' ')}` : ''}
                            </p>
                            {referral.blockedReason ? <p className="text-accent-red">{referral.blockedReason}</p> : null}
                          </div>
                        </div>
                        <div className="text-sm lg:text-right space-y-1">
                          <p className="text-muted">First project: <span className="text-ink">{referral.firstProjectId ?? '—'}</span></p>
                          <p className="text-muted">Escrow funded: <span className="text-ink">{referral.firstEscrowProjectId ?? '—'}</span></p>
                          <p className="text-muted">Qualified project: <span className="text-ink">{referral.qualifiedProjectId ?? '—'}</span></p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-muted">
                    No client referrals have been attributed yet. Share your link with new clients to start climbing the leaderboard.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border-b border-border pb-12">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted mb-2">Payouts</p>
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-6">Commission visibility</h2>
              <div className="space-y-6">
                {loading ? (
                  <div className="text-sm text-muted">Loading payouts…</div>
                ) : overview?.payouts.length ? (
                  overview.payouts.map((payout) => (
                    <div key={payout.id} className="py-4 border-t border-border/50">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="font-black tracking-tight">${formatTokenAmount(payout.amountUsd)}</p>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{payout.status}</span>
                      </div>
                      <p className="text-xs text-muted">Eligible spend: ${formatTokenAmount(payout.eligibleSpendUsd)} • Rate: {formatTokenAmount(payout.payoutRate)}%</p>
                      <p className="text-xs text-muted mt-1">Created {formatRelativeTime(payout.createdAt)} • Project #{payout.projectId ?? '—'}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted">
                    Payouts appear here after a referred client clears eligibility.
                  </div>
                )}
              </div>
            </div>

            <div className="border-b border-border pb-12">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted mb-2">Policy</p>
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-6">Eligibility rules</h2>
              <div className="space-y-8 text-sm text-muted leading-relaxed">
                <div>
                  <p className="font-bold text-ink mb-1">Qualifying clients only</p>
                  <p>Referrals apply to new client accounts. Freelancer signups do not generate commissions.</p>
                </div>
                <div>
                  <p className="font-bold text-ink mb-1">Spend threshold</p>
                  <p>The referral qualifies when the first completed job reaches at least ${formatTokenAmount(policy?.firstJobMinimumUsd ?? 5)} or cumulative completed spend reaches ${formatTokenAmount(policy?.totalSpendMinimumUsd ?? 10)}.</p>
                </div>
                <div>
                  <p className="font-bold text-ink mb-1">Anti-abuse checks</p>
                  <p>Self-referrals, duplicate wallet farming, and cases where the referrer becomes the paid freelancer on the qualifying project are blocked.</p>
                </div>
                <div>
                  <p className="font-bold text-ink mb-1">Payout timing</p>
                  <p>Qualified commissions become visible as pending immediately and can be reviewed before approval and payout.</p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-accent-red/10 text-accent-red border border-accent-red/20 flex items-center justify-center shrink-0">
                  <Ban size={18} />
                </div>
                <div>
                  <p className="font-black tracking-tight mb-1">Blocked referrals are retained for auditability</p>
                  <p className="text-sm text-muted">The dashboard keeps blocked records visible so referral ownership, attribution, and payout decisions stay explainable.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
