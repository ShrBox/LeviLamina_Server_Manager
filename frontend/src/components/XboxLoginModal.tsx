import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  ExternalLink, 
  Copy, 
  Check, 
  RotateCw, 
  ShieldCheck, 
  LogOut, 
  CheckCircle2,
  Gamepad2,
  AlertCircle
} from 'lucide-react';
import { Api } from '../services/api';
import { XboxAccount, DeviceAuthResponse } from '../types';
import { useI18n } from '../i18n';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { getSafeAvatarUrl, DEFAULT_AVATAR_SVG } from '../utils/avatar';

interface XboxLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeServerId?: string;
  onAccountUpdated?: (acc: XboxAccount | null) => void;
}

export const XboxLoginModal: React.FC<XboxLoginModalProps> = ({
  isOpen,
  onClose,
  activeServerId,
  onAccountUpdated
}) => {
  const { t } = useI18n();
  const [account, setAccount] = useState<XboxAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [authStep, setAuthStep] = useState<'idle' | 'device_code' | 'manual'>('idle');
  const [deviceAuth, setDeviceAuth] = useState<DeviceAuthResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [manualGamertag, setManualGamertag] = useState('');
  const [opStatus, setOpStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCurrentAccount();
    } else {
      setAuthStep('idle');
      setDeviceAuth(null);
      setPolling(false);
      setPollError(null);
      setOpStatus(null);
    }
  }, [isOpen]);

  const loadCurrentAccount = async () => {
    setLoading(true);
    try {
      const acc = await Api.getXboxAccount();
      if (acc && acc.isLoggedIn && acc.gamertag) {
        setAccount(acc);
      } else {
        setAccount(null);
      }
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDeviceAuth = async () => {
    setLoading(true);
    setOpStatus(null);
    setPollError(null);
    try {
      const auth = await Api.startXboxDeviceAuth();
      setDeviceAuth(auth);
      setAuthStep('device_code');
      setPolling(true);

      // Open browser directly via window.open to prevent cmd popup
      if (auth.verificationUri) {
        openUrl(auth.verificationUri);
      }
    } catch (err: any) {
      alert("Failed to start Microsoft authorization: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Poll device authorization
  useEffect(() => {
    if (!polling || !deviceAuth?.deviceCode) return;

    const intervalId = setInterval(async () => {
      try {
        const acc = await Api.pollXboxDeviceAuth(deviceAuth.deviceCode);
        if (acc && acc.isLoggedIn) {
          setAccount(acc);
          setPolling(false);
          setPollError(null);
          setAuthStep('idle');
          window.dispatchEvent(new CustomEvent('xbox-welcome', { detail: acc }));
          if (onAccountUpdated) onAccountUpdated(acc);
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('pending')) {
          setPollError(err.message);
          if (err.message.includes('invalid_grant') || err.message.includes('expired')) {
            setPolling(false);
          }
        }
      }
    }, (deviceAuth.interval || 5) * 1000);

    return () => clearInterval(intervalId);
  }, [polling, deviceAuth]);

  const handleManualSave = async () => {
    const tag = manualGamertag.trim();
    if (!tag) return;
    setLoading(true);
    try {
      const acc: XboxAccount = {
        gamertag: tag,
        xuid: '',
        avatarUrl: getSafeAvatarUrl(null, tag),
        isLoggedIn: true,
        source: 'manual',
        updatedAt: new Date().toISOString()
      };
      await Api.saveXboxAccount(acc);
      setAccount(acc);
      setAuthStep('idle');
      window.dispatchEvent(new CustomEvent('xbox-welcome', { detail: acc }));
      if (onAccountUpdated) onAccountUpdated(acc);
    } catch (err: any) {
      alert("Failed to save account: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await Api.clearXboxAccount();
      setAccount(null);
      setAuthStep('idle');
      setDeviceAuth(null);
      if (onAccountUpdated) onAccountUpdated(null);
    } catch (err: any) {
      alert("Failed to sign out: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantOp = async () => {
    if (!activeServerId) {
      alert("Please select or start a server first.");
      return;
    }
    setLoading(true);
    try {
      await Api.addXboxAccountAsOp(activeServerId);
      setOpStatus(`Operator (OP) permission successfully granted to ${account?.gamertag}!`);
    } catch (err: any) {
      alert("Failed to grant operator permission: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (deviceAuth?.userCode) {
      navigator.clipboard.writeText(deviceAuth.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openUrl = (url: string) => {
    try {
      if (BrowserOpenURL) {
        BrowserOpenURL(url);
      } else {
        window.open(url, '_blank');
      }
    } catch {
      window.open(url, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div 
        className="w-full max-w-lg bg-dark-900 border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden animate-modal-in flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-dark-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
              <Gamepad2 size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Xbox Live & Microsoft Account
              </h2>
              <p className="text-xs text-slate-400">
                Sign in to verify your Bedrock gamer identity and grant operator roles.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* LOGGED IN VIEW */}
          {account && account.isLoggedIn ? (
            <div className="space-y-5 animate-spring-pop">
              {/* Profile Card */}
              <div className="p-5 rounded-2xl bg-dark-950/70 border border-emerald-500/25 flex items-center gap-4 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

                <div className="relative">
                  <img
                    src={getSafeAvatarUrl(account.avatarUrl, account.gamertag)}
                    alt={account.gamertag}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 shadow-md bg-dark-800"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = DEFAULT_AVATAR_SVG(account.gamertag?.[0] || 'X');
                    }}
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 shadow-sm" title="Connected">
                    <Check size={11} strokeWidth={3} />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-white truncate">
                      {account.gamertag}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/35">
                      Verified
                    </span>
                  </div>

                  {account.xuid && (
                    <div className="text-xs text-slate-400 mt-1 font-mono">
                      XUID: <span className="text-slate-200">{account.xuid}</span>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 mt-0.5 capitalize">
                    Source: {account.source || 'Xbox Live'}
                  </div>
                </div>
              </div>

              {opStatus && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in-up">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                  <span>{opStatus}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2.5">
                <button
                  onClick={handleGrantOp}
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-brand-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck size={16} />
                  Grant Operator (OP) Permissions to Server
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => { setAuthStep('idle'); setAccount(null); }}
                    className="flex-1 py-2 px-3 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold border border-white/[0.08] transition-all cursor-pointer"
                  >
                    Switch Account
                  </button>
                  <button
                    onClick={handleLogout}
                    disabled={loading}
                    className="py-2 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* LOGGED OUT / AUTH FLOW */
            <div className="space-y-5">
              {authStep === 'device_code' && deviceAuth ? (
                /* MICROSOFT DEVICE FLOW VIEW */
                <div className="space-y-5 animate-spring-pop">
                  <div className="p-4 rounded-2xl bg-dark-950/70 border border-white/[0.08] text-center space-y-3">
                    <span className="text-xs text-slate-400 block">
                      To complete Microsoft sign-in, enter this code at the Microsoft login page:
                    </span>

                    <div className="flex items-center justify-center gap-2">
                      <div className="text-2xl font-black font-mono tracking-widest text-emerald-400 bg-dark-800 px-5 py-2.5 rounded-xl border border-emerald-500/30 select-all shadow-inner">
                        {deviceAuth.userCode}
                      </div>
                      <button
                        onClick={handleCopyCode}
                        className="p-3 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 border border-white/[0.08] transition-all cursor-pointer active:scale-95 shadow-sm"
                        title="Copy Code"
                      >
                        {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                      </button>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-brand-400 pt-1">
                      <RotateCw size={14} className="animate-spin" />
                      <span>Waiting for Microsoft authorization...</span>
                    </div>

                    {pollError && (
                      <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-xs text-left space-y-2 animate-fade-in-up">
                        <div className="font-bold flex items-center gap-1.5 text-amber-300">
                          <AlertCircle size={15} />
                          <span>Sign-In Notice</span>
                        </div>
                        <div className="text-[11px] text-amber-100/90 leading-relaxed">{pollError}</div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleStartDeviceAuth}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-bold transition-all cursor-pointer"
                          >
                            Generate New Code
                          </button>
                          <button
                            type="button"
                            onClick={() => { setAuthStep('manual'); setPolling(false); setPollError(null); }}
                            className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-slate-300 text-[11px] font-semibold transition-all cursor-pointer"
                          >
                            Sign In with Gamertag Instead
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openUrl(deviceAuth.verificationUri || 'https://www.microsoft.com/link')}
                      className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer"
                    >
                      Open Microsoft Login Page <ExternalLink size={14} />
                    </button>
                    <button
                      onClick={() => { setAuthStep('idle'); setPolling(false); setPollError(null); }}
                      className="py-3 px-4 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold border border-white/[0.08]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : authStep === 'manual' ? (
                /* MANUAL GAMERTAG ENTRY */
                <div className="space-y-4 animate-spring-pop">
                  <div>
                    <label className="text-xs font-bold text-slate-200 block mb-1.5">
                      Minecraft Xbox Gamertag
                    </label>
                    <input
                      type="text"
                      value={manualGamertag}
                      onChange={e => setManualGamertag(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleManualSave(); }}
                      placeholder="e.g. Steve"
                      className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleManualSave}
                      disabled={!manualGamertag.trim() || loading}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
                    >
                      Save Account
                    </button>
                    <button
                      onClick={() => setAuthStep('idle')}
                      className="py-2.5 px-4 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold border border-white/[0.08]"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                /* DEFAULT SIGN-IN OPTIONS */
                <div className="space-y-4">
                  {/* Primary: Official Microsoft OAuth Device Flow */}
                  <div 
                    onClick={handleStartDeviceAuth}
                    className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-dark-800 to-dark-800 hover:from-emerald-500/25 border border-emerald-500/35 hover:border-emerald-500/60 cursor-pointer transition-all flex items-center justify-between gap-4 group shadow-md active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shadow-sm">
                        <Gamepad2 size={24} />
                      </div>
                      <div>
                        <div className="font-black text-sm text-white group-hover:text-emerald-300 transition-colors flex items-center gap-2">
                          <span>Sign in with Microsoft</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Recommended
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Authenticate via code at microsoft.com/link. Links your official Bedrock Gamertag and XUID.
                        </div>
                      </div>
                    </div>
                    <span className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/25 shrink-0">
                      Sign In Now
                    </span>
                  </div>

                  {/* Secondary: Instant Gamertag Input */}
                  <div className="p-4 rounded-2xl bg-dark-800/60 border border-white/[0.08] space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                        <User size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white">Enter Gamertag Directly</div>
                        <div className="text-[11px] text-slate-400">Type any Minecraft Bedrock gamertag to connect instantly</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={manualGamertag}
                        onChange={e => setManualGamertag(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleManualSave(); }}
                        placeholder="e.g. Steve or your Xbox Gamertag"
                        className="flex-1 bg-dark-900 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-brand-500 transition-all"
                      />
                      <button
                        onClick={handleManualSave}
                        disabled={!manualGamertag.trim() || loading}
                        className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-40 transition-all shrink-0 active:scale-95"
                      >
                        Connect
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
