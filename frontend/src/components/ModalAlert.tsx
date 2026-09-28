import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  XCircle, 
  X, 
  Copy, 
  Check, 
  Terminal,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Trash2
} from 'lucide-react';
import { parseFriendlyError } from '../utils/friendlyError';
import { useI18n } from '../i18n/translations';

export interface DialogOptions {
  id?: string;
  title?: string;
  message: string;
  suggestion?: string;
  detailedOutput?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  isConfirm?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  duration?: number;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface InternalConfirmState extends ConfirmOptions {
  resolve: (val: boolean) => void;
}

interface ToastItem {
  id: string;
  title: string;
  message: string;
  suggestion?: string;
  detailedOutput?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration: number;
}

type DialogListener = (opts: DialogOptions | null) => void;
let currentListener: DialogListener | null = null;
let currentConfirmListener: ((opts: InternalConfirmState | null) => void) | null = null;

export const showDialog = (options: DialogOptions) => {
  if (currentListener) {
    currentListener(options);
  }
};

export const closeDialog = () => {
  if (currentListener) {
    currentListener(null);
  }
};

/**
 * Shows an embedded, beautifully themed confirmation modal that matches
 * the rest of the application (both light and dark mode), replacing
 * ugly browser-native confirm() popups.
 */
export const confirmAction = (options: ConfirmOptions | string): Promise<boolean> => {
  const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
  return new Promise((resolve) => {
    if (currentConfirmListener) {
      currentConfirmListener({
        ...opts,
        resolve,
      });
    } else {
      // Fallback in case component is not mounted yet
      resolve(window.confirm(opts.message));
    }
  });
};

export const ModalAlert: React.FC = () => {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<InternalConfirmState | null>(null);

  useEffect(() => {
    currentConfirmListener = (opts) => {
      setConfirmState(opts);
    };

    currentListener = (opts) => {
      if (!opts) return;

      if (opts.isConfirm) {
        setConfirmState({
          title: opts.title || "Confirmation Required",
          message: opts.message,
          resolve: (val) => {
            if (val) opts.onConfirm?.();
            else opts.onCancel?.();
          }
        });
        return;
      }

      // Automatically parse message into friendly output if raw
      const parsed = parseFriendlyError(opts.message);
      const title = opts.title || parsed.title;
      const message = opts.title ? opts.message : parsed.message;
      const suggestion = opts.suggestion || parsed.suggestion;
      const detailedOutput = opts.detailedOutput || parsed.rawDetails;
      const type = opts.type || parsed.type;

      const newToast: ToastItem = {
        id: opts.id || Math.random().toString(36).substring(2, 9),
        title,
        message,
        suggestion,
        detailedOutput,
        type,
        duration: opts.duration || (detailedOutput || suggestion ? 8500 : 4500),
      };

      setToasts((prev) => [...prev.slice(-4), newToast]);
    };

    // Override native window.alert globally to use non-intrusive floating toasts with friendly parsing
    const nativeAlert = window.alert;
    window.alert = (msg: any) => {
      const messageStr = typeof msg === 'string' ? msg : String(msg);
      const parsed = parseFriendlyError(messageStr);

      showDialog({
        title: parsed.title,
        message: parsed.message,
        suggestion: parsed.suggestion,
        detailedOutput: parsed.rawDetails,
        type: parsed.type,
      });
    };

    return () => {
      window.alert = nativeAlert;
      currentListener = null;
      currentConfirmListener = null;
    };
  }, []);

  const [isClosingConfirm, setIsClosingConfirm] = useState(false);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleConfirmDecision = (accepted: boolean) => {
    if (!confirmState || isClosingConfirm) return;
    setIsClosingConfirm(true);
    setTimeout(() => {
      confirmState.resolve(accepted);
      setConfirmState(null);
      setIsClosingConfirm(false);
    }, 200);
  };

  return (
    <>
      {/* 1. Floating Non-Intrusive Toasts (Bottom-Right corner) */}
      <div 
        className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full select-none"
        style={{ maxWidth: '400px' }}
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>

      {/* 2. Beautiful Themed Confirmation Modal with smooth popup & close animations */}
      {confirmState && (
        <div 
          onClick={() => handleConfirmDecision(false)}
          className={`fixed inset-0 bg-slate-950/40 dark:bg-black/70 backdrop-blur-sm z-[100000] flex items-center justify-center p-4 transition-opacity duration-200 ${
            isClosingConfirm ? 'opacity-0' : 'opacity-100 animate-in fade-in duration-200'
          }`}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`launcher-card bg-dark-900 border border-dark-700/80 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 transition-all duration-200 ${
              isClosingConfirm 
                ? 'scale-95 opacity-0 translate-y-3' 
                : 'animate-in zoom-in-95 fade-in slide-in-from-bottom-3 duration-200 ease-out'
            }`}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-dark-750">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmState.isDestructive 
                    ? 'bg-rose-500/15 border border-rose-500/30 text-rose-500' 
                    : 'bg-amber-500/15 border border-amber-500/30 text-amber-500'
                }`}>
                  {confirmState.isDestructive ? <Trash2 size={18} /> : <AlertTriangle size={18} />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 font-sans">
                    {confirmState.title || t('confirmationRequired', 'Confirmation Required')}
                  </h3>
                  <p className="text-[10px] text-slate-400">LeviLamina Server Manager</p>
                </div>
              </div>
              <button
                onClick={() => handleConfirmDecision(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-dark-800 transition-colors"
                title={t('cancel', 'Cancel')}
              >
                <X size={15} />
              </button>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed font-medium whitespace-pre-line">
              {confirmState.message}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-dark-750">
              <button
                type="button"
                onClick={() => handleConfirmDecision(false)}
                className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold transition-colors active:scale-95"
              >
                {confirmState.cancelText || t('cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDecision(true)}
                className={`px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
                  confirmState.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25'
                    : 'bg-brand-500 hover:bg-brand-400 text-slate-950 shadow-brand-500/20'
                }`}
              >
                {confirmState.confirmText || (confirmState.isDestructive ? t('delete', 'Delete') : t('confirm', 'Confirm'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface ToastCardProps {
  toast: ToastItem;
  onClose: () => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onClose }) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<number | null>(null);

  const triggerClose = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  useEffect(() => {
    if (isPaused || isExiting) return;

    timerRef.current = window.setTimeout(() => {
      triggerClose();
    }, toast.duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.duration, isPaused, isExiting]);

  const handleCopy = () => {
    const fullText = toast.detailedOutput 
      ? `${toast.message}\n\n${toast.detailedOutput}`
      : toast.message;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-amber-400 shrink-0" />;
      case 'error':
        return <XCircle size={16} className="text-rose-400 shrink-0" />;
      default:
        return <Info size={16} className="text-brand-400 shrink-0" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-emerald-500/30 shadow-emerald-500/10';
      case 'warning':
        return 'border-amber-500/30 shadow-amber-500/10';
      case 'error':
        return 'border-rose-500/30 shadow-rose-500/10';
      default:
        return 'border-brand-500/30 shadow-brand-500/10';
    }
  };

  const getProgressBarColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-emerald-400';
      case 'warning':
        return 'bg-amber-400';
      case 'error':
        return 'bg-rose-400';
      default:
        return 'bg-brand-400';
    }
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`toast-card pointer-events-auto rounded-2xl bg-dark-900/95 backdrop-blur-md border ${getBorderColor()} shadow-2xl p-3.5 flex flex-col gap-2 transition-all duration-300 relative overflow-hidden group hover:border-white/[0.25] ${
        isExiting 
          ? 'opacity-0 translate-x-10 scale-95 pointer-events-none' 
          : 'animate-in fade-in slide-in-from-right-8 zoom-in-95 duration-300 ease-out'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
            {getIcon()}
          </div>
          <span className="toast-title font-bold text-xs text-white truncate font-sans">
            {toast.title}
          </span>
        </div>

        <button
          onClick={triggerClose}
          className="text-slate-500 hover:text-slate-200 p-0.5 rounded-lg hover:bg-white/[0.06] transition-colors shrink-0 cursor-pointer"
          title={t('dismiss', 'Dismiss')}
        >
          <X size={13} />
        </button>
      </div>

      {/* Message Text */}
      <p className="text-xs text-slate-200 leading-relaxed font-medium ltr:pl-8 ltr:pr-1 rtl:pr-8 rtl:pl-1">
        {toast.message}
      </p>

      {/* Actionable User Suggestion if available */}
      {toast.suggestion && (
        <div className="ltr:ml-8 ltr:mr-1 rtl:mr-8 rtl:ml-1 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-[11px] text-amber-200/90 leading-snug">
          <Lightbulb size={13} className="text-amber-400 shrink-0 mt-0.5" />
          <span>{toast.suggestion}</span>
        </div>
      )}

      {/* Expandable CLI Output / Detailed Log if multi-line */}
      {toast.detailedOutput && (
        <div className="ltr:pl-8 rtl:pr-8 pt-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1 uppercase tracking-wider cursor-pointer"
            >
              <Terminal size={11} />
              <span>{expanded ? t('hideDetails', 'Hide Details') : t('viewDetails', 'View Details')}</span>
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            <button
              onClick={handleCopy}
              className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={10} className="text-emerald-400" /> {t('copied', 'Copied')}
                </>
              ) : (
                <>
                  <Copy size={10} /> {t('copy', 'Copy')}
                </>
              )}
            </button>
          </div>

          {expanded && (
            <div className="bg-dark-950 p-2.5 rounded-xl border border-white/[0.08] max-h-36 overflow-y-auto text-[10px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed select-text shadow-inner">
              {toast.detailedOutput}
            </div>
          )}
        </div>
      )}

      {/* Subtle Animated Countdown Progress Bar at Bottom of Toast */}
      <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white/[0.06] overflow-hidden">
        <div 
          className={`h-full ${getProgressBarColor()} transition-all ease-linear`}
          style={{
            width: isExiting ? '0%' : '100%',
            animation: isPaused ? 'none' : `toastCountdown ${toast.duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
};

export default ModalAlert;
