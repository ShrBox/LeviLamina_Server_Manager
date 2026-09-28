import React, { useState, useEffect } from 'react';
import { 
  User, 
  X, 
  Minus, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  Gamepad2
} from 'lucide-react';
import { 
  WindowMinimise, 
  WindowToggleMaximise, 
  WindowIsMaximised, 
  Quit 
} from '../../wailsjs/runtime/runtime';
import { useI18n } from '../i18n';
import { XboxAccount } from '../types';
import { getSafeAvatarUrl, DEFAULT_AVATAR_SVG } from '../utils/avatar';
import { Api } from '../services/api';

interface TitleBarProps {
  onNavigateProfile?: () => void;
  activeServerName?: string;
  updatesCount?: number;
  onOpenUpdates?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  xboxAccount?: XboxAccount | null;
  onOpenXboxModal?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ 
  onNavigateProfile, 
  activeServerName,
  updatesCount,
  onOpenUpdates,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  xboxAccount,
  onOpenXboxModal
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        if (typeof WindowIsMaximised === 'function') {
          const max = await WindowIsMaximised();
          setIsMaximized(!!max);
        }
      } catch {
        // Fallback in browser
      }
    };

    checkMaximized();
    window.addEventListener('resize', checkMaximized);
    return () => window.removeEventListener('resize', checkMaximized);
  }, []);

  const handleMinimize = () => {
    try {
      WindowMinimise();
    } catch (e) {
      console.warn('WindowMinimise not supported in browser environment', e);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      WindowToggleMaximise();
      setTimeout(async () => {
        if (typeof WindowIsMaximised === 'function') {
          const max = await WindowIsMaximised();
          setIsMaximized(!!max);
        }
      }, 100);
    } catch (e) {
      console.warn('WindowToggleMaximise not supported in browser environment', e);
    }
  };

  const handleClose = () => {
    try {
      Quit();
    } catch (e) {
      console.warn('Quit not supported in browser environment', e);
    }
  };

  return (
    <header 
      className="app-titlebar wails-drag h-9 w-full flex items-center justify-between select-none z-[10000] relative shrink-0 transition-colors"
      onDoubleClick={handleToggleMaximize}
    >
      {/* Left Area: Icon, Navigation Arrows & Brand Title */}
      <div className="flex items-center gap-2 px-3 h-full">
        <img 
          src="/appicon.png" 
          alt="LeviLamina" 
          className="w-4 h-4 rounded pointer-events-none drop-shadow-sm" 
        />

        {/* Navigation Arrows */}
        <div className="flex items-center gap-0.5 wails-no-drag ml-1 mr-1">
          <button
            type="button"
            onClick={onGoBack}
            disabled={!canGoBack}
            title={`${t('back', 'Back')} (Alt+Left)`}
            className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
              canGoBack 
                ? 'text-slate-300 hover:text-white hover:bg-white/[0.12] active:scale-95 cursor-pointer' 
                : 'text-slate-600 opacity-40 cursor-not-allowed'
            }`}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={onGoForward}
            disabled={!canGoForward}
            title={`${t('forward', 'Forward')} (Alt+Right)`}
            className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
              canGoForward 
                ? 'text-slate-300 hover:text-white hover:bg-white/[0.12] active:scale-95 cursor-pointer' 
                : 'text-slate-600 opacity-40 cursor-not-allowed'
            }`}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-slate-200">
            LeviLamina Server Manager
          </span>
          {activeServerName && (
            <span className="text-[10px] font-medium text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded border border-white/[0.08]">
              {activeServerName}
            </span>
          )}
        </div>
      </div>

      {/* Middle Drag Spacer */}
      <div className="flex-1 h-full wails-drag" />

      {/* Right Area: Xbox Pill, Updates, Profile & Window Controls */}
      <div className="flex items-center h-full wails-no-drag">
        {/* Unified Profile / Xbox Account Button */}
        <div className="px-1.5 flex items-center">
          {xboxAccount && xboxAccount.isLoggedIn ? (
            <button
              type="button"
              onClick={onOpenXboxModal}
              title={`Xbox Account: ${xboxAccount.gamertag} (Click to manage)`}
              className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/35 hover:border-emerald-400 text-slate-200 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer group"
            >
              <div className="relative w-5 h-5 rounded-full overflow-hidden shrink-0 border border-emerald-400 shadow-sm bg-dark-800">
                <img 
                  src={getSafeAvatarUrl(xboxAccount.avatarUrl, xboxAccount.gamertag)}
                  alt={xboxAccount.gamertag}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_AVATAR_SVG(xboxAccount.gamertag?.[0] || 'X');
                  }}
                />
              </div>
              <span className="max-w-[120px] truncate text-emerald-300 group-hover:text-emerald-200">
                {xboxAccount.gamertag}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenXboxModal}
              title={t('xboxLogin', 'Xbox Login')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-dark-800 hover:bg-dark-750 text-slate-300 hover:text-white border border-white/[0.08] hover:border-emerald-500/40 text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Gamepad2 size={13} className="text-emerald-400" />
              <span>{t('xboxLogin', 'Xbox Login')}</span>
            </button>
          )}
        </div>

        {/* Updates Available Badge Button */}
        {updatesCount && updatesCount > 0 ? (
          <button
            type="button"
            onClick={onOpenUpdates}
            className="mr-2 px-2.5 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-400 text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 animate-pulse cursor-pointer"
            title={`${updatesCount} ${t('updatesAvailable', 'Updates Available')}`}
          >
            <Sparkles size={11} className="text-amber-400" />
            <span>{updatesCount} {t('updates', 'Updates')}</span>
          </button>
        ) : null}

        {/* Window Control Buttons */}
        <div className="flex items-center h-full">
          {/* Minimize */}
          <button
            type="button"
            onClick={handleMinimize}
            title={t('minimize', 'Minimize')}
            className="w-11 h-full flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] active:bg-white/[0.14] transition-colors cursor-pointer"
          >
            <Minus size={13} strokeWidth={2} />
          </button>

          {/* Maximize / Restore */}
          <button
            type="button"
            onClick={handleToggleMaximize}
            title={isMaximized ? t('restore', 'Restore') : t('maximize', 'Maximize')}
            className="w-11 h-full flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] active:bg-white/[0.14] transition-colors cursor-pointer"
          >
            {isMaximized ? (
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-current" strokeWidth="1.2">
                <path d="M3 8.5H1.5V1.5H8.5V3M3 3H9.5V9.5H3V3Z" />
              </svg>
            ) : (
              <div className="w-2.5 h-2.5 border border-current rounded-[1px]" />
            )}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={handleClose}
            title={t('close', 'Close')}
            className="w-11 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#e81123] active:bg-[#bf101d] transition-colors cursor-pointer"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </header>
  );
};
