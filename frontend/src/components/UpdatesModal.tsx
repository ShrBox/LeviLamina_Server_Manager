import React, { useState } from 'react';
import { 
  Sparkles, 
  RotateCw, 
  CheckCircle2, 
  Download, 
  Package, 
  Zap, 
  X, 
  ArrowRight,
  Layers
} from 'lucide-react';
import { UpdateCheckReport, ComponentUpdate, Server } from '../types';
import { Api } from '../services/api';
import { showDialog } from './ModalAlert';
import { useI18n } from '../i18n';

interface UpdatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: UpdateCheckReport | null;
  server: Server | null;
  onRefresh: () => Promise<void>;
  onUpdateCompleted?: () => void;
}

export const UpdatesModal: React.FC<UpdatesModalProps> = ({
  isOpen,
  onClose,
  report,
  server,
  onRefresh,
  onUpdateCompleted
}) => {
  const { t } = useI18n();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatingAll, setUpdatingAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleApplyUpdate = async (item: ComponentUpdate) => {
    if (!server) {
      showDialog({
        title: t('info', 'Info'),
        message: t('pleaseSelectServer', 'Please select a server to manage configurations.'),
        type: "info",
      });
      return;
    }

    setUpdatingId(item.id);
    try {
      const res = await Api.applyComponentUpdate(server.id, item.type, item.tooth || item.id, item.latestVersion);
      if (res && (res.success || (res.stdout && res.stdout.includes("installed")))) {
        showDialog({
          title: t('success', 'Success'),
          message: `${t('updateInstalledSuccess', 'Successfully updated')} ${item.name} v${item.latestVersion}!`,
          type: "success",
        });
        await onRefresh();
        onUpdateCompleted?.();
      } else {
        showDialog({
          title: t('failed', 'Failed'),
          message: res?.error || res?.stderr || t('failed', 'Failed to complete update.'),
          type: "error",
        });
      }
    } catch (err: any) {
      showDialog({
        title: t('error', 'Error'),
        message: err.message || t('error', 'An unexpected error occurred during update.'),
        type: "error",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateAll = async () => {
    if (!server || !report) return;
    setUpdatingAll(true);

    const candidates = [
      ...(report.loaderVersion.hasUpdate ? [report.loaderVersion] : []),
      ...(report.lipVersion.hasUpdate ? [report.lipVersion] : []),
      ...report.modUpdates.filter(m => m.hasUpdate && m.isCompatible),
    ];

    if (candidates.length === 0) {
      setUpdatingAll(false);
      return;
    }

    let successCount = 0;
    for (const item of candidates) {
      setUpdatingId(item.id);
      try {
        const res = await Api.applyComponentUpdate(server.id, item.type, item.tooth || item.id, item.latestVersion);
        if (res && (res.success || (res.stdout && res.stdout.includes("installed")))) {
          successCount++;
        }
      } catch (err) {
        console.error(`Failed updating ${item.name}:`, err);
      }
    }

    setUpdatingId(null);
    setUpdatingAll(false);

    showDialog({
      title: t('success', 'Success'),
      message: `${t('updateInstalledSuccess', 'Successfully updated')} ${successCount} / ${candidates.length}`,
      type: successCount === candidates.length ? "success" : "warning",
    });

    await onRefresh();
    onUpdateCompleted?.();
  };

  const hasUpdates = (report?.totalUpdatesCount || 0) > 0;
  const modUpdatesAvailable = (report?.modUpdates || []).filter(m => m.hasUpdate);

  return (
    <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-sm z-[100000] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="launcher-card bg-dark-900 border border-dark-750/80 rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        
        {/* Modal Top Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-dark-750 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center shrink-0 text-brand-400 shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-100 font-sans">
                  {t('updatesModalTitle', 'Component Updates')}
                </h3>
                {hasUpdates ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                    {report?.totalUpdatesCount} {t('updatesAvailable', 'Updates Available')}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {t('upToDate', 'Up to Date')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('updatesModalSubtitle', 'Keep your server core, loader, package manager, and mods up to date.')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-dark-800 transition-colors"
            title={t('close', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1 select-none">
          
          {/* Status Header Banner */}
          {hasUpdates ? (
            <div className="p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5 text-xs text-slate-200 font-medium">
                <Download size={16} className="text-brand-400 shrink-0" />
                <span>
                  <strong>{report?.totalUpdatesCount}</strong> {t('updatesAvailable', 'Updates Available')}
                </span>
              </div>
              <button
                type="button"
                onClick={handleUpdateAll}
                disabled={updatingAll || updatingId !== null}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-emerald-500 hover:from-brand-400 hover:to-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-brand-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
              >
                {updatingAll ? (
                  <>
                    <RotateCw size={13} className="animate-spin" /> {t('updatingAll', 'Updating All...')}
                  </>
                ) : (
                  <>
                    <Sparkles size={13} /> {t('updateAll', 'Update All')}
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>
                {t('allUpToDateDesc', 'All components, loader, and mods are running on the latest verified versions.')}
              </span>
            </div>
          )}

          {/* Section 1: Core LeviLamina Loader & BDS Server */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={13} className="text-brand-400" />
              <span>{t('coreComponents', 'Core Components')}</span>
            </h4>

            {report && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* LeviLamina Loader Card */}
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                  report.loaderVersion.hasUpdate 
                    ? 'bg-amber-500/[0.04] border-amber-500/30' 
                    : 'bg-dark-850 border-dark-750'
                }`}>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-xs text-slate-100 font-sans">
                        {report.loaderVersion.name}
                      </span>
                      {report.loaderVersion.hasUpdate ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          {t('updateAvailable', 'Update Available')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {t('upToDate', 'Up to Date')}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                      {report.loaderVersion.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-dark-750/70 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="text-slate-400">v{report.loaderVersion.currentVersion}</span>
                      {report.loaderVersion.hasUpdate && (
                        <>
                          <ArrowRight size={11} className="text-slate-500" />
                          <span className="text-brand-400 font-bold">v{report.loaderVersion.latestVersion}</span>
                        </>
                      )}
                    </div>

                    {report.loaderVersion.hasUpdate && (
                      <button
                        type="button"
                        onClick={() => handleApplyUpdate(report.loaderVersion)}
                        disabled={updatingId !== null || updatingAll}
                        className="px-3 py-1 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-[11px] transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        {updatingId === report.loaderVersion.id ? t('loading', 'Loading...') : t('update', 'Update')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Minecraft BDS Server Card */}
                <div className="p-3.5 rounded-xl bg-dark-850 border border-dark-750 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-xs text-slate-100 font-sans">
                        {report.serverVersion.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {t('ready', 'Ready')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                      {report.serverVersion.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-dark-750/70 flex items-center justify-between">
                    <div className="text-xs font-mono text-slate-300">
                      BDS {report.serverVersion.currentVersion.startsWith('v') || report.serverVersion.currentVersion.startsWith('BDS') ? report.serverVersion.currentVersion : `v${report.serverVersion.currentVersion}`}
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Managed by LeviLamina
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Installed Mods & Plugins */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Package size={13} className="text-brand-400" />
                <span>{t('modUpdates', 'Installed Mods & Plugins')}</span>
                <span className="text-slate-500 font-mono font-normal">({report?.modUpdates.length || 0})</span>
              </h4>
              {modUpdatesAvailable.length > 0 && (
                <span className="text-[11px] text-amber-400 font-medium">
                  {modUpdatesAvailable.length} {t('updatesAvailable', 'Updates Available')}
                </span>
              )}
            </div>

            {report && report.modUpdates.length === 0 ? (
              <div className="p-4 rounded-xl bg-dark-850/60 border border-dark-750 text-center text-xs text-slate-400">
                {t('noModsInstalled', 'No mods or plugins installed on this server yet.')}
              </div>
            ) : (
              <div className="space-y-2">
                {report?.modUpdates.map((mod) => (
                  <div 
                    key={mod.id} 
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                      mod.hasUpdate 
                        ? 'bg-amber-500/[0.04] border-amber-500/30' 
                        : 'bg-dark-850 border-dark-750'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-100 truncate">
                          {mod.name}
                        </span>
                        {mod.hasUpdate ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                            {t('updateAvailable', 'Update Available')}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-white/[0.05] text-slate-400 shrink-0">
                            {t('upToDate', 'Up to Date')}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                        <span>{t('currentVersion', 'Current')}: v{mod.currentVersion || "1.0.0"}</span>
                        {mod.hasUpdate && (
                          <>
                            <ArrowRight size={10} className="text-slate-500" />
                            <span className="text-emerald-400 font-bold">{t('latestVersion', 'Latest')}: v{mod.latestVersion}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {mod.hasUpdate && (
                      <button
                        type="button"
                        onClick={() => handleApplyUpdate(mod)}
                        disabled={updatingId !== null || updatingAll}
                        className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50 shrink-0 flex items-center gap-1"
                      >
                        {updatingId === mod.id ? (
                          <>
                            <RotateCw size={11} className="animate-spin" /> {t('loading', 'Loading...')}
                          </>
                        ) : (
                          <>
                            <Download size={11} /> {t('update', 'Update')}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Package Manager Tool (LIP CLI) */}
          {report && (
            <div className="space-y-2 pt-1">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={13} className="text-brand-400" />
                <span>{t('lipTool', 'LIP Package Manager')}</span>
              </h4>

              <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                report.lipVersion.hasUpdate
                  ? 'bg-amber-500/[0.04] border-amber-500/30'
                  : 'bg-dark-850 border-dark-750'
              }`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-100 font-sans">
                      {report.lipVersion.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      v{report.lipVersion.currentVersion}
                    </span>
                    {report.lipVersion.hasUpdate ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        {t('updateAvailable', 'Update Available')}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {t('upToDate', 'Up to Date')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {report.lipVersion.description}
                  </p>
                </div>

                {report.lipVersion.hasUpdate && (
                  <button
                    type="button"
                    onClick={() => handleApplyUpdate(report.lipVersion)}
                    disabled={updatingId !== null || updatingAll}
                    className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50 shrink-0 flex items-center gap-1"
                  >
                    {updatingId === report.lipVersion.id ? (
                      <>
                        <RotateCw size={11} className="animate-spin" /> {t('loading', 'Loading...')}
                      </>
                    ) : (
                      <>
                        <Download size={11} /> {t('update', 'Update')}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-dark-750 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || updatingAll || updatingId !== null}
            className="px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 hover:text-slate-100 text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
          >
            <RotateCw size={13} className={refreshing ? "animate-spin text-brand-400" : ""} />
            <span>{refreshing ? t('checking', 'Checking for updates...') : t('checkUpdates', 'Check for Updates')}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold transition-colors active:scale-95"
          >
            {t('close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
