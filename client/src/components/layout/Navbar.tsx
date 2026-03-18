import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Bell,
  Briefcase,
  CheckCircle2,
  MessageCircle,
  Moon,
  PenTool,
  Search,
  ShoppingBag,
  Sun,
  Wallet,
  X,
} from 'lucide-react';
import * as Shared from '../../shared';
import {
  formatRelativeTime,
  getNotifications,
  getUnreadNotificationCount,
  getUserProfile,
  markNotificationRead,
  type ApiNotification,
} from '../../lib/api';
import type { ApiUserProfile } from '../../types/user';

function getNotificationMeta(type: ApiNotification['type']) {
  switch (type) {
    case 'proposal_received':
      return { icon: Briefcase, color: 'bg-accent-orange' };
    case 'proposal_accepted':
      return { icon: CheckCircle2, color: 'bg-accent-blue' };
    case 'milestone_submitted':
      return { icon: Bell, color: 'bg-accent-red' };
    case 'milestone_approved':
      return { icon: ShoppingBag, color: 'bg-accent-cyan' };
    case 'milestone_rejected':
    case 'dispute_filed':
    case 'dispute_resolved':
      return { icon: AlertTriangle, color: 'bg-accent-red' };
    case 'project_completed':
      return { icon: CheckCircle2, color: 'bg-accent-cyan' };
    default:
      return { icon: Bell, color: 'bg-ink/20' };
  }
}

