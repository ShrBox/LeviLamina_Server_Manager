import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  Package, 
  Box, 
  Globe, 
  Archive, 
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Check,
  Layers,
  FolderOpen
} from 'lucide-react';
import { Api } from '../services/api';
import { Server, World } from '../types';
import { useI18n } from '../i18n/translations';
import { CustomSelect } from '../components/CustomSelect';

interface ImportCenterProps {
  server: Server | null;
  worlds: World[];
  onRefreshWorlds?: () => Promise<void>;
  onNavigatePage: (page: string, payload?: { path: string; type?: string }) => void;
}

export const ImportCenter: React.FC<ImportCenterProps> = ({ 
  server, 
  worlds, 
  onRefreshWorlds, 
  onNavigatePage 
}) => {
  const { t } = useI18n();
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [selectedWorld, setSelectedWorld] = useState<string>('');

  useEffect(() => {
    if (worlds.length > 0 && !selectedWorld) {
      setSelectedWorld(server?.activeWorld || worlds[0].folder || worlds[0].name);
    }
  }, [worlds, server]);

  // Listen for native Wails file-drop events (WebView2 on Windows)
  useEffect(() => {
    const runtime = (window as any).runtime;
    if (runtime?.OnFileDrop) {
      runtime.OnFileDrop((_x: number, _y: number, paths: string[]) => {
        if (paths && paths.length > 0) {
          inspectFile(paths[0]);
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
          inspectFile(paths[0]);
        }
      });
      return () => {
        runtime.EventsOff('wails:file-drop');
      };
    }
  }, []);

  const handleSelectFile = async () => {
    try {
      const path = await Api.selectFile(
        "Select Content to Import",
        "Minecraft & LeviLamina Content (*.mcaddon, *.mcpack, *.zip, *.mcworld, *.dll)",
        "*.mcaddon;*.mcpack;*.zip;*.mcworld;*.dll"
      );
      if (path) {
        inspectFile(path);
      }
    } catch (err: any) {
      alert("Error selecting file: " + err.message);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const filePath = (files[0] as any).path;
      if (filePath) {
        inspectFile(filePath);
      }
    }
  };

  const inspectFile = async (filePath: string) => {
    setAnalyzing(true);
    setResult(null);
    setInstallStatus(null);
    try {
      const res = await Api.inspectImportFile(filePath);
      setResult({ ...res, path: filePath });
    } catch (err: any) {
      alert("Failed to inspect import file: " + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDirectInstallAddon = async () => {
    if (!server || !result?.path) return;
    setInstalling(true);
    setInstallStatus("Installing Add-On into server and world...");
    try {
      await Api.installAddon(server.id, result.path, {
        enableBehavior: true,
        enableResource: true,
        targetWorld: selectedWorld || server.activeWorld || (worlds[0]?.folder ?? 'Bedrock level'),
        createBackup: true
      });
      if (onRefreshWorlds) {
        await onRefreshWorlds();
      }
      setInstallStatus("Add-On successfully installed into " + (selectedWorld || "active world") + "!");
    } catch (err: any) {
      alert("Failed to install Add-On: " + err.message);
      setInstallStatus(null);
    } finally {
      setInstalling(false);
    }
  };

  const handleDirectImportWorld = async () => {
    if (!server || !result?.path) return;
    setInstalling(true);
    setInstallStatus("Extracting and importing Minecraft world archive...");
    try {
      const importedWorld = await Api.importWorld(server.id, result.path);
      if (onRefreshWorlds) {
        await onRefreshWorlds();
      }
      setInstallStatus(`World "${importedWorld.name || importedWorld.folder}" successfully imported into server!`);
      setTimeout(() => {
        onNavigatePage('worlds', { path: result.path });
      }, 700);
    } catch (err: any) {
      alert("Failed to import world: " + err.message);
      setInstallStatus(null);
    } finally {
      setInstalling(false);
    }
  };

  const handleProceedToDestination = async (destinationPage: string) => {
    if (!result?.path) {
      onNavigatePage(destinationPage);
      return;
    }

    if (result.type === 'WORLD' && server) {
      setInstalling(true);
      setInstallStatus("Importing world archive before navigating...");
      try {
        await Api.importWorld(server.id, result.path);
        if (onRefreshWorlds) {
          await onRefreshWorlds();
        }
      } catch (err) {
        console.warn("Auto-import before navigate encountered:", err);
      } finally {
        setInstalling(false);
      }
    }

    onNavigatePage(destinationPage, { path: result.path, type: result.type });
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 stagger-settle custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-left">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">
                {t('importCenterTitle', 'Universal Import Center')}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('importCenterDesc', 'Drop any Bedrock or LeviLamina archive to automatically analyze its structure, dependencies, and target destination.')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Universal Dropzone */}
      <div
        style={{ ['--wails-drop-target' as any]: 'drop' }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={handleSelectFile}
        className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all animate-card-pop ${
          dragOver 
            ? "border-brand-500 bg-brand-500/15 scale-[1.01] shadow-2xl shadow-brand-500/20" 
            : "border-dark-750 bg-dark-900/60 hover:border-brand-500/50 hover:bg-dark-850 shadow-xl"
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center text-brand-400 mx-auto mb-4 shadow-xl group-hover:scale-110 transition-transform">
          <UploadCloud size={32} />
        </div>
        <h2 className="text-base font-bold text-slate-200 mb-1">
          {t('dropContentHere', 'Drop your content file here or browse')}
        </h2>
        <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
          {t('dropContentDesc', 'Supports .mcaddon, .mcpack, .mcworld, LeviLamina .zip archives, and standalone .dll plugins.')}
        </p>
      </div>

      {/* Analyzing Banner */}
      {analyzing && (
        <div className="bg-dark-850 p-6 rounded-2xl border border-brand-500/40 text-center space-y-2 animate-spring-pop shadow-xl">
          <RotateCw size={26} className="animate-spin text-brand-400 mx-auto" />
          <div className="text-sm font-bold text-slate-100">
            {t('inspectingStructure', 'Inspecting Archive Structure...')}
          </div>
          <div className="text-xs text-slate-400">
            {t('inspectingStructureDesc', 'Verifying headers, checksums, and manifest payloads.')}
          </div>
        </div>
      )}

      {/* Install Status Toast */}
      {installStatus && (
        <div className="p-4 rounded-2xl border bg-brand-500/10 border-brand-500/30 text-brand-300 flex items-center gap-3 animate-spring-pop shadow-lg">
          <CheckCircle2 size={18} className="shrink-0 text-brand-400" />
          <span className="text-xs font-semibold">{installStatus}</span>
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="launcher-card rounded-2xl border border-white/[0.08] p-6 space-y-5 shadow-2xl animate-spring-pop">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-400">
                {t('inspectionResult', 'Inspection Result')}
              </span>
              <h3 className="text-base font-bold text-slate-100 mt-0.5 truncate" title={result.path}>
                {result.name || result.path}
              </h3>
              <p className="text-xs text-slate-400 mt-1">{result.message}</p>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono truncate">
                {result.path}
              </div>
            </div>

            <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/35 shrink-0 shadow-sm">
              {result.type}
            </span>
          </div>

          {/* ADDON Workflow */}
          {result.type === 'ADDON' && (
            <div className="pt-4 border-t border-white/[0.08] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-950/50 p-4 rounded-xl border border-white/[0.05]">
                <div className="flex items-center gap-3">
                  <Package className="text-brand-400 shrink-0" size={20} />
                  <div>
                    <div className="text-xs font-bold text-slate-200">
                      {t('targetWorld', 'Target World')}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Select which world to activate this Add-On in
                    </div>
                  </div>
                </div>

                <div className="w-full sm:w-60">
                  <CustomSelect
                    value={selectedWorld}
                    onChange={setSelectedWorld}
                    options={worlds.map(w => ({
                      value: w.folder || w.name,
                      label: `${w.name || w.folder}${w.isActive ? ' (Active)' : ''}`
                    }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleDirectInstallAddon}
                  disabled={installing}
                  className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs shadow-lg shadow-brand-500/25 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {installing ? (
                    <RotateCw size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  {t('installAddonNow', 'Quick Install into World')}
                </button>

                <button
                  onClick={() => handleProceedToDestination('addons')}
                  className="px-4 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 font-bold text-xs border border-white/[0.08] flex items-center gap-2 transition-all active:scale-95"
                >
                  {t('proceedToAddonInstaller', 'Proceed to Add-On Manager')}
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* WORLD Workflow */}
          {result.type === 'WORLD' && (
            <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-300 flex items-center gap-2">
                <Globe size={16} className="text-cyan-400" />
                {t('worldArchiveReady', 'Ready to extract and register world inside server worlds directory.')}
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleDirectImportWorld}
                  disabled={installing}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {installing ? (
                    <RotateCw size={14} className="animate-spin" />
                  ) : (
                    <Globe size={14} />
                  )}
                  {t('importWorldNow', 'Import World to Server')}
                </button>

                <button
                  onClick={() => handleProceedToDestination('worlds')}
                  className="px-4 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 font-bold text-xs border border-white/[0.08] flex items-center gap-2 transition-all active:scale-95"
                >
                  {t('proceedToWorlds', 'Proceed to Worlds Tab')}
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* MOD Workflow */}
          {result.type === 'MOD' && (
            <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-300 flex items-center gap-2">
                <Box size={16} className="text-purple-400" />
                {t('modArchiveDetected', 'LeviLamina plugin/mod detected.')}
              </span>

              <button
                onClick={() => handleProceedToDestination('mods')}
                className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-slate-950 font-bold text-xs shadow-lg shadow-purple-500/25 flex items-center gap-2 transition-all active:scale-95"
              >
                {t('proceedToMods', 'Proceed to Mods')}
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* BACKUP Workflow */}
          {result.type === 'BACKUP' && (
            <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-300 flex items-center gap-2">
                <Archive size={16} className="text-amber-400" />
                {t('backupArchiveDetected', 'Server backup archive detected.')}
              </span>

              <button
                onClick={() => handleProceedToDestination('backups')}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all active:scale-95"
              >
                {t('proceedToBackups', 'Proceed to Backups')}
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* UNKNOWN Workflow */}
          {result.type === 'UNKNOWN' && (
            <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-400 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400" />
                {t('chooseTargetCategory', 'Select which manager category to send this file to:')}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleProceedToDestination('addons')}
                  className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-200 text-xs font-semibold border border-white/[0.08]"
                >
                  {t('asAddon', 'Treat as Add-On')}
                </button>
                <button
                  onClick={() => handleProceedToDestination('worlds')}
                  className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-200 text-xs font-semibold border border-white/[0.08]"
                >
                  {t('asWorld', 'Treat as World')}
                </button>
                <button
                  onClick={() => handleProceedToDestination('mods')}
                  className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-200 text-xs font-semibold border border-white/[0.08]"
                >
                  {t('asMod', 'Treat as Mod')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Supported Types Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 stagger-settle">
        <div className="launcher-card p-5 rounded-2xl border border-white/[0.06] glass-panel-hover animate-settle">
          <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 mb-3">
            <Package size={20} />
          </div>
          <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wide">{t('bedrockAddons', 'Bedrock Add-Ons')}</h3>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            {t('bedrockAddonsDesc', '.mcaddon, .mcpack with behavior and resource packs')}
          </p>
        </div>

        <div className="launcher-card p-5 rounded-2xl border border-white/[0.06] glass-panel-hover animate-settle" style={{ animationDelay: '60ms' }}>
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3">
            <Box size={20} />
          </div>
          <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wide">{t('leviLaminaMods', 'LeviLamina Mods')}</h3>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            {t('leviLaminaModsDesc', 'LIP packages, tooth.json, plugin .dll binaries')}
          </p>
        </div>

        <div className="launcher-card p-5 rounded-2xl border border-white/[0.06] glass-panel-hover animate-settle" style={{ animationDelay: '120ms' }}>
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3">
            <Globe size={20} />
          </div>
          <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wide">{t('minecraftWorlds', 'Minecraft Worlds')}</h3>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            {t('minecraftWorldsDesc', '.mcworld archives and level folder exports')}
          </p>
        </div>

        <div className="launcher-card p-5 rounded-2xl border border-white/[0.06] glass-panel-hover animate-settle" style={{ animationDelay: '180ms' }}>
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
            <Archive size={20} />
          </div>
          <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wide">{t('serverBackups', 'Server Backups')}</h3>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            {t('serverBackupsDesc', 'Standard full snapshot zip archives')}
          </p>
        </div>
      </div>
    </div>
  );
};
