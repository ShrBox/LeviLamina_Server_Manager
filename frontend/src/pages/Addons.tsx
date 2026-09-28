/**
 * @file Addons.tsx
 * @description Comprehensive Bedrock Add-On management view supporting drag-and-drop installation,
 * archive validation, world pack binding, toggling, and export.
 *
 * Core Capabilities:
 * - Drag-and-drop .mcpack/.mcaddon archive ingestion.
 * - Pre-installation manifest analyzer validating format versions and UUIDs.
 * - Atomic binding of behavior/resource packs to specific world save directories.
 * - Export and re-packaging of installed addons.
 */

import React, { useState, useEffect } from 'react';
import { 
  Package, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Layers, 
  FileCode, 
  Globe, 
  Trash2, 
  RotateCw,
  Info,
  Archive,
  FolderOpen,
  Check,
  X,
  Download,
  Power
} from 'lucide-react';
import { Api } from '../services/api';
import { Addon, AddonAnalysisResult, Server, World } from '../types';
import { CustomSelect } from '../components/CustomSelect';
import { useI18n } from '../i18n';

interface AddonsProps {
  server: Server | null;
  worlds: World[];
  onRefreshWorlds: () => void;
  initialArchivePath?: string | null;
}

export const Addons: React.FC<AddonsProps> = ({ server, worlds, onRefreshWorlds, initialArchivePath }) => {
  const { t } = useI18n();
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AddonAnalysisResult | null>(null);
  const [currentArchivePath, setCurrentArchivePath] = useState<string>('');

  // Install Wizard options
  const [targetWorld, setTargetWorld] = useState<string>('');
  const [enableBP, setEnableBP] = useState(true);
  const [enableRP, setEnableRP] = useState(true);
  const [markRequired, setMarkRequired] = useState(false);
  const [createBackup, setCreateBackup] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Complete Add-On Manager state: Delete, Export, per-world toggling, and toasts
  const [deleteModalAddon, setDeleteModalAddon] = useState<Addon | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [togglingWorld, setTogglingWorld] = useState<{ addonId: string; worldName: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error'; path?: string } | null>(null);

  const isServerRunning = server?.status === 'ONLINE' || server?.status === 'STARTING';

  useEffect(() => {
    if (initialArchivePath) {
      processArchive(initialArchivePath);
    }
  }, [initialArchivePath]);

  useEffect(() => {
    const runtime = (window as any).runtime;
    if (runtime?.OnFileDrop) {
      runtime.OnFileDrop((_x: number, _y: number, paths: string[]) => {
        if (paths && paths.length > 0) {
          processArchive(paths[0]);
        }
      }, false);
      return () => {
        if (runtime.OnFileDropOff) {
          runtime.OnFileDropOff();
        }
      };
    } else if (runtime?.EventsOn) {
      runtime.EventsOn('wails:file-drop', (_x: number, _y: number, paths: string[]) => {
        if (paths && paths.length > 0) {
          processArchive(paths[0]);
        }
      });
      return () => {
        runtime.EventsOff('wails:file-drop');
      };
    }
  }, [isServerRunning]);

  useEffect(() => {
    if (server) {
      loadAddons();
      if (worlds.length > 0 && !targetWorld) {
        setTargetWorld(server.activeWorld || worlds[0].folder || worlds[0].name);
      }
    }
  }, [server, worlds]);

  const loadAddons = async () => {
    if (!server) return;
    setLoading(true);
    try {
      const list = await Api.listAddons(server.id);
      setAddons(list);
    } catch (err) {
      console.error("Failed to load addons:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = async () => {
    if (isServerRunning) {
      alert(t('addons.cannotInstallRunning', 'Cannot install Add-Ons while the server is running. Please stop the server first to protect world and pack files.'));
      return;
    }
    try {
      const path = await Api.selectFile(
        t('addons.selectArchive', 'Select Bedrock Add-On Archive'),
        t('addons.archiveType', 'Bedrock Add-Ons (*.mcaddon, *.mcpack, *.zip)'),
        "*.mcaddon;*.mcpack;*.zip"
      );
      if (path) {
        processArchive(path);
      }
    } catch (err: any) {
      alert(t('failed', 'Failed to open file: ') + err.message);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    if (isServerRunning) {
      alert(t('addons.cannotInstallRunning', 'Cannot install Add-Ons while the server is running. Please stop the server first to protect world and pack files.'));
      return;
    }

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const filePath = (files[0] as any).path;
      if (filePath) {
        processArchive(filePath);
      } else {
        alert(t('orClickToBrowse', 'Please click Browse to select local files on your machine.'));
      }
    }
  };

  const processArchive = async (archivePath: string) => {
    if (isServerRunning) {
      alert(t('addons.cannotInstallRunning', 'Cannot install Add-Ons while the server is running. Please stop the server first.'));
      return;
    }
    setAnalyzing(true);
    setInstallMessage(null);
    setCurrentArchivePath(archivePath);

    try {
      const result = await Api.analyzeAddon(archivePath);
      setAnalysisResult(result);
    } catch (err: any) {
      alert((t('error', 'Error analyzing archive') + ": ") + err.message);
      setAnalysisResult(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExecuteInstall = async () => {
    if (!server || !currentArchivePath) return;
    if (isServerRunning) {
      alert(t('addons.cannotInstallRunning', 'Cannot install Add-Ons while the server is running. Please stop the server first.'));
      return;
    }
    setInstalling(true);
    setInstallMessage(null);

    try {
      const res = await Api.installAddon(server.id, currentArchivePath, {
        enableBehavior: enableBP,
        enableResource: enableRP,
        targetWorld: targetWorld,
        createBackup: createBackup,
      });

      setInstallMessage({
        success: true,
        text: res.message || t('addonInstalledSuccess', 'Add-on successfully installed and registered to world!')
      });
      setAnalysisResult(null);
      setCurrentArchivePath('');
      loadAddons();
      onRefreshWorlds();
    } catch (err: any) {
      setInstallMessage({
        success: false,
        text: err.message || t('failed', 'Installation failed and changes were rolled back.')
      });
    } finally {
      setInstalling(false);
    }
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success', path?: string) => {
    setToast({ msg, type, path });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  const handleExportAddon = async (addon: Addon) => {
    if (!server) return;
    setExportingId(addon.id);
    try {
      const outPath = await Api.exportAddon(server.id, addon.uuid);
      if (outPath) {
        showToast(t('addonExported', 'Add-On exported to: {path}').replace('{path}', outPath), 'success', outPath);
      } else {
        showToast(t('actionFailed', 'Export failed'), 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Export failed', 'error');
    } finally {
      setExportingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!server || !deleteModalAddon) return;
    if (isServerRunning) {
      alert(t('addons.cannotModifyRunning', 'Cannot delete Add-Ons while the server is running. Please stop the server first.'));
      return;
    }
    setDeleting(true);
    try {
      await Api.uninstallAddon(server.id, deleteModalAddon.uuid);
      showToast(t('addonDeletedSuccess', 'Add-On successfully deleted from server.'), 'success');
      setDeleteModalAddon(null);
      await loadAddons();
      onRefreshWorlds();
    } catch (e: any) {
      showToast(e.message || 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleWorldAssignment = async (addon: Addon, worldName: string) => {
    if (!server) return;
    if (isServerRunning) {
      alert(t('addons.cannotModifyRunning', 'Cannot modify world pack bindings while the server is running. Please stop the server first to avoid file lock issues.'));
      return;
    }
    const isAssigned = (addon.assignedWorlds || []).some(w => w.toLowerCase() === worldName.toLowerCase());
    setTogglingWorld({ addonId: addon.id, worldName });
    try {
      await Api.toggleAddonForWorld(server.id, worldName, addon.uuid, !isAssigned);
      if (isAssigned) {
        showToast(t('addonDeactivated', '"{name}" deactivated from world {world}').replace('{name}', addon.name).replace('{world}', worldName), 'success');
      } else {
        showToast(t('addonActivated', '"{name}" activated for world {world}').replace('{name}', addon.name).replace('{world}', worldName), 'success');
      }
      await loadAddons();
      onRefreshWorlds();
    } catch (err: any) {
      showToast(t('failed', 'Failed to update world assignment: ') + err.message, 'error');
    } finally {
      setTogglingWorld(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 stagger-settle">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${
          toast.type === 'success'
            ? 'bg-emerald-950/95 border-emerald-600/80 text-emerald-200 shadow-emerald-950/50'
            : 'bg-rose-950/95 border-rose-600/80 text-rose-200 shadow-rose-950/50'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-400 shrink-0" /> : <AlertTriangle size={18} className="text-rose-400 shrink-0" />}
          <div className="text-xs font-semibold max-w-sm truncate">{toast.msg}</div>
          {toast.path && (
            <button
              type="button"
              onClick={() => Api.openFolder(toast.path!)}
              className="text-[11px] underline font-bold text-white hover:text-emerald-300 cursor-pointer ml-1"
            >
              {t('openInFolder', 'Open Folder')}
            </button>
          )}
          <button type="button" onClick={() => setToast(null)} className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer ml-auto">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Delete Add-On Confirmation Modal */}
      {deleteModalAddon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-dark-900 border border-dark-750 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-scale-up">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">{t('deleteAddonTitle', 'Delete Add-On?')}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{deleteModalAddon.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-rose-500/5 p-3.5 rounded-xl border border-rose-500/15">
              {t('deleteAddonWarning', 'This will permanently remove the add-on files from your server and unbind it from all worlds. This action cannot be undone.')}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteModalAddon(null)}
                className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold transition-all border border-dark-700 cursor-pointer"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-rose-600/30 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {deleting ? <RotateCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{deleting ? t('deleting', 'Deleting...') : t('confirmPermanentlyDelete', 'Permanently Delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="animate-slide-left">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">
              {t('addonManagerTitle', 'Bedrock Add-On Manager')}
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('addonManagerSubtitle', 'Automated deep inspection, safe registration, world assignment, and transactional rollback.')}
          </p>
        </div>

        <div className="flex items-center gap-2 animate-slide-right">
          <button
            onClick={loadAddons}
            disabled={loading}
            className="p-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700 transition-all"
            title={t('refresh', 'Refresh list')}
          >
            <RotateCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={handleSelectFile}
            disabled={isServerRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all shadow-md ${
              isServerRunning
                ? "bg-dark-700 text-slate-500 cursor-not-allowed border border-dark-600"
                : "bg-brand-500 hover:bg-brand-600 text-slate-950 shadow-brand-500/20 active:scale-95"
            }`}
          >
            <UploadCloud size={16} /> {t('import', 'Import Add-On File')}
          </button>
        </div>
      </div>

      {/* Server Running Protection Warning Banner */}
      {isServerRunning && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3.5 text-amber-200 animate-in fade-in duration-300">
          <AlertTriangle size={22} className="shrink-0 text-amber-400" />
          <div className="flex-1 text-xs">
            <div className="font-bold text-sm text-amber-300">
              {t('addons.lockedTitle', 'Add-On Operations Locked (Server is Running)')}
            </div>
            <div className="text-slate-300 mt-0.5">
              {t('addons.lockedDesc', 'The Bedrock Dedicated Server is currently online. To protect world levels against file lock collisions and corruption, importing new Add-Ons and toggling world pack bindings are locked. Please stop the server before modifying Add-Ons.')}
            </div>
          </div>
        </div>
      )}

      {/* Notification Banner if install completed or failed */}
      {installMessage && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
          installMessage.success 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            : "bg-rose-500/10 border-rose-500/30 text-rose-300"
        }`}>
          {installMessage.success ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <XCircle size={18} className="mt-0.5 shrink-0" />}
          <div className="flex-1 text-xs">
            <div className="font-bold">{installMessage.success ? t('success', 'INSTALLATION SUCCESSFUL') : t('failed', 'INSTALLATION FAILED')}</div>
            <div>{installMessage.text}</div>
          </div>
          <button onClick={() => setInstallMessage(null)} className="p-1 opacity-70 hover:opacity-100 rounded hover:bg-white/10 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Drag & Drop Hero Zone */}
      <div
        style={{ ['--wails-drop-target' as any]: 'drop' }}
        onDragOver={(e) => { if (!isServerRunning) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={handleSelectFile}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          isServerRunning 
            ? "border-dark-750 bg-dark-900/40 opacity-60 cursor-not-allowed"
            : dragOver 
              ? "border-brand-500 bg-brand-500/10 scale-[1.01] cursor-pointer" 
              : "border-dark-700 bg-dark-900/50 hover:border-dark-600 hover:bg-dark-850 cursor-pointer"
        }`}
      >
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mx-auto mb-3 shadow-inner ${
          isServerRunning 
            ? "bg-dark-800 border-dark-700 text-slate-500" 
            : "bg-dark-800 border-dark-700 text-brand-500"
        }`}>
          <UploadCloud size={24} />
        </div>
        <h3 className="text-sm font-bold text-slate-200 mb-1">
          {isServerRunning 
            ? t('dropDisabledServerRunning', 'Add-On Installation Disabled While Server is Running') 
            : t('dropFilesPrompt', 'Drag and drop your .mcaddon, .mcpack, or .zip here')}
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          {isServerRunning 
            ? t('dropDisabledDesc', 'Stop the server to safely import new behavior packs, resource packs, and scripts into your worlds.') 
            : t('dropFilesDesc', 'The engine will automatically analyze manifests, detect Behavior/Resource/Script modules, check UUID collisions and engine compatibility before installation.')}
        </p>
      </div>

      {/* Analysis In Progress Modal / Banner */}
      {analyzing && (
        <div className="bg-dark-850 border border-brand-500/30 rounded-xl p-5 shadow-xl space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-brand-500 mb-2">
            <RotateCw size={15} className="animate-spin" /> {t('analyzingAddon', 'Analyzing Add-On Structure...')}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300 font-mono">
            <div className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-400" /> {t('readingArchive', 'Reading archive')}</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-400" /> {t('findingManifests', 'Finding manifests')}</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-400" /> {t('detectingBP', 'Detecting Behavior Packs')}</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-400" /> {t('detectingRP', 'Detecting Resource Packs')}</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-400" /> {t('detectingScripts', 'Detecting Scripts')}</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-400" /> {t('checkingDependencies', 'Checking dependencies')}</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-400" /> {t('checkingUUIDs', 'Checking UUIDs')}</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-400" /> {t('checkingMcVersion', 'Checking Minecraft version')}</div>
          </div>
        </div>
      )}

      {/* Analysis Result & Installation Wizard Modal */}
      {analysisResult && (
        <div className="bg-dark-850 border border-dark-700 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-dark-750">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500">{t('analysisComplete', 'Analysis Complete')}</span>
              <h2 className="text-lg font-bold text-slate-100">{analysisResult.name || analysisResult.fileName}</h2>
            </div>
            <button
              onClick={() => setAnalysisResult(null)}
              className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded bg-dark-800"
            >
              {t('cancel', 'Cancel')}
            </button>
          </div>

          {/* Analysis Report Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-dark-900 p-3 rounded-lg border border-dark-750">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t('type', 'Type')}</span>
              <span className="font-bold text-slate-200">{analysisResult.type}</span>
            </div>
            <div className="bg-dark-900 p-3 rounded-lg border border-dark-750">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t('behaviorPack', 'Behavior Pack')}</span>
              <span className={`font-bold flex items-center gap-1 ${analysisResult.hasBehaviorPack ? "text-emerald-400" : "text-slate-500"}`}>
                {analysisResult.hasBehaviorPack ? (<><Check size={13} /> {t('present', 'Present')}</>) : t('none', 'None')}
              </span>
            </div>
            <div className="bg-dark-900 p-3 rounded-lg border border-dark-750">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t('resourcePack', 'Resource Pack')}</span>
              <span className={`font-bold flex items-center gap-1 ${analysisResult.hasResourcePack ? "text-emerald-400" : "text-slate-500"}`}>
                {analysisResult.hasResourcePack ? (<><Check size={13} /> {t('present', 'Present')}</>) : t('none', 'None')}
              </span>
            </div>
            <div className="bg-dark-900 p-3 rounded-lg border border-dark-750">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t('bedrockScript', 'Bedrock Script')}</span>
              <span className={`font-bold flex items-center gap-1 ${analysisResult.hasScript ? "text-cyan-400" : "text-slate-500"}`}>
                {analysisResult.hasScript ? (<><Check size={13} /> {t('detected', 'Detected')}</>) : t('none', 'None')}
              </span>
            </div>
          </div>

          {/* Warnings & Compatibility Note */}
          {analysisResult.warnings.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5"><AlertTriangle size={14} /> {t('warning', 'Warnings:')}</div>
              {analysisResult.warnings.map((w, idx) => (
                <div key={idx} className="pl-4">• {w}</div>
              ))}
            </div>
          )}

          {/* Installation Target & Options */}
          <div className="bg-dark-900 p-4 rounded-xl border border-dark-750 space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {t('configuration', 'Installation Configuration')}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">{t('targetWorld', 'Target World')}</label>
                <CustomSelect
                  value={targetWorld}
                  onChange={(val) => setTargetWorld(String(val))}
                  options={(worlds || []).map((w) => ({
                    value: w.folder || w.name,
                    label: `${w.levelName || w.name} (${w.folder || w.name})`,
                  }))}
                  fullWidth
                />
              </div>

              <div className="space-y-2 text-xs text-slate-300 pt-3">
                {analysisResult.hasBehaviorPack && analysisResult.hasResourcePack ? (
                  <label className="flex items-center gap-2 cursor-pointer select-none bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl text-emerald-300 font-bold">
                    <input
                      type="checkbox"
                      checked={enableBP && enableRP}
                      onChange={(e) => {
                        setEnableBP(e.target.checked);
                        setEnableRP(e.target.checked);
                      }}
                      className="rounded border-emerald-600 bg-dark-800 text-emerald-500 focus:ring-0"
                    />
                    <span>{t('addons.enableBoth', 'Enable Entire Add-On (Both Behavior & Resource Packs)')}</span>
                  </label>
                ) : (
                  <>
                    {analysisResult.hasBehaviorPack && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={enableBP}
                          onChange={(e) => setEnableBP(e.target.checked)}
                          className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-0"
                        />
                        <span>{t('enableBehaviorPack', 'Enable Behavior Pack in target world')}</span>
                      </label>
                    )}

                    {analysisResult.hasResourcePack && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={enableRP}
                          onChange={(e) => setEnableRP(e.target.checked)}
                          className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-0"
                        />
                        <span>{t('enableResourcePack', 'Enable Resource Pack in target world')}</span>
                      </label>
                    )}
                  </>
                )}

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createBackup}
                    onChange={(e) => setCreateBackup(e.target.checked)}
                    className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-0"
                  />
                  <span>{t('createPreInstallBackup', 'Create automatic backup before modification (Transactional safeguard)')}</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setAnalysisResult(null)}
              className="px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold"
            >
              {t('cancel', 'Cancel')}
            </button>
            <button
              onClick={handleExecuteInstall}
              disabled={installing}
              className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-brand-500/20 flex items-center gap-2"
            >
              {installing ? <RotateCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {installing ? t('installing', 'Installing...') : t('installToAddon', 'Install Add-On')}
            </button>
          </div>
        </div>
      )}

      {/* Installed Add-Ons List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {t('installedCustomAddons', 'Installed Custom Add-Ons')} ({addons.length})
            </h2>
          </div>

          {addons.length > 0 && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('addons.searchPlaceholder', 'Search add-ons by name or UUID...')}
              className="bg-dark-900 border border-dark-750 rounded-xl px-3.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500 w-full sm:w-64 transition-all"
            />
          )}
        </div>

        {addons.length === 0 ? (
          <div className="bg-dark-850/80 p-10 rounded-2xl border border-dark-750 text-center space-y-2">
            <div className="text-sm font-bold text-slate-300">{t('noAddonsInstalled', 'No Custom Add-Ons Installed')}</div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {t('addons.emptyDesc', 'Default Mojang vanilla server files are automatically filtered out. Drag and drop a .mcaddon or .mcpack file above to install your first custom Add-on!')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-settle">
            {addons
              .filter(a => 
                a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                a.uuid.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (a.description || '').toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((addon) => (
              <div 
                key={addon.id} 
                className="launcher-card rounded-2xl border border-white/[0.08] p-5 flex flex-col justify-between space-y-4 hover:border-brand-500/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-sm text-white font-sans">{addon.name}</h3>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">{addon.description || t('addons.noDesc', 'No description provided.')}</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/[0.06] text-slate-200 font-mono shrink-0 border border-white/[0.08]">
                      v{addon.version}
                    </span>
                  </div>

                  {/* Components Badges */}
                  <div className="flex flex-wrap gap-1.5 my-2.5">
                    {addon.hasBehaviorPack && (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 flex items-center gap-1 shadow-sm">
                        ● {t('behaviorPack', 'Behavior Pack')}
                      </span>
                    )}
                    {addon.hasResourcePack && (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 flex items-center gap-1 shadow-sm">
                        ● {t('resourcePack', 'Resource Pack')}
                      </span>
                    )}
                    {addon.hasScript && (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-violet-500/15 text-violet-300 border border-violet-500/35 flex items-center gap-1 shadow-sm">
                        ● {t('bedrockScript', 'Script Module')}
                      </span>
                    )}
                    {(addon.assignedWorlds || []).length > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-brand-500/20 text-brand-300 border border-brand-500/40 flex items-center gap-1 shadow-sm">
                        <CheckCircle2 size={10} className="text-brand-400" />
                        {t('addons.loadedOnWorlds', 'Loaded on {n} Worlds').replace('{n}', String((addon.assignedWorlds || []).length))}
                      </span>
                    )}
                  </div>

                  {/* World Assignments */}
                  <div className="pt-3 border-t border-white/[0.06] text-[11px] space-y-2">
                    <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider flex items-center justify-between">
                      <span>{t('addons.worldBindings', 'World Bindings:')}</span>
                      <span className="text-[9px] text-slate-500 font-normal">Active / Inactive per world</span>
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {(worlds || []).length === 0 ? (
                        <div className="p-2 text-center text-slate-500 text-[11px]">{t('noWorldsFound', 'No worlds available')}</div>
                      ) : (
                        (worlds || []).map((w) => {
                          const worldKey = w.folder || w.name;
                          const isAssigned = (addon.assignedWorlds || []).some(aw => 
                            aw.toLowerCase() === w.name.toLowerCase() || 
                            aw.toLowerCase() === (w.folder || '').toLowerCase() || 
                            aw.toLowerCase() === (w.levelName || '').toLowerCase()
                          );
                          const isToggling = togglingWorld?.addonId === addon.id && togglingWorld?.worldName === worldKey;

                          return (
                            <div 
                              key={worldKey} 
                              className={`flex items-center justify-between px-3 py-1.5 rounded-xl border transition-all ${
                                isAssigned 
                                  ? 'bg-brand-500/10 border-brand-500/30 text-white' 
                                  : 'bg-dark-950/70 border-white/[0.06] text-slate-400 hover:border-white/[0.12]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <Globe size={13} className={isAssigned ? "text-brand-400 shrink-0" : "text-slate-500 shrink-0"} />
                                <span className={`text-xs truncate ${isAssigned ? "text-slate-100 font-semibold" : "text-slate-400"}`}>
                                  {w.levelName || w.name}
                                </span>
                              </div>

                              <button
                                type="button"
                                disabled={isToggling || isServerRunning}
                                onClick={() => handleToggleWorldAssignment(addon, worldKey)}
                                title={isAssigned ? t('deactivateFromWorld', 'Deactivate from World') : t('activateForWorld', 'Activate for World')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none active:scale-95 disabled:opacity-50 shrink-0 ${
                                  isAssigned 
                                    ? 'bg-brand-500/20 text-brand-300 hover:bg-rose-500/20 hover:text-rose-300 border border-brand-500/30 hover:border-rose-500/40 group/btn' 
                                    : 'bg-dark-800 text-slate-400 hover:bg-brand-500/20 hover:text-brand-300 border border-dark-700 hover:border-brand-500/30'
                                }`}
                              >
                                {isToggling ? (
                                  <RotateCw size={11} className="animate-spin text-brand-400" />
                                ) : isAssigned ? (
                                  <>
                                    <Check size={11} className="text-brand-400 group-hover/btn:hidden" />
                                    <X size={11} className="text-rose-400 hidden group-hover/btn:inline" />
                                    <span className="group-hover/btn:hidden">{t('activeOnWorld', 'Active')}</span>
                                    <span className="hidden group-hover/btn:inline">{t('deactivateFromWorld', 'Deactivate')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Power size={11} className="text-slate-400" />
                                    <span>{t('activateForWorld', 'Activate')}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400 gap-2">
                  <span className="font-mono text-[10px] truncate max-w-[100px]" title={addon.uuid}>
                    {addon.uuid.substring(0, 8)}...
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Export Button */}
                    <button
                      type="button"
                      disabled={exportingId === addon.id}
                      onClick={() => handleExportAddon(addon)}
                      title={t('exportAddon', 'Export as .mcaddon')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 transition-all border border-white/[0.08] hover:border-cyan-500/30 active:scale-95 cursor-pointer disabled:opacity-50 text-[11px] font-semibold"
                    >
                      {exportingId === addon.id ? (
                        <RotateCw size={12} className="animate-spin text-cyan-400" />
                      ) : (
                        <Download size={12} />
                      )}
                      <span>{exportingId === addon.id ? t('exporting', 'Exporting...') : t('exportAddon', 'Export')}</span>
                    </button>

                    {/* Open Folder Button */}
                    <button
                      type="button"
                      onClick={() => Api.openFolder(addon.path)}
                      title={t('openFolder', 'Open Folder')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white transition-all border border-white/[0.08] active:scale-95 cursor-pointer text-[11px] font-semibold"
                    >
                      <FolderOpen size={12} />
                      <span>{t('openFolder', 'Folder')}</span>
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      disabled={isServerRunning}
                      onClick={() => setDeleteModalAddon(addon)}
                      title={t('deleteAddon', 'Delete Add-On')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 transition-all border border-rose-500/20 hover:border-rose-500/40 active:scale-95 cursor-pointer disabled:opacity-30 text-[11px] font-semibold"
                    >
                      <Trash2 size={12} />
                      <span>{t('deleteAddon', 'Delete')}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
