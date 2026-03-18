import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link as LinkIcon, X } from 'lucide-react';
import {
  createBounty,
  getBounties,
  getMyBountyDashboard,
  participateInBounty,
  type ApiBounty,
  type ApiBountyDashboard,
} from '../lib/api';

export const BountiesPage = () => {
  const [bounties, setBounties] = useState<ApiBounty[]>([]);
  const [dashboard, setDashboard] = useState<ApiBountyDashboard | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBounty, setNewBounty] = useState({ title: '', description: '', links: '', reward: '' });
  const [isParticipateModalOpen, setIsParticipateModalOpen] = useState(false);
  const [selectedBountyId, setSelectedBountyId] = useState<number | null>(null);
  const [participateForm, setParticipateForm] = useState({ description: '', links: '' });
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [submittingParticipation, setSubmittingParticipation] = useState(false);

  const loadBounties = useCallback(async () => {
    setLoading(true);
    try {
      const [bountyList, bountyDashboard] = await Promise.all([
        getBounties(),
        getMyBountyDashboard().catch(() => null),
      ]);
      setBounties(bountyList);
      setDashboard(bountyDashboard);
    } catch (error) {
      console.error('Failed to load bounties:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBounties();
  }, [loadBounties]);

  const handlePostBounty = async () => {
    if (!newBounty.title.trim() || !newBounty.description.trim() || !newBounty.reward.trim()) {
      return;
    }

    setPosting(true);
    try {
      await createBounty({
        title: newBounty.title.trim(),
        description: newBounty.description.trim(),
        links: newBounty.links.trim() || undefined,
        reward: newBounty.reward.trim(),
      });
      setIsModalOpen(false);
      setNewBounty({ title: '', description: '', links: '', reward: '' });
      await loadBounties();
    } catch (error) {
      console.error('Failed to create bounty:', error);
    } finally {
      setPosting(false);
    }
  };

  const handleParticipateSubmit = async () => {
    if (!selectedBountyId || !participateForm.description.trim()) {
      return;
    }

    setSubmittingParticipation(true);
    try {
      await participateInBounty(selectedBountyId, {
        description: participateForm.description.trim(),
        links: participateForm.links.trim() || undefined,
      });
      setIsParticipateModalOpen(false);
      setParticipateForm({ description: '', links: '' });
      setSelectedBountyId(null);
      await loadBounties();
    } catch (error) {
      console.error('Failed to submit bounty participation:', error);
    } finally {
      setSubmittingParticipation(false);
    }
  };

  return (
    <div className="pt-28 pb-20 px-6 md:pl-[92px]">
      <div className="container-custom">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-5xl font-black tracking-tighter mb-2">Bounty Board</h1>
            <p className="text-muted">Complete tasks and earn direct rewards.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">Post Bounty</button>
        </div>

        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card p-5">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Posted by you</p>
              <p className="text-3xl font-black">{dashboard.posted.length}</p>
            </div>
            <div className="card p-5">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Your participations</p>
              <p className="text-3xl font-black">{dashboard.participations.length}</p>
            </div>
            <div className="card p-5">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Approved participations</p>
              <p className="text-3xl font-black">{dashboard.participations.filter((entry) => entry.status === 'approved').length}</p>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-6">
          {loading ? (
            <div className="card p-6 text-sm text-muted">Loading bounties...</div>
          ) : (
            bounties.map((bounty) => (
              <div key={bounty.id} className="card p-6 flex flex-col md:flex-row justify-between items-start gap-6 hover:border-accent-orange transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-black">{bounty.title}</h3>
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-accent-orange/10 text-accent-orange">
                      {bounty.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted mb-4">{bounty.description}</p>
                  {bounty.links && (
                    <a href={bounty.links} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-cyan hover:underline flex items-center gap-1 mb-3">
                      <LinkIcon size={12} /> {bounty.links}
                    </a>
                  )}
                  <p className="text-[10px] text-muted font-bold uppercase tracking-widest">
                    {bounty.submissionCount} submissions
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black text-accent-orange mb-1">{bounty.reward}</p>
                  <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-4">Reward</p>
                  <button
                    onClick={() => {
                      setSelectedBountyId(bounty.id);
                      setIsParticipateModalOpen(true);
                    }}
                    disabled={bounty.hasParticipated || bounty.status !== 'open'}
                    className="btn-outline py-2 px-6 text-xs disabled:opacity-50"
                  >
                    {bounty.hasParticipated ? (bounty.mySubmissionStatus || 'Participated') : 'Participate'}
                  </button>
                </div>
              </div>
            ))
          )}
          {!loading && bounties.length === 0 && (
            <div className="card p-6 text-sm text-muted">No bounties available yet.</div>
          )}
        </div>

        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface border border-border rounded-[15px] p-6 md:p-8 max-w-xl w-full shadow-2xl relative"
              >
                <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-muted hover:text-ink">
                  <X size={20} />
                </button>
                <h3 className="text-2xl font-black mb-6">Post a Bounty</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">Title</label>
                    <input
                      type="text"
                      value={newBounty.title}
                      onChange={(e) => setNewBounty({ ...newBounty, title: e.target.value })}
                      className="w-full bg-ink/5 border border-border rounded-[15px] px-4 py-3 text-sm focus:ring-1 focus:ring-accent-orange outline-none"
                      placeholder="e.g. Write a tutorial on Clarity"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">Description</label>
                    <textarea
                      value={newBounty.description}
                      onChange={(e) => setNewBounty({ ...newBounty, description: e.target.value })}
                      className="w-full bg-ink/5 border border-border rounded-[15px] px-4 py-3 text-sm focus:ring-1 focus:ring-accent-orange outline-none h-24 resize-none"
                      placeholder="Describe the bounty requirements..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">Links (Optional)</label>
                    <input
                      type="text"
                      value={newBounty.links}
                      onChange={(e) => setNewBounty({ ...newBounty, links: e.target.value })}
                      className="w-full bg-ink/5 border border-border rounded-[15px] px-4 py-3 text-sm focus:ring-1 focus:ring-accent-orange outline-none"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">Reward Amount</label>
                    <input
                      type="text"
                      value={newBounty.reward}
                      onChange={(e) => setNewBounty({ ...newBounty, reward: e.target.value })}
                      className="w-full bg-ink/5 border border-border rounded-[15px] px-4 py-3 text-sm focus:ring-1 focus:ring-accent-orange outline-none"
                      placeholder="e.g. 500 STX"
                    />
                  </div>
                  <button onClick={handlePostBounty} disabled={posting} className="btn-primary w-full py-4 mt-4 disabled:opacity-50">
                    {posting ? 'Posting...' : 'Post Bounty'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {isParticipateModalOpen && (
            <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface border border-border rounded-[15px] p-6 md:p-8 max-w-xl w-full shadow-2xl relative"
              >
                <button onClick={() => setIsParticipateModalOpen(false)} className="absolute top-4 right-4 text-muted hover:text-ink">
                  <X size={20} />
                </button>
                <h3 className="text-2xl font-black mb-6">Participate in Bounty</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">Description</label>
                    <textarea
                      value={participateForm.description}
                      onChange={(e) => setParticipateForm({ ...participateForm, description: e.target.value })}
                      className="w-full bg-ink/5 border border-border rounded-[15px] px-4 py-3 text-sm focus:ring-1 focus:ring-accent-orange outline-none h-32 resize-none"
                      placeholder="Describe how you plan to complete this bounty or what you have done..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">Links (Proof of work / Portfolio)</label>
                    <input
                      type="text"
                      value={participateForm.links}
                      onChange={(e) => setParticipateForm({ ...participateForm, links: e.target.value })}
                      className="w-full bg-ink/5 border border-border rounded-[15px] px-4 py-3 text-sm focus:ring-1 focus:ring-accent-orange outline-none"
                      placeholder="https://..."
                    />
                  </div>
                  <button onClick={handleParticipateSubmit} disabled={submittingParticipation} className="btn-primary w-full py-4 mt-4 disabled:opacity-50">
                    {submittingParticipation ? 'Submitting...' : 'Submit Participation'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
