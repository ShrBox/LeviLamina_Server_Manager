import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { XboxAccount } from '../types';

interface XboxWelcomeBannerProps {
  account: XboxAccount | null;
  onDismiss?: () => void;
}

export const XboxWelcomeBanner: React.FC<XboxWelcomeBannerProps> = ({ account, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<XboxAccount | null>(account);

  useEffect(() => {
    const handleWelcomeEvent = (e: CustomEvent<XboxAccount>) => {
      if (e.detail && e.detail.isLoggedIn && e.detail.gamertag) {
        setCurrentAccount(e.detail);
        setVisible(true);
      }
    };

    window.addEventListener('xbox-welcome' as any, handleWelcomeEvent as any);
    return () => {
      window.removeEventListener('xbox-welcome' as any, handleWelcomeEvent as any);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
      if (onDismiss) onDismiss();
    }, 5500);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  if (!visible || !currentAccount || !currentAccount.isLoggedIn) {
    return null;
  }

  const avatar = currentAccount.avatarUrl || `https://avatar.xboxlive.com/avatar/${encodeURIComponent(currentAccount.gamertag)}/avatarpic-l.png`;

  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[99999] pointer-events-auto animate-in fade-in slide-in-from-top-6 duration-300">
      <div className="relative flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-dark-900/95 backdrop-blur-2xl border border-emerald-500/50 shadow-2xl shadow-emerald-500/20 select-none group min-w-[320px] max-w-md">
        {/* Ambient Xbox Green Glow */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-transparent to-emerald-500/5 pointer-events-none" />

        {/* Xbox Sphere / Logo Badge */}
        <div className="relative shrink-0">
          <img
            src={avatar}
            alt={currentAccount.gamertag}
            className="w-11 h-11 rounded-full object-cover border-2 border-emerald-500 shadow-md shadow-emerald-500/30"
            onError={(e) => {
              // Fallback default avatar
              (e.target as HTMLImageElement).src = 'https://images.placeholders.dev/?width=100&height=100&text=XB&bgColor=%23107c10&textColor=%23ffffff';
            }}
          />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-dark-900 flex items-center justify-center text-slate-950">
            <Check size={10} strokeWidth={3.5} />
          </div>
        </div>

        {/* Welcome Message & Gamertag */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
              Xbox Live
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-xs text-slate-300 font-medium">
            Welcome back,
          </div>
          <div className="text-sm font-black text-white truncate drop-shadow-sm flex items-center gap-1.5">
            <span>{currentAccount.gamertag}</span>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            if (onDismiss) onDismiss();
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