export const TopHeader = ({ theme, toggleTheme }: { theme: 'dark' | 'light', toggleTheme: () => void }) => {
  const { walletAddress, userRole, setUserRole, blockedWallets, connect, disconnect, isSignedIn } = Shared.useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profile, setProfile] = useState<ApiUserProfile | null>(null);

  const isBlocked = walletAddress && blockedWallets.includes(walletAddress);

  const displayWalletAddress = useMemo(() => {
    if (!walletAddress) return 'Connect Wallet';
    if (walletAddress.length <= 10) return walletAddress;
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  const displayName = useMemo(() => {
    if (profile?.username) {
      return profile.username;
    }

    if (walletAddress) {
      return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    }

    return 'Guest';
  }, [profile?.username, walletAddress]);

  const handleConnect = (role: 'client' | 'freelancer') => {
    setUserRole(role);
    connect(role);
    setShowWalletModal(false);
    setSelectedProvider(null);
  };

  const handleDisconnect = () => {
    disconnect();
    setSelectedProvider(null);
    setShowWalletModal(false);
  };

  const loadNotificationSummary = useCallback(async () => {
    if (!isSignedIn || !walletAddress) {
      setNotifications([]);
      setUnreadCount(0);
      setProfile(null);
      return;
    }

    try {
      const [countResponse, userProfile] = await Promise.all([
        getUnreadNotificationCount(),
        getUserProfile(walletAddress).catch(() => null),
      ]);

      setUnreadCount(countResponse.count);
      setProfile(userProfile);
    } catch (error) {
      console.error('Failed to load notification summary:', error);
    }
  }, [isSignedIn, walletAddress]);

  const loadNotifications = useCallback(async () => {
    if (!isSignedIn) {
      setNotifications([]);
      return;
    }

    try {
      const rows = await getNotifications();
      setNotifications(rows);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, [isSignedIn]);

  useEffect(() => {
    loadNotificationSummary();
  }, [loadNotificationSummary]);

  useEffect(() => {
    if (showNotifications) {
      loadNotifications();
    }
  }, [loadNotifications, showNotifications]);

  const handleNotificationClick = async (notification: ApiNotification) => {
    if (!notification.isRead) {
      try {
        await markNotificationRead(notification.id);
        setNotifications((current) =>
          current.map((entry) => (entry.id === notification.id ? { ...entry, isRead: true } : entry)),
        );
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
  };

  const messages = [
    { id: 1, sender: 'Alice', text: 'Hey, are you available for a new project?', time: '10m ago', unread: true },
    { id: 2, sender: 'Bob', text: 'The designs look great, thanks!', time: '2h ago', unread: false },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 md:left-[120px] right-0 h-20 bg-bg/80 backdrop-blur-xl border-b border-border z-40 px-4 md:px-10 flex items-center justify-between">
      <div className="flex items-center gap-4 md:gap-8">
        <Link to="/" className="flex items-center md:hidden">
          <div className="w-8 h-8 bg-accent-orange rounded-[10px] flex items-center justify-center text-white font-black">S</div>
        </Link>
        <Link to="/" className="hidden md:flex items-center">
          <Shared.Logo className="text-3xl" />
        </Link>
        <div className="flex items-center gap-4 bg-surface px-4 py-2 rounded-[15px] border border-border w-40 md:w-64 xl:w-96">
          <Search size={18} className="text-muted" />
          <input
            type="text"
            placeholder="Search for anything..."
            className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-muted"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-[15px] hover:bg-ink/5 text-muted hover:text-ink transition-all"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button
          onClick={() => (isSignedIn ? handleDisconnect() : setShowWalletModal(true))}
          className={`flex items-center gap-2 px-4 py-2 rounded-[15px] text-xs font-bold transition-all ${isSignedIn ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20' : 'bg-ink text-bg hover:bg-accent-orange'} ${isBlocked ? 'opacity-70 cursor-not-allowed' : ''}`}
          disabled={isBlocked}
        >
          {isSignedIn ? (
            <Wallet size={16} />
          ) : (
            <div className="w-2 h-2 rounded-full bg-[#FF5E00] shadow-[0_0_8px_#FF5E00]" />
          )}
          {isSignedIn ? displayWalletAddress : 'Connect Wallet'}
        </button>

        <div className="relative">
          <button
            onClick={() => { setShowMessages(!showMessages); setShowNotifications(false); }}
            className={`relative text-muted hover:text-ink transition-colors p-2 rounded-[15px] hover:bg-ink/5 ${showMessages ? 'text-ink bg-ink/5' : ''}`}
          >
            <MessageCircle size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent-cyan rounded-full"></span>
          </button>

          <AnimatePresence>
            {showMessages && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full right-0 mt-4 w-80 bg-surface border border-border rounded-[15px] shadow-2xl overflow-hidden z-50"
              >
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-bold text-sm">Recent Messages</h3>
                  <button onClick={() => setShowMessages(false)} className="text-muted hover:text-ink"><X size={16} /></button>
                </div>
                <div className="max-h-96 overflow-y-auto no-scrollbar">
                  {messages.map((message) => (
                    <div key={message.id} className={`p-4 flex items-start gap-4 hover:bg-ink/5 cursor-pointer transition-colors border-b border-border/50 last:border-0 ${message.unread ? 'bg-ink/5' : ''}`}>
                      <div className="w-8 h-8 rounded-[10px] bg-ink/10 overflow-hidden shrink-0 flex items-center justify-center font-black">
                        {message.sender.slice(0, 1)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <p className={`text-xs ${message.unread ? 'font-black' : 'font-bold'}`}>{message.sender}</p>
                          <p className="text-[10px] text-muted">{message.time}</p>
                        </div>
                        <p className={`text-[10px] truncate max-w-[200px] ${message.unread ? 'text-ink font-bold' : 'text-muted'}`}>{message.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  to="/messages"
                  onClick={() => setShowMessages(false)}
                  className="block w-full text-center p-3 text-[10px] font-bold text-muted hover:text-ink transition-colors bg-ink/5"
                >
                  View All Messages
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowMessages(false); }}
            className={`relative text-muted hover:text-ink transition-colors p-2 rounded-[15px] hover:bg-ink/5 ${showNotifications ? 'text-ink bg-ink/5' : ''}`}
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-accent-red rounded-full"></span>}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full right-0 mt-4 w-80 bg-surface border border-border rounded-[15px] shadow-2xl overflow-hidden z-50"
              >
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-bold text-sm">Recent Notifications</h3>
                  <button onClick={() => setShowNotifications(false)} className="text-muted hover:text-ink"><X size={16} /></button>
                </div>
                <div className="max-h-96 overflow-y-auto no-scrollbar">
                  {notifications.slice(0, 5).map((notification) => {
                    const meta = getNotificationMeta(notification.type);
                    const Icon = meta.icon;

                    return (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full text-left p-4 flex items-start gap-4 hover:bg-ink/5 cursor-pointer transition-colors border-b border-border/50 last:border-0 ${notification.isRead ? '' : 'bg-ink/5'}`}
                      >
                        <div className={`w-8 h-8 rounded-[15px] ${meta.color} flex items-center justify-center text-bg`}>
                          <Icon size={14} className={meta.color === 'bg-ink/20' ? 'text-ink' : ''} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold mb-1">{notification.title}</p>
                          <p className="text-[10px] text-muted">{formatRelativeTime(notification.createdAt)}</p>
                        </div>
                      </button>
                    );
                  })}
                  {notifications.length === 0 && (
                    <div className="p-4 text-[10px] text-muted">No notifications yet.</div>
                  )}
                </div>
                <Link
                  to="/notifications"
                  onClick={() => setShowNotifications(false)}
                  className="block w-full text-center p-3 text-[10px] font-bold text-muted hover:text-ink transition-colors bg-ink/5"
                >
                  View All Notifications
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-8 w-[1px] bg-border"></div>
        <Link to="/profile" className="flex items-center gap-3 group">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold group-hover:text-accent-orange transition-colors">{displayName}</p>
            <p className="text-[10px] text-muted">{userRole ? `${userRole[0].toUpperCase()}${userRole.slice(1)}` : 'Member'}</p>
          </div>
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt="Profile"
              className="w-10 h-10 rounded-[10px] object-cover border-2 border-border group-hover:border-accent-orange transition-all"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-[10px] border-2 border-border group-hover:border-accent-orange transition-all bg-ink/10 flex items-center justify-center font-black">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </Link>
      </div>
    </header>

    <AnimatePresence>
      {showWalletModal && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-[100] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-surface border border-border rounded-[15px] p-8 max-w-sm w-full shadow-2xl relative"
          >
            <button
              onClick={() => {
                setShowWalletModal(false);
                setSelectedProvider(null);
              }}
              className="absolute top-4 right-4 text-muted hover:text-ink"
            >
              <X size={20} />
            </button>
            <h3 className="text-2xl font-black mb-6 text-center">
              {selectedProvider ? 'Select Role' : 'Connect Wallet'}
            </h3>
            {isBlocked && (
              <div className="bg-accent-red/10 border border-accent-red text-accent-red p-4 rounded-[15px] mb-6 text-sm text-center font-bold">
                This wallet has been blocked by the administrator.
              </div>
            )}

            {!selectedProvider ? (
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedProvider('xverse')}
                  className="w-full py-4 rounded-[15px] border border-border hover:border-accent-orange hover:bg-accent-orange/5 transition-all font-bold flex items-center justify-center gap-3"
                >
                  <div className="w-6 h-6 bg-ink rounded-full flex items-center justify-center text-bg text-xs">X</div>
                  Xverse Wallet
                </button>
                <button
                  onClick={() => setSelectedProvider('leather')}
                  className="w-full py-4 rounded-[15px] border border-border hover:border-accent-cyan hover:bg-accent-cyan/5 transition-all font-bold flex items-center justify-center gap-3"
                >
                  <div className="w-6 h-6 bg-ink rounded-full flex items-center justify-center text-bg text-xs">L</div>
                  Leather Wallet
                </button>
                <button
                  onClick={() => setSelectedProvider('other')}
                  className="w-full py-4 rounded-[15px] border border-border hover:border-blue-500 hover:bg-blue-500/5 transition-all font-bold flex items-center justify-center gap-3"
                >
                  <Wallet size={24} className="text-blue-500" />
                  Any Bitcoin Wallet
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => handleConnect('client')}
                  className="w-full py-4 rounded-[15px] border border-border hover:border-accent-cyan hover:bg-accent-cyan/5 transition-all font-bold flex flex-col items-center gap-2"
                >
                  <span className="text-accent-cyan"><Briefcase size={24} /></span>
                  Connect as Client
                </button>
                <button
                  onClick={() => handleConnect('freelancer')}
                  className="w-full py-4 rounded-[15px] border border-border hover:border-accent-orange hover:bg-accent-orange/5 transition-all font-bold flex flex-col items-center gap-2"
                >
                  <span className="text-accent-orange"><PenTool size={24} /></span>
                  Connect as Freelancer
                </button>
                <button
                  onClick={() => setSelectedProvider(null)}
                  className="w-full py-2 text-xs font-bold text-muted hover:text-ink transition-colors mt-2"
                >
                  Back to Wallets
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
};
