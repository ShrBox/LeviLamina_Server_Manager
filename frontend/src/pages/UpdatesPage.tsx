import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  DownloadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Cpu, 
  Server as ServerIcon, 
  Terminal, 
  Package, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Flame,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Api } from '../services/api';
import { Server, UpdateCheckReport, ComponentUpdate, MarketplaceUpdateReport, CurseForgeUpdateReport } from '../types';
import { useI18n } from '../i18n';

interface UpdatesPageProps {
  server: Server | null;
  servers: Server[];
  onSelectServer: (server: Server) => void;
  onNavigatePage: (page: string) => void;
}

export const UpdatesPage: React.FC<UpdatesPageProps> = ({
  server,
  servers,
  onSelectServer,
  onNavigatePage
}) => {
  const { t } = useI18n();
  const [report, setReport] = useState<UpdateCheckReport | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [updatingComponents, setUpdatingComponents] = useState<{ [id: string]: boolean }>({});
  const [expandedNotes, setExpandedNotes] = useState<{ [id: string]: boolean }>({});
  const [bedrinthCount, setBedrinthCount] = useState<number | null>(null);
  const [isSyncingBedrinth, setIsSyncingBedrinth] = useState(false);
  const [marketplaceReport, setMarketplaceReport] = useState<MarketplaceUpdateReport | null>(null);
  const [curseforgeReport, setCurseforgeReport] = useState<CurseForgeUpdateReport | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCheckAll = async () => {
    setIsChecking(true);
    try {
      const rep = await Api.checkAllUpdates(server?.id);
      setReport(rep);
      
      // Also fetch extension update status
      const [mRep, cRep] = await Promise.allSettled([
        Api.checkMarketplaceUpdates(),
        Api.checkCurseForgeUpdates()
      ]);
      if (mRep.status === 'fulfilled') setMarketplaceReport(mRep.value);
      if (cRep.status === 'fulfilled') setCurseforgeReport(cRep.value);

      if (rep && rep.hasUpdates) {
        showToast(t('updatesFoundNotice', `Discovered ${rep.totalUpdatesCount} component update(s) available upstream!`), 'info');
      } else {
        showToast(t('allComponentsUpToDate', 'All components and mod indices are completely up to date!'), 'success');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to check updates', 'error');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    handleCheckAll();
  }, [server?.id]);

  const handleApplyUpdate = async (item: ComponentUpdate) => {
    if (!server) {
      showToast(t('selectServerFirst', 'Please select an active server first'), 'error');
      return;
    }

    const key = item.id;
    setUpdatingComponents(prev => ({ ...prev, [key]: true }));
    try {
      await Api.applyComponentUpdate(server.id, item.type, item.tooth || item.id, item.latestVersion);
      showToast(t('updateSuccess', `Successfully updated ${item.name} to ${item.latestVersion}!`), 'success');
      // Re-check
      await handleCheckAll();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || `Failed to update ${item.name}`, 'error');
    } finally {
      setUpdatingComponents(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleSyncBedrinth = async () => {
    setIsSyncingBedrinth(true);
    try {
      const count = await Api.syncBedrinthCatalog();
      setBedrinthCount(count);
      showToast(t('bedrinthSynced', `Bedrinth catalog synced! ${count} mod packages indexed.`), 'success');
      await handleCheckAll();
    } catch (err: any) {
      showToast(err.message || 'Failed to sync Bedrinth catalog', 'error');
    } finally {
      setIsSyncingBedrinth(false);
    }
  };

  const toggleNotes = (id: string) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="h-full w-full flex flex-col bg-dark-950 text-slate-100 overflow-y-auto px-6 py-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-6 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 backdrop-blur-md transition-all ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300' 
            : toastMessage.type === 'error'
            ? 'bg-rose-950/90 border-rose-500/40 text-rose-300'
            : 'bg-brand-950/90 border-brand-500/40 text-brand-300'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-brand-600/30 to-brand-400/20 border border-brand-500/30 text-brand-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {t('dynamicUpdatesCenter', 'Dynamic Updates Center')}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
              Live Upstream Sync
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            {t('updatesHeroDesc', 'Instantly detects and installs live upstream releases for LeviLamina Loader, Minecraft BDS, LIP CLI, Bedrinth Mods, and Extensions dynamically without updating the app itself.')}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {servers.length > 1 && (
            <select
              value={server?.id || ''}
              onChange={(e) => {
                const s = servers.find(x => x.id === e.target.value);
                if (s) onSelectServer(s);
              }}
              className="px-3 py-2 text-xs rounded-xl bg-dark-900 border border-dark-750 text-slate-200 focus:outline-none focus:border-brand-500"
            >
              {servers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.minecraftVersion || 'BDS'})</option>
              ))}
            </select>
          )}

          <button
            onClick={handleCheckAll}
            disabled={isChecking}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-medium text-xs shadow-lg shadow-brand-500/20 disabled:opacity-50 transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? t('checkingUpdates', 'Checking Upstream...') : t('checkAllUpdates', 'Check Updates Now')}
          </button>
        </div>
      </div>

      {/* Global Status Banner */}
      {report && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
          report.hasUpdates 
            ? 'bg-amber-950/20 border-amber-500/30 text-amber-200' 
            : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              report.hasUpdates 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              {report.hasUpdates ? <AlertCircle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                {report.hasUpdates 
                  ? t('updatesAvailableTitle', `${report.totalUpdatesCount} Upstream Update(s) Available`)
                  : t('systemUpToDateTitle', 'All Core Systems & Mods are Up to Date')
                }
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('lastCheckedAt', 'Last scanned')}: {new Date(report.checkedAt).toLocaleTimeString()}
                {report.serverName && ` • Target Server: ${report.serverName}`}
              </p>
            </div>
          </div>

          <button
            onClick={handleSyncBedrinth}
            disabled={isSyncingBedrinth}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-900/80 border border-white/10 hover:border-brand-500/40 text-slate-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-400 ${isSyncingBedrinth ? 'animate-pulse' : ''}`} />
            {isSyncingBedrinth ? t('syncingIndex', 'Syncing Index...') : t('syncBedrinthIndex', 'Sync Bedrinth Index')}
          </button>
        </div>
      )}

      {/* Grid of Core Engine Components */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* LeviLamina Loader Card */}
        {report?.loaderVersion && (
          <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
            report.loaderVersion.hasUpdate 
              ? 'bg-gradient-to-b from-dark-900 to-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/5' 
              : 'bg-dark-900/80 border-dark-750 hover:border-dark-700'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-white">LeviLamina Loader</h3>
                    <p className="text-[10px] text-slate-400">GitHub LiteLDev / Live API</p>
                  </div>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  report.loaderVersion.hasUpdate 
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' 
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                }`}>
                  {report.loaderVersion.hasUpdate ? `Update: v${report.loaderVersion.latestVersion}` : 'Up to Date'}
                </span>
              </div>

              <div className="space-y-1.5 my-3 text-xs bg-dark-950/60 p-3 rounded-xl border border-white/[0.04]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Installed Version:</span>
                  <span className="font-mono text-slate-200">{report.loaderVersion.currentVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Latest Upstream:</span>
                  <span className="font-mono text-brand-300 font-semibold">{report.loaderVersion.latestVersion}</span>
                </div>
              </div>

              {report.loaderVersion.releaseNotes && (
                <div className="mt-2">
                  <button
                    onClick={() => toggleNotes('loader')}
                    className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    {expandedNotes['loader'] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {expandedNotes['loader'] ? 'Hide Release Notes' : 'View Release Notes'}
                  </button>
                  {expandedNotes['loader'] && (
                    <div className="mt-2 p-2.5 bg-dark-950 rounded-lg border border-dark-750 text-[11px] text-slate-300 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {report.loaderVersion.releaseNotes}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => handleApplyUpdate(report.loaderVersion)}
              disabled={!report.loaderVersion.hasUpdate || updatingComponents[report.loaderVersion.id]}
              className={`w-full mt-4 py-2 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all ${
                report.loaderVersion.hasUpdate
                  ? 'bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/25 cursor-pointer active:scale-98'
                  : 'bg-dark-800 text-slate-500 cursor-not-allowed border border-white/[0.04]'
              }`}
            >
              <DownloadCloud className={`w-4 h-4 ${updatingComponents[report.loaderVersion.id] ? 'animate-bounce' : ''}`} />
              {updatingComponents[report.loaderVersion.id] ? 'Installing Loader...' : report.loaderVersion.hasUpdate ? 'Update LeviLamina Loader' : 'Loader is Latest'}
            </button>
          </div>
        )}

        {/* Minecraft BDS Card */}
        {report?.serverVersion && (
          <div className="p-5 rounded-2xl border bg-dark-900/80 border-dark-750 hover:border-dark-700 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <ServerIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-white">Minecraft BDS</h3>
                    <p className="text-[10px] text-slate-400">Official Mojang Engine</p>
                  </div>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  report.serverVersion.hasUpdate 
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' 
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                }`}>
                  {report.serverVersion.hasUpdate ? `Mojang Release: ${report.serverVersion.latestVersion}` : 'Synced with BDS'}
                </span>
              </div>

              <div className="space-y-1.5 my-3 text-xs bg-dark-950/60 p-3 rounded-xl border border-white/[0.04]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Server BDS:</span>
                  <span className="font-mono text-slate-200">{report.serverVersion.currentVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Official Mojang Stable:</span>
                  <span className="font-mono text-emerald-300 font-semibold">{report.serverVersion.latestVersion}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Mojang releases are tracked real-time. BDS updates deploy safely while preserving your existing worlds and server.properties.
              </p>
            </div>

            <button
              onClick={() => handleApplyUpdate(report.serverVersion)}
              disabled={!report.serverVersion.hasUpdate || updatingComponents[report.serverVersion.id]}
              className={`w-full mt-4 py-2 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all ${
                report.serverVersion.hasUpdate
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 cursor-pointer'
                  : 'bg-dark-800 text-slate-500 cursor-not-allowed border border-white/[0.04]'
              }`}
            >
              <DownloadCloud className="w-4 h-4" />
              {report.serverVersion.hasUpdate ? 'Upgrade Server BDS' : 'BDS Up to Date'}
            </button>
          </div>
        )}

        {/* LIP Package Manager CLI Card */}
        {report?.lipVersion && (
          <div className="p-5 rounded-2xl border bg-dark-900/80 border-dark-750 hover:border-dark-700 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-white">LIP CLI Tool</h3>
                    <p className="text-[10px] text-slate-400">Tooth Package Manager</p>
                  </div>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  report.lipVersion.hasUpdate 
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' 
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                }`}>
                  {report.lipVersion.hasUpdate ? `v${report.lipVersion.latestVersion}` : 'Up to Date'}
                </span>
              </div>

              <div className="space-y-1.5 my-3 text-xs bg-dark-950/60 p-3 rounded-xl border border-white/[0.04]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Installed CLI:</span>
                  <span className="font-mono text-slate-200">{report.lipVersion.currentVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Latest Release:</span>
                  <span className="font-mono text-purple-300 font-semibold">{report.lipVersion.latestVersion}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Manages Tooth package installations, automated dependency solving, and mod loader hooks.
              </p>
            </div>

            <button
              onClick={() => handleApplyUpdate(report.lipVersion)}
              disabled={!report.lipVersion.hasUpdate || updatingComponents[report.lipVersion.id]}
              className={`w-full mt-4 py-2 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all ${
                report.lipVersion.hasUpdate
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/25 cursor-pointer'
                  : 'bg-dark-800 text-slate-500 cursor-not-allowed border border-white/[0.04]'
              }`}
            >
              <DownloadCloud className="w-4 h-4" />
              {report.lipVersion.hasUpdate ? 'Update LIP CLI' : 'LIP is Latest'}
            </button>
          </div>
        )}
      </div>

      {/* Installed Server Mods & Addons Updates */}
      <div className="p-5 rounded-2xl bg-dark-900 border border-dark-750">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Installed Server Mods Updates</h2>
              <p className="text-xs text-slate-400">
                {server ? `Installed on ${server.name}` : 'Select a server to view installed mod updates'}
              </p>
            </div>
          </div>

          {report?.modUpdates && report.modUpdates.filter(m => m.hasUpdate).length > 0 && (
            <button
              onClick={async () => {
                if (!server || !report) return;
                for (const m of report.modUpdates.filter(x => x.hasUpdate)) {
                  await handleApplyUpdate(m);
                }
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-white text-xs font-medium shadow-md shadow-brand-500/20 transition-all cursor-pointer"
            >
              <DownloadCloud className="w-4 h-4" />
              Update All Available Mods
            </button>
          )}
        </div>

        {(!report?.modUpdates || report.modUpdates.length === 0) ? (
          <div className="py-10 text-center text-slate-500 text-xs">
            No installed Bedrinth mods detected on this server, or all installed mods are already at their latest versions.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04] mt-2">
            {report.modUpdates.map((mod) => (
              <div key={mod.id} className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-dark-950 border border-dark-750 flex items-center justify-center text-brand-400 font-bold text-xs">
                    {mod.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{mod.name}</h4>
                    <p className="text-xs text-slate-400 max-w-md truncate">{mod.description || mod.tooth}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right text-xs">
                    <span className="text-slate-400">Current: </span>
                    <span className="font-mono text-slate-200">{mod.currentVersion || '1.0'}</span>
                    <span className="mx-2 text-slate-600">→</span>
                    <span className="text-slate-400">Latest: </span>
                    <span className={`font-mono font-semibold ${mod.hasUpdate ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {mod.latestVersion}
                    </span>
                  </div>

                  <button
                    onClick={() => handleApplyUpdate(mod)}
                    disabled={!mod.hasUpdate || updatingComponents[mod.id]}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                      mod.hasUpdate
                        ? 'bg-brand-500 hover:bg-brand-400 text-white shadow cursor-pointer'
                        : 'bg-dark-800 text-slate-500 border border-white/[0.04] cursor-not-allowed'
                    }`}
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    {updatingComponents[mod.id] ? 'Updating...' : mod.hasUpdate ? 'Update' : 'Up to Date'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
