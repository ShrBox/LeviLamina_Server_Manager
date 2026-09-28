import React, { useState, useEffect } from 'react';
import { 
  Blocks, 
  Coins, 
  ShoppingBag,
  Flame, 
  Download, 
  CheckCircle2, 
  Check, 
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Power,
  Trash2,
  Sparkles,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { Api } from '../services/api';
import { Server, ExtensionManifest } from '../types';
import { useI18n } from '../i18n';

interface ExtensionsProps {
  server: Server | null;
  onNavigatePage?: (page: string, payload?: any) => void;
}

export const Extensions: React.FC<ExtensionsProps> = ({ server, onNavigatePage }) => {
  const { t } = useI18n();
  const [manifests, setManifests] = useState<ExtensionManifest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await Api.getExtensionsCatalog();
      setManifests(data);
    } catch (e: any) {
      console.error("Failed to load extension catalog:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInstall = async (id: string, name: string) => {
    setActionLoadingId(id);
    try {
      await Api.installExtension(id);
      window.dispatchEvent(new CustomEvent('extensions-updated'));
      showToast(`${t('extensionEnabledSuccess', 'Extension installed and enabled:')} ${name}`);
      await loadData();
    } catch (err: any) {
      showToast(`${t('actionFailed', 'Failed to install extension:')} ${err.message}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggle = async (id: string, currentEnabled: boolean, name: string) => {
    setActionLoadingId(id);
    try {
      await Api.setExtensionEnabled(id, !currentEnabled);
      window.dispatchEvent(new CustomEvent('extensions-updated'));
      showToast(currentEnabled 
        ? `${t('extensionDisabledToast', 'Extension disabled:')} ${name}`
        : `${t('extensionEnabledToast', 'Extension enabled:')} ${name}`);
      await loadData();
    } catch (err: any) {
      showToast(`${t('actionFailed', 'Failed to update extension:')} ${err.message}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUninstall = async (id: string, name: string) => {
    setActionLoadingId(id);
    try {
      await Api.uninstallExtension(id);
      window.dispatchEvent(new CustomEvent('extensions-updated'));
      showToast(`${t('extensionUninstalledToast', 'Extension uninstalled:')} ${name}`);
      await loadData();
    } catch (err: any) {
      showToast(`${t('actionFailed', 'Failed to uninstall extension:')} ${err.message}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 w-full animate-page-enter">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 ${
          toast.type === 'success' 
            ? 'bg-dark-900 border-emerald-500/50 text-slate-100' 
            : 'bg-dark-900 border-rose-500/50 text-rose-200'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-400" />
          ) : (
            <AlertCircle size={18} className="text-rose-400" />
          )}
          <span className="text-xs font-semibold">{toast.msg}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-down">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 shadow-md">
            <Blocks size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-100 uppercase tracking-tight flex items-center gap-2">
              {t('extensionsStoreTitle', 'Extension Manager & Store')}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('extensionsStoreSubtitle', 'Install modular in-app extensions to unlock dedicated marketplace and portal tabs.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-xl bg-dark-850 border border-dark-750 flex items-center gap-2 text-xs">
            <HardDrive size={14} className="text-brand-400" />
            <span className="text-slate-400">{t('activeServer', 'Target:')}</span>
            <span className="font-bold text-white truncate max-w-[140px]">
              {server ? server.name : t('noServerSelected', 'None Selected')}
            </span>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold border border-dark-700 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            title={t('refresh', 'Refresh')}
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-brand-400" : ""} />
            <span>{t('refresh', 'Refresh')}</span>
          </button>
        </div>
      </div>

      {/* GitHub Policy / Modular Architecture Explanatory Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-dark-850 to-dark-850 border border-blue-500/30 flex items-start gap-3.5 animate-slide-down shadow-md">
        <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
          <ShieldAlert size={18} />
        </div>
        <div className="space-y-1 text-xs">
          <h3 className="font-bold text-slate-100 flex items-center gap-2">
            <span>{t('modularArchitectureTitle', 'Open Source & Compliance Notice')}</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {t('policyCompliant', 'Policy Compliant')}
            </span>
          </h3>
          <p className="text-slate-300 leading-relaxed">
            {t('modularArchitectureDesc', 'To keep the server manager clean and modular, Marketplace Addons and CurseForge are provided as decoupled, user-activated extensions. Once installed, their dedicated tabs will appear in your sidebar under CONTENT.')}
          </p>
        </div>
      </div>

      {/* Extensions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger-settle">
        {manifests.map((ext, idx) => {
          const isToolCoin = ext.id === 'toolcoin';
          const isCurseForge = ext.id === 'curseforge';
          const isBusy = actionLoadingId === ext.id;

          return (
            <div
              key={ext.id}
              className={`bg-dark-850 rounded-2xl border p-6 space-y-5 transition-all flex flex-col justify-between group shadow-lg animate-spring-pop relative overflow-hidden ${
                ext.isEnabled
                  ? isToolCoin 
                    ? 'border-amber-500/40 hover:border-amber-500/60' 
                    : 'border-orange-500/40 hover:border-orange-500/60'
                  : 'border-dark-750 hover:border-slate-600'
              }`}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {/* Background Glow */}
              <div className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl pointer-events-none transition-colors ${
                isToolCoin ? 'bg-amber-500/10' : 'bg-orange-500/10'
              }`} />

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md border ${
                      isToolCoin 
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                        : 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                    }`}>
                      {isToolCoin ? <ShoppingBag size={26} /> : <Flame size={26} />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-black text-white">
                          {ext.name}
                        </h2>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          isToolCoin
                            ? 'bg-amber-400/15 text-amber-400 border-amber-400/30'
                            : 'bg-orange-400/15 text-orange-400 border-orange-400/30'
                        }`}>
                          v{ext.version}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {t('byAuthor', 'by')} <span className="font-semibold text-slate-300">{ext.author}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {ext.isEnabled ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        {t('enabledActive', 'Active in Sidebar')}
                      </span>
                    ) : ext.isInstalled ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-dark-700">
                        {t('disabled', 'Disabled')}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-dark-900 text-slate-500 border border-dark-750">
                        {t('notInstalled', 'Available to Install')}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {ext.description}
                </p>

                {ext.tags && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {ext.tags.map((tag, tIdx) => (
                      <span key={tIdx} className="text-[10px] px-2 py-0.5 rounded-md bg-dark-900 border border-dark-750 text-slate-400 font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-dark-750/80 flex items-center gap-2.5 flex-wrap">
                {ext.isEnabled ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onNavigatePage && onNavigatePage(ext.id)}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer ${
                        isToolCoin
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                          : 'bg-orange-500 hover:bg-orange-600 text-slate-950 shadow-orange-500/20'
                      }`}
                    >
                      <span>{isToolCoin ? t('openMarketplaceTab', 'Open Marketplace Tab') : t('openCurseForgeTab', 'Open CurseForge Tab')}</span>
                      <ArrowRight size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggle(ext.id, ext.isEnabled, ext.name)}
                      disabled={isBusy}
                      className="p-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-400 hover:text-slate-200 border border-dark-700 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                      title={t('disableExtension', 'Disable Extension')}
                    >
                      <Power size={15} />
                    </button>
                  </>
                ) : ext.isInstalled ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleToggle(ext.id, ext.isEnabled, ext.name)}
                      disabled={isBusy}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {isBusy ? <RefreshCw size={14} className="animate-spin" /> : <Power size={14} />}
                      <span>{t('enableExtension', 'Enable Extension & Show Tab')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUninstall(ext.id, ext.name)}
                      disabled={isBusy}
                      className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                      title={t('uninstallExtension', 'Uninstall Extension')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleInstall(ext.id, ext.name)}
                    disabled={isBusy}
                    className={`w-full py-2.5 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer disabled:opacity-50 ${
                      isToolCoin
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                        : 'bg-orange-500 hover:bg-orange-600 text-slate-950 shadow-orange-500/20'
                    }`}
                  >
                    {isBusy ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                    <span>{t('installAndEnableExtension', 'Download & Enable Extension')}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Extensions;
