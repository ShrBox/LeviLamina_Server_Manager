import React, { useEffect, useState } from 'react';
import { Download, Check, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n';

export interface InstallButtonProps {
  isInstalling: boolean;
  isInstalled?: boolean;
  onInstall: () => void;
  label?: string;
  installedLabel?: string;
  installingLabel?: string;
  className?: string;
  variant?: 'emerald' | 'brand' | 'orange' | 'amber' | 'blue';
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  progress?: number; // Optional real progress 0-100
}

export const InstallButton: React.FC<InstallButtonProps> = ({
  isInstalling,
  isInstalled = false,
  onInstall,
  label,
  installedLabel,
  installingLabel,
  className = '',
  variant = 'emerald',
  disabled = false,
  size = 'md',
  progress: externalProgress,
}) => {
  const { t } = useI18n();
  const [internalProgress, setInternalProgress] = useState(15);

  useEffect(() => {
    let timer: any;
    if (isInstalling) {
      setInternalProgress(15);
      const steps = [
        { p: 32, delay: 350 },
        { p: 54, delay: 800 },
        { p: 72, delay: 1400 },
        { p: 86, delay: 2200 },
        { p: 94, delay: 3200 },
      ];
      steps.forEach(({ p, delay }) => {
        timer = setTimeout(() => {
          setInternalProgress(p);
        }, delay);
      });
    } else {
      setInternalProgress(15);
    }
    return () => clearTimeout(timer);
  }, [isInstalling]);

  const currentProgress = externalProgress !== undefined ? externalProgress : internalProgress;

  // Theme palettes
  const colorSchemes = {
    emerald: {
      idleBg: 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20',
      installedBg: 'bg-dark-800 text-emerald-400 border border-emerald-500/30',
      barTrack: 'bg-emerald-950/70 border-emerald-500/50',
      barFill: 'from-emerald-600 via-emerald-500 to-emerald-400',
      glow: 'shadow-emerald-500/20',
      textAccent: 'text-emerald-300',
    },
    brand: {
      idleBg: 'bg-brand-500 hover:bg-brand-600 text-slate-950 shadow-brand-500/20',
      installedBg: 'bg-dark-800 text-brand-400 border border-brand-500/30',
      barTrack: 'bg-emerald-950/70 border-brand-500/50',
      barFill: 'from-brand-600 via-brand-500 to-brand-400',
      glow: 'shadow-brand-500/20',
      textAccent: 'text-brand-300',
    },
    orange: {
      idleBg: 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20',
      installedBg: 'bg-dark-800 text-orange-400 border border-orange-500/30',
      barTrack: 'bg-orange-950/70 border-orange-500/50',
      barFill: 'from-orange-600 via-orange-500 to-amber-400',
      glow: 'shadow-orange-500/20',
      textAccent: 'text-orange-300',
    },
    amber: {
      idleBg: 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20',
      installedBg: 'bg-dark-800 text-amber-400 border border-amber-500/30',
      barTrack: 'bg-amber-950/70 border-amber-500/50',
      barFill: 'from-amber-600 via-amber-500 to-yellow-400',
      glow: 'shadow-amber-500/20',
      textAccent: 'text-amber-300',
    },
    blue: {
      idleBg: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20',
      installedBg: 'bg-dark-800 text-blue-400 border border-blue-500/30',
      barTrack: 'bg-blue-950/70 border-blue-500/50',
      barFill: 'from-blue-600 via-blue-500 to-cyan-400',
      glow: 'shadow-blue-500/20',
      textAccent: 'text-blue-300',
    },
  };

  const scheme = colorSchemes[variant] || colorSchemes.emerald;

  const sizeClasses = {
    sm: 'py-1.5 px-2.5 text-[11px] rounded-lg',
    md: 'py-2 px-3 text-xs rounded-xl',
    lg: 'py-2.5 px-4 text-xs font-black rounded-xl',
  }[size];

  // Active Downloading State -> Replace button with unified Download Loading Bar
  if (isInstalling) {
    return (
      <div
        dir="ltr"
        className={`relative w-full ${sizeClasses} overflow-hidden border ${scheme.barTrack} bg-dark-900 flex items-center justify-between select-none shadow-inner ${className}`}
      >
        {/* Animated dynamic progress filling bar */}
        <div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${scheme.barFill} transition-all duration-300 ease-out opacity-85 shadow-lg ${scheme.glow}`}
          style={{ width: `${Math.min(100, Math.max(8, currentProgress))}%` }}
        />

        {/* Diagonal moving barber-pole stripes */}
        <div
          className="absolute inset-y-0 left-0 transition-all duration-300 pointer-events-none opacity-30"
          style={{
            width: `${Math.min(100, Math.max(8, currentProgress))}%`,
            backgroundImage:
              'linear-gradient(45deg, rgba(255, 255, 255, 0.25) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.25) 50%, rgba(255, 255, 255, 0.25) 75%, transparent 75%, transparent)',
            backgroundSize: '1rem 1rem',
            animation: 'download-bar-stripes 1s linear infinite',
          }}
        />

        {/* Foreground Information */}
        <div className="relative z-10 flex items-center gap-1.5 text-white font-extrabold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
          <Download size={size === 'sm' ? 12 : 14} className="animate-bounce shrink-0" />
          <span className="truncate">
            {installingLabel || t('downloadingInstalling', 'Downloading & Installing...')}
          </span>
        </div>

        <div className="relative z-10 text-[10px] font-mono font-bold text-white bg-dark-950/70 px-1.5 py-0.5 rounded border border-white/20 shadow-sm shrink-0 ml-1">
          {currentProgress}%
        </div>
      </div>
    );
  }

  // Installed State
  if (isInstalled) {
    return (
      <button
        type="button"
        disabled={true}
        className={`flex items-center justify-center gap-1.5 font-bold transition-all shadow-sm ${scheme.installedBg} ${sizeClasses} ${className}`}
      >
        <Check size={size === 'sm' ? 13 : 15} />
        <span>{installedLabel || t('installed', 'Installed')}</span>
      </button>
    );
  }

  // Idle Install Button
  return (
    <button
      type="button"
      onClick={onInstall}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 ${scheme.idleBg} ${sizeClasses} ${className}`}
    >
      <Download size={size === 'sm' ? 13 : 15} />
      <span>{label || t('install', 'Install')}</span>
    </button>
  );
};

export default InstallButton;
