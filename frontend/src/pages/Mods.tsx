import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  RotateCw, 
  Settings, 
  CheckCircle2, 
  Trash2, 
  Power, 
  Download, 
  FolderOpen,
  Terminal,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Lock,
  ListTodo,
  MessageSquare,
  Save,
  Navigation,
  Sparkles,
  X,
  ExternalLink,
  Star,
  Search,
  Tag,
  Package,
  Calendar,
  Layers,
  Check,
  AlertTriangle
} from 'lucide-react';
import { Api } from '../services/api';
import { Mod, Server, BedrinthPackage, UpdateCheckReport } from '../types';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { showDialog, confirmAction } from '../components/ModalAlert';
import { CustomSelect } from '../components/CustomSelect';
import { parseFriendlyError } from '../utils/friendlyError';
import { checkInstalledModCompatibility, checkBedrinthPackageCompatibility } from '../utils/compatibility';
import { useI18n } from '../i18n';

interface ModsProps {
  server: Server | null;
  updateReport?: UpdateCheckReport | null;
  onOpenUpdates?: () => void;
  onCheckUpdates?: () => void;
}

export const Mods: React.FC<ModsProps> = ({ 
  server, 
  updateReport, 
  onOpenUpdates, 
  onCheckUpdates 
}) => {
  const { t } = useI18n();
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(false);
  const [lipInstalled, setLipInstalled] = useState(false);
  const [lipVersion, setLipVersion] = useState('');
  const [pkgInput, setPkgInput] = useState('github.com/LiteLDev/LeviOptimize');
  const [installingLip, setInstallingLip] = useState(false);
  const [installingTooth, setInstallingTooth] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'bedrinth' | 'installed' | 'lip'>('bedrinth');

  // Bedrinth catalog state
  const [bedrinthPackages, setBedrinthPackages] = useState<BedrinthPackage[]>([]);
  const [bedrinthLoading, setBedrinthLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'stars' | 'updated' | 'name'>('stars');
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({});

  // Config editor state
  const [selectedModConfig, setSelectedModConfig] = useState<{ name: string; path: string; config: any } | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

  useEffect(() => {
    loadBedrinthPackages();
  }, []);

  useEffect(() => {
    if (server) {
      loadMods();
      checkLip();
    }
  }, [server]);

  const loadBedrinthPackages = async () => {
    setBedrinthLoading(true);
    try {
      const list = await Api.getBedrinthPackages();
      setBedrinthPackages(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to load Bedrinth packages:", err);
      setBedrinthPackages([]);
    } finally {
      setBedrinthLoading(false);
    }
  };

  const loadMods = async () => {
    if (!server) {
      setMods([]);
      return;
    }
    setLoading(true);
    try {
      const list = await Api.listMods(server.id);
      setMods(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to load mods:", err);
      setMods([]);
    } finally {
      setLoading(false);
    }
  };

  const checkLip = async () => {
    if (!server) return;
    try {
      const res = await Api.checkLipStatus(server.id);
      setLipInstalled(res.installed);
      setLipVersion(res.version);
    } catch (err) {
      console.error("Failed to check LIP status:", err);
    }
  };

  const handleToggleMod = async (mod: Mod) => {
    try {
      if (mod.enabled) {
        await Api.disableMod(mod.path);
      } else {
        await Api.enableMod(mod.path);
      }
      loadMods();
    } catch (err: any) {
      alert("Error toggling mod: " + err.message);
    }
  };

  const handleRemoveMod = async (mod: Mod) => {
    const isLoader = mod.name.toLowerCase() === 'levilamina';
    const confirmed = await confirmAction({
      title: isLoader ? 'Delete Core Loader "LeviLamina"?' : `Delete "${mod.name}"?`,
      message: isLoader 
        ? 'WARNING: "LeviLamina" is the server mod loader runtime itself. Deleting it will remove the LeviLamina core and other plugins will no longer run.\n\nAre you sure you want to delete it?'
        : `Are you sure you want to delete "${mod.name}"? This will remove the mod and its files from the server.`,
      confirmText: isLoader ? 'Delete Core Loader' : 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;
    try {
      await Api.removeMod(mod.path);
      loadMods();
    } catch (err: any) {
      alert("Failed to delete mod: " + err.message);
    }
  };

  const handleInstallLip = async () => {
    setInstallingLip(true);
    try {
      await Api.installLip();
      await checkLip();
      alert("LIP package manager installed successfully!");
    } catch (err: any) {
      alert("Failed to install LIP: " + err.message);
    } finally {
      setInstallingLip(false);
    }
  };

  const handleInstallPackage = async () => {
    if (!server || !pkgInput.trim()) return;
    setInstallingTooth('custom-package');
    try {
      const res = await Api.installLipPackage(server.id, pkgInput.trim());
      const outputText = (res.stderr || res.stdout || res.error || '');
      if (res.success) {
        showDialog({
          title: t('mods.packageInstalled', 'Package Installed'),
          message: `${t('mods.package', 'Package')} "${pkgInput.trim()}" ${t('mods.installedSuccess', 'installed successfully!')}`,
          type: "success",
        });
        setPkgInput('');
        loadMods();
        setActiveTab('installed');
      } else {
        const parsed = parseFriendlyError(outputText, { packageName: pkgInput.trim(), serverName: server.name });
        showDialog({
          title: parsed.title,
          message: parsed.message,
          suggestion: parsed.suggestion,
          detailedOutput: parsed.rawDetails,
          type: parsed.type,
        });
      }
    } catch (err: any) {
      const parsed = parseFriendlyError(err.message, { packageName: pkgInput.trim() });
      showDialog({
        title: parsed.title,
        message: parsed.message,
        suggestion: parsed.suggestion,
        detailedOutput: parsed.rawDetails,
        type: 'error',
      });
    } finally {
      setInstallingTooth(null);
    }
  };

  const handleInstallBedrinth = async (pkg: BedrinthPackage) => {
    if (!server) {
      showDialog({
        title: t('serverRequired', 'Server Required'),
        message: t('mods.selectServerFirst', 'Please select a server first to install Bedrinth mods.'),
        type: "info",
      });
      return;
    }

    const version = selectedVersions[pkg.tooth] || '';
    const compat = checkBedrinthPackageCompatibility(pkg, server, version);
    if (!compat.isSupported) {
      const confirmed = await confirmAction({
        title: t('mods.unsupportedWarning', 'Unsupported Mod Warning'),
        message: `"${pkg.name}" ${t('mods.unsupportedDesc', 'is marked as unsupported on this LeviLamina loader version')}.\n\n${compat.reason || ''}\n\n${t('mods.unsupportedConfirm', 'Installing this package may cause the server to crash or fail to load. Do you want to proceed with the installation anyway?')}`,
        confirmText: t('mods.installAnyway', 'Install Anyway'),
        cancelText: t('cancel', 'Cancel'),
        isDestructive: true,
      });
      if (!confirmed) return;
    }

    setInstallingTooth(pkg.tooth);
    try {
      if (!lipInstalled) {
        await Api.installLip();
        await checkLip();
      }
      const res = await Api.installBedrinthPackage(server.id, pkg.tooth, version);
      const outputText = (res.stderr || res.stdout || res.error || '');
      if (res.success || outputText.includes("already explicitly installed") || outputText.includes("installed")) {
        showDialog({
          title: t('mods.packageInstalled', 'Package Installed'),
          message: `${pkg.name} ${t('mods.installedAndActiveOn', 'is installed and active on')} ${server.name}`,
          type: "success",
        });
        await loadMods();
      } else {
        const parsed = parseFriendlyError(outputText, { packageName: pkg.name, serverName: server.name });
        showDialog({
          title: parsed.title,
          message: parsed.message,
          suggestion: parsed.suggestion,
          detailedOutput: parsed.rawDetails,
          type: parsed.type,
        });
        await loadMods();
      }
    } catch (err: any) {
      const parsed = parseFriendlyError(err.message, { packageName: pkg.name });
      showDialog({
        title: parsed.title,
        message: parsed.message,
        suggestion: parsed.suggestion,
        detailedOutput: parsed.rawDetails,
        type: 'error',
      });
    } finally {
      setInstallingTooth(null);
    }
  };

  const handleUninstallBedrinth = async (pkg: BedrinthPackage) => {
    if (!server) return;
    const confirmed = await confirmAction({
      title: `${t('uninstall', 'Uninstall')} ${pkg.name}?`,
      message: `${t('confirmUninstallPkg', 'Are you sure you want to uninstall')} "${pkg.name}" ${t('fromServer', 'from')} ${server.name}?`,
      confirmText: t('uninstall', 'Uninstall'),
      cancelText: t('cancel', 'Cancel'),
      isDestructive: true,
    });
    if (!confirmed) return;

    setInstallingTooth(pkg.tooth);
    try {
      const res = await Api.uninstallBedrinthPackage(server.id, pkg.tooth);
      if (res.success) {
        showDialog({
          title: t('mods.packageUninstalled', 'Package Uninstalled'),
          message: `${pkg.name} ${t('mods.hasBeenUninstalled', 'has been uninstalled.')}`,
          type: "info",
        });
      } else {
        const parsed = parseFriendlyError(res.stderr || res.stdout || res.error, { packageName: pkg.name });
        showDialog({
          title: parsed.title,
          message: parsed.message,
          suggestion: parsed.suggestion,
          detailedOutput: parsed.rawDetails,
          type: parsed.type,
        });
      }
      await loadMods();
    } catch (err: any) {
      const parsed = parseFriendlyError(err.message, { packageName: pkg.name });
      showDialog({
        title: parsed.title,
        message: parsed.message,
        suggestion: parsed.suggestion,
        detailedOutput: parsed.rawDetails,
        type: 'error',
      });
    } finally {
      setInstallingTooth(null);
    }
  };

  const handleOpenConfig = async (mod: Mod) => {
    if (!mod.configPath) {
      alert("No configuration file found for this mod.");
      return;
    }
    try {
      const cfg = await Api.getModConfig(mod.configPath);
      setSelectedModConfig({
        name: mod.name,
        path: mod.configPath,
        config: cfg,
      });
    } catch (err: any) {
      alert("Failed to open mod config: " + err.message);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedModConfig) return;
    setConfigSaving(true);
    try {
      await Api.saveModConfig(selectedModConfig.path, selectedModConfig.config);
      alert("Configuration saved successfully!");
      setSelectedModConfig(null);
    } catch (err: any) {
      alert("Failed to save config: " + err.message);
    } finally {
      setConfigSaving(false);
    }
  };

  const openUrl = (url: string) => {
    try {
      BrowserOpenURL(url);
    } catch {
      window.open(url, '_blank');
    }
  };

  // Check if a tooth / package is already installed
  const isToothInstalled = (tooth: string, pkgName: string) => {
    const slug = tooth.split('/').pop()?.toLowerCase() || '';
    const cleanName = pkgName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return (mods || []).some(m => {
      const mTooth = (m.toothPath || '').toLowerCase();
      if (mTooth && mTooth === tooth.toLowerCase()) return true;
      const mName = (m.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const mPath = (m.path || '').toLowerCase();
      return mTooth.includes(slug) || mPath.includes(slug) || (cleanName && (mName.includes(cleanName) || cleanName.includes(mName)));
    });
  };

  // Filter and sort packages
  const filteredPackages = useMemo(() => {
    const pkgs = Array.isArray(bedrinthPackages) ? bedrinthPackages : [];
    return pkgs.filter(pkg => {
      if (!pkg) return false;
      const tags = Array.isArray(pkg.tags) ? pkg.tags : [];
      // 1. Tag filter
      if (selectedTag === 'mod' && !tags.some(t => t && t.toLowerCase().includes('mod'))) return false;
      if (selectedTag === 'plugin' && !tags.some(t => t && t.toLowerCase().includes('plugin'))) return false;
      if (selectedTag === 'lib' && !tags.some(t => t && t.toLowerCase().includes('lib'))) return false;
      if (selectedTag === 'tool' && !tags.some(t => t && (t.toLowerCase().includes('tool') || t.toLowerCase().includes('cli')))) return false;

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (pkg.name || '').toLowerCase().includes(q);
        const matchDesc = (pkg.description || '').toLowerCase().includes(q);
        const matchTooth = (pkg.tooth || '').toLowerCase().includes(q);
        const matchTags = tags.some(t => t && t.toLowerCase().includes(q));
        if (!matchName && !matchDesc && !matchTooth && !matchTags) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'stars') return (b.stars || 0) - (a.stars || 0);
      if (sortBy === 'updated') return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [bedrinthPackages, searchQuery, selectedTag, sortBy]);

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">{t('modsManagerTitle', 'Mods & Plugins Manager')}</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t('modsManagerSubtitle', 'Browse and install verified LeviLamina mods, plugins, and libraries directly from pkg.levimc.org.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadMods();
              loadBedrinthPackages();
            }}
            disabled={loading || bedrinthLoading}
            className="p-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700 transition-all shadow-sm active:scale-95"
            title={t('refresh', 'Refresh packages and mods')}
          >
            <RotateCw size={15} className={loading || bedrinthLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Dedicated Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-dark-900/80 rounded-2xl border border-dark-750/80 w-fit backdrop-blur-md">
        <button
          onClick={() => setActiveTab('bedrinth')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 outline-none focus:outline-none ${
            activeTab === 'bedrinth'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20 scale-[1.02]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-dark-800/60'
          }`}
        >
          <Sparkles size={14} />
          <span>{t('bedrinthCatalog', 'Bedrinth Catalog')}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'bedrinth' ? 'bg-slate-950/25 text-slate-950' : 'bg-white/[0.08] text-slate-400'
          }`}>
            {(bedrinthPackages || []).length > 0 ? (bedrinthPackages || []).length : "140+"}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('installed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 outline-none focus:outline-none ${
            activeTab === 'installed'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20 scale-[1.02]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-dark-800/60'
          }`}
        >
          <Box size={14} />
          <span>{t('installedOnServer', 'Installed on Server')}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'installed' ? 'bg-slate-950/25 text-slate-950' : 'bg-white/[0.08] text-slate-400'
          }`}>
            {(mods || []).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('lip')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 outline-none focus:outline-none ${
            activeTab === 'lip'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20 scale-[1.02]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-dark-800/60'
          }`}
        >
          <Terminal size={14} />
          <span>{t('lipPackageManager', 'LIP Package Manager')}</span>
          {lipInstalled && (
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          )}
        </button>
      </div>

      <div key={activeTab} className="animate-tab-enter">
        {/* TAB 1: BEDRINTH CATALOG (pkg.levimc.org) */}
        {activeTab === 'bedrinth' && (
        <div className="space-y-4 stagger-settle">
          {/* Controls: Search, Tag Filters, Sorting */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-dark-850 p-3.5 rounded-2xl border border-dark-750">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchModsPlaceholder', 'Search mods, plugins, libraries by name or tooth...')}
                className="w-full bg-dark-900 border border-dark-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Tag Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-dark-900/80 rounded-2xl border border-dark-750/70 overflow-x-auto">
              {[
                { id: 'all', label: t('filterAll', 'All') },
                { id: 'mod', label: t('filterMods', 'Mods') },
                { id: 'plugin', label: t('filterPlugins', 'Plugins') },
                { id: 'lib', label: t('filterLibs', 'Libraries') },
                { id: 'tool', label: t('filterTools', 'Tools') },
              ].map(tagItem => (
                <button
                  key={tagItem.id}
                  onClick={() => setSelectedTag(tagItem.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 outline-none focus:outline-none ${
                    selectedTag === tagItem.id
                      ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/25 scale-[1.02]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-dark-800/50'
                  }`}
                >
                  {tagItem.label}
                </button>
              ))}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">{t('sort', 'Sort:')}</span>
              <CustomSelect
                value={sortBy}
                onChange={(val) => setSortBy(val as any)}
                options={[
                  { value: 'stars', label: t('sortMostStars', 'Most Stars ⭐') },
                  { value: 'updated', label: t('sortRecentlyUpdated', 'Recently Updated 🕒') },
                  { value: 'name', label: t('sortAlphabetical', 'Alphabetical A-Z') },
                ]}
                triggerClassName="py-1.5 px-3 text-xs min-w-[155px]"
                menuClassName="w-48"
              />
            </div>
          </div>

          {/* Results count banner */}
          <div className="flex items-center justify-between px-1 text-xs text-slate-400">
            <span>
              {t('mods.showing', 'Showing')} <strong className="text-slate-200">{(filteredPackages || []).length}</strong> {t('mods.packagesFrom', 'packages from')} <strong className="text-brand-400">pkg.levimc.org</strong>
            </span>
            <button
              onClick={() => openUrl("https://pkg.levimc.org/")}
              className="hover:text-brand-400 flex items-center gap-1 text-[11px] transition-colors"
            >
              <span>{t('mods.visitBedrinth', 'Visit Bedrinth Web')}</span>
              <ExternalLink size={12} />
            </button>
          </div>

          {/* Loading state */}
          {bedrinthLoading && (bedrinthPackages || []).length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
              <RotateCw size={24} className="animate-spin text-brand-400" />
              <span>{t('mods.fetchingIndex', 'Fetching package index from Bedrinth (pkg.levimc.org)...')}</span>
            </div>
          ) : (filteredPackages || []).length === 0 ? (
            <div className="launcher-card rounded-2xl p-12 text-center text-slate-400 text-xs border border-white/[0.07] space-y-3">
              <p>{t('noModsFound', 'No packages match your search or filter criteria.')}</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTag('all');
                }}
                className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 text-xs font-semibold"
              >
                {t('clear', 'Clear Filters')}
              </button>
            </div>
          ) : (
            /* Packages Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-settle">
              {(filteredPackages || []).map((pkg) => {
                const isInstalled = isToothInstalled(pkg.tooth, pkg.name);
                const isDownloading = installingTooth === pkg.tooth;
                const versions = Array.isArray(pkg.versions) ? pkg.versions : [];
                const currentVersion = selectedVersions[pkg.tooth] || versions[0] || 'latest';
                const compat = checkBedrinthPackageCompatibility(pkg, server, currentVersion);
                const tags = Array.isArray(pkg.tags) ? pkg.tags : [];

                return (
                  <div
                    key={pkg.tooth}
                    className={`launcher-card relative rounded-2xl border p-5 flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-all duration-200 shadow-md group animate-card-pop focus-within:z-30 ${
                      !compat.isSupported 
                        ? 'border-rose-500/30 bg-rose-500/[0.02] hover:border-rose-500/50' 
                        : 'border-white/[0.08] hover:border-brand-500/40'
                    }`}
                  >
                    <div>
                      {/* Top Header: Avatar / Icon + Name + Stars */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {pkg.avatarUrl ? (
                            <img
                              src={pkg.avatarUrl}
                              alt={pkg.name}
                              className="w-9 h-9 rounded-xl object-contain bg-white/[0.04] p-1 border border-white/[0.08] shrink-0"
                              onError={(e) => {
                                // Fallback if image fails to load
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center shrink-0 text-brand-400 group-hover:scale-105 transition-transform">
                              <Box size={18} />
                            </div>
                          )}

                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-white group-hover:text-brand-300 transition-colors truncate font-sans">
                              {pkg.name}
                            </h3>
                            <div className="text-[10px] text-slate-500 font-mono truncate max-w-[160px]" title={pkg.tooth}>
                              {pkg.tooth.replace('github.com/', '')}
                            </div>
                          </div>
                        </div>

                        {/* Stars Pill */}
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/25 shrink-0 shadow-sm">
                          <Star size={11} className="fill-amber-400 text-amber-400" />
                          <span>{pkg.stars}</span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-400 leading-relaxed mt-2 line-clamp-2 min-h-[34px]">
                        {pkg.description || t('mods.noDesc', 'No description provided.')}
                      </p>

                      {/* Unsupported Warning Banner if package is incompatible */}
                      {!compat.isSupported && (
                        <div className="mt-2.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-1.5 text-rose-500 leading-snug">
                          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="font-bold text-[10px]">
                              {t('mods.unsupportedLoader', 'Unsupported on this LeviLamina loader version')}
                            </div>
                            {compat.reason && (
                              <div className="text-[10px] opacity-80 mt-0.5">
                                {compat.reason}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tags row */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-white/[0.05] text-slate-300 border border-white/[0.08]"
                          >
                            {tag.replace('platform:', '').replace('type:', '')}
                          </span>
                        ))}
                        {pkg.updatedAt && (
                          <span className="text-[10px] text-slate-500 ml-auto flex items-center gap-1">
                            <Calendar size={10} />
                            {formatDate(pkg.updatedAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                      {/* Version selector dropdown if multiple versions exist */}
                      {Array.isArray(pkg.versions) && pkg.versions.length > 1 ? (
                        <CustomSelect
                          value={currentVersion}
                          onChange={(ver) => setSelectedVersions({ ...selectedVersions, [pkg.tooth]: String(ver) })}
                          options={pkg.versions.map((ver) => ({
                            value: ver,
                            label: `v${ver}`,
                          }))}
                          triggerClassName="py-1 px-2.5 text-[11px] font-mono min-w-[85px] max-w-[105px]"
                          menuClassName="min-w-[95px]"
                          placement="top"
                          placeholder={t('version', 'Version')}
                        />
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">
                          v{(Array.isArray(pkg.versions) && pkg.versions[0]) || "latest"}
                        </span>
                      )}

                      <div className="flex items-center gap-1.5 ml-auto">
                        {/* Bedrinth web page link button */}
                        <button
                          type="button"
                          onClick={() => openUrl(`https://pkg.levimc.org/packages/${pkg.tooth}`)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all"
                          title={t('mods.viewOnPkg', 'View on pkg.levimc.org')}
                        >
                          <ExternalLink size={14} />
                        </button>

                        {/* Install / Installed Button */}
                        {isInstalled ? (
                          <div className="flex items-center gap-1">
                            <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shadow-sm">
                              <CheckCircle2 size={12} /> {t('installed', 'Installed')}
                            </span>
                            <button
                              onClick={() => handleUninstallBedrinth(pkg)}
                              disabled={isDownloading}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title={t('uninstall', 'Uninstall')}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleInstallBedrinth(pkg)}
                            disabled={installingTooth !== null}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-emerald-500 hover:from-brand-400 hover:to-emerald-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 shadow-md shadow-brand-500/20 active:scale-95 disabled:opacity-50"
                          >
                            {isDownloading ? (
                              <span>{t('installing', 'Installing...')}</span>
                            ) : (
                              <>
                                <Download size={13} /> {t('install', 'Install')}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Animated loading bar at bottom of the card while downloading */}
                    {isDownloading && (
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-emerald-500/20 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 via-brand-400 to-emerald-300 w-full mod-progress-bar"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DEDICATED INSTALLED PLUGINS */}
      {activeTab === 'installed' && (
        <div className="space-y-4 stagger-settle">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <span>{t('installedOnServer', 'Installed Server Plugins')}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                {(mods || []).length}
              </span>
            </h2>

            <div className="flex items-center gap-2.5">
              {onCheckUpdates && (
                <button
                  type="button"
                  onClick={onCheckUpdates}
                  className="px-2.5 py-1 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-750 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title={t('checkUpdatesDesc', 'Check for updates to installed mods and dependencies')}
                >
                  <RotateCw size={12} /> {t('checkUpdates', 'Check for Updates')}
                </button>
              )}

              {updateReport && updateReport.hasUpdates && onOpenUpdates && (
                <button
                  type="button"
                  onClick={onOpenUpdates}
                  className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 animate-pulse cursor-pointer"
                >
                  <Sparkles size={12} /> {t('updatesAvailable', '{n} Update(s) Ready').replace('{n}', String(updateReport.totalUpdatesCount))}
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('bedrinth')}
                className="text-xs font-bold text-brand-500 hover:text-brand-400 flex items-center gap-1.5 transition-colors"
              >
                <Sparkles size={13} /> {t('bedrinthCatalog', 'Browse Bedrinth Catalog')}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <RotateCw size={14} className="animate-spin text-brand-400" /> {t('loading', 'Scanning installed mods...')}
            </div>
          ) : (mods || []).length === 0 ? (
            <div className="launcher-card rounded-2xl p-10 text-center text-slate-400 text-xs border border-white/[0.07] space-y-3">
              <p>{t('noModsInstalled', 'No mods or plugins installed on this server yet.')}</p>
              <button
                onClick={() => setActiveTab('bedrinth')}
                className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs shadow-md shadow-brand-500/20 transition-all active:scale-95"
              >
                {t('browseBedrinth', 'Browse & Install from Bedrinth')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(mods || []).map((mod) => {
                const compat = checkInstalledModCompatibility(mod, server);
                const isLoader = mod.name.toLowerCase() === 'levilamina';
                const modUpdate = (updateReport?.modUpdates || []).find(u => 
                  u.name.toLowerCase() === mod.name.toLowerCase() || 
                  (u.tooth && mod.toothPath && u.tooth.toLowerCase() === mod.toothPath.toLowerCase())
                );

                return (
                  <div 
                    key={mod.name} 
                    className={`launcher-card rounded-2xl border p-5 flex flex-col justify-between space-y-4 transition-all duration-200 animate-card-pop ${
                      !compat.isSupported
                        ? "border-rose-500/40 bg-rose-500/[0.02]"
                        : modUpdate?.hasUpdate
                          ? "border-amber-500/35 hover:border-amber-500/55"
                          : mod.enabled 
                            ? "border-white/[0.09] hover:border-brand-500/35" 
                            : "border-white/[0.04] opacity-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-white font-sans">{mod.name}</h3>
                            {isLoader && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-brand-500/15 text-brand-400 border border-brand-500/30 shadow-sm">
                                CORE LOADER
                              </span>
                            )}
                            {mod.isLipPackage && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm">
                                LIP
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {mod.description || t('noDescription', 'No description specified in manifest.')}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-sm ${
                            mod.enabled 
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" 
                              : "bg-white/[0.04] text-slate-500 border-white/[0.06]"
                          }`}>
                            {mod.enabled ? t('enabled', 'ENABLED') : t('disabled', 'DISABLED')}
                          </span>

                          {modUpdate && modUpdate.hasUpdate && (
                            <button
                              type="button"
                              onClick={onOpenUpdates}
                              className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 flex items-center gap-1 transition-colors cursor-pointer"
                              title={t('updateReady', 'Update to v{ver} available! Click to review.').replace('{ver}', modUpdate.latestVersion)}
                            >
                              <Sparkles size={10} className="text-amber-400" />
                              <span>v{modUpdate.latestVersion} {t('updateAvailable', 'Available')}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Unsupported Warning Banner if mod is incompatible */}
                      {!compat.isSupported && (
                        <div className="my-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-[11px] leading-snug flex items-start gap-2">
                          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-[11px]">
                              {t('unsupportedOnVersion', 'Unsupported on this LeviLamina loader version')}
                            </div>
                            <div className="text-[10px] opacity-90 mt-0.5">
                              {compat.reason || `${t('incompatibleWithLoader', 'Incompatible with active LeviLamina loader')} v${server?.leviLaminaVersion || 'unknown'}.`}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1 my-3 text-[11px] text-slate-400">
                        <div>{t('version', 'Version')}: <span className="text-white font-mono font-medium">{mod.version || "1.0.0"}</span></div>
                        {mod.author && <div>{t('authorsMaintainers', 'Author')}: <span className="text-slate-300 font-medium">{mod.author}</span></div>}
                        {(mod.dependencies || []).length > 0 && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            {t('dependencies', 'Dependencies')}: {(mod.dependencies || []).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>

                  <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {modUpdate && modUpdate.hasUpdate && onOpenUpdates && (
                        <button
                          type="button"
                          onClick={onOpenUpdates}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm cursor-pointer"
                          title={t('updatePack', 'Update mod to latest version')}
                        >
                          <Sparkles size={12} /> {t('update', 'Update')}
                        </button>
                      )}
                      {mod.configPath && (
                        <button
                          onClick={() => handleOpenConfig(mod)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 border border-white/[0.08] active:scale-95 transition-all"
                        >
                          <Settings size={13} /> {t('configure', 'Configure')}
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleMod(mod)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border active:scale-95 transition-all shadow-sm ${
                          mod.enabled 
                            ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30" 
                            : "bg-brand-500/15 hover:bg-brand-500/25 text-brand-300 border-brand-500/30"
                        }`}
                      >
                        <Power size={13} /> {mod.enabled ? t('disablePack', 'Disable') : t('enablePack', 'Enable')}
                      </button>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        onClick={() => Api.openFolder(mod.path)}
                        className="p-1.5 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all active:scale-90"
                        title={t('openInExplorer', 'Open in Explorer')}
                      >
                        <FolderOpen size={15} />
                      </button>
                      <button
                        onClick={() => handleRemoveMod(mod)}
                        className="p-1.5 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all active:scale-90"
                        title={isLoader ? t('deleteLoader', 'Delete Core Loader') : t('deleteMod', 'Delete Mod')}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIP PACKAGE MANAGER */}
      {activeTab === 'lip' && (
        <div className="space-y-6 stagger-settle">
          <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">{t('lipPackageManager', 'LIP Package Manager CLI')}</h2>
                  {lipInstalled ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 size={11} /> {t('installed', 'Installed')} ({lipVersion})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {t('inactive', 'Not Installed')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 max-w-xl">
                  {t('lipManagerDesc', 'LIP (LeviLamina Package Manager) allows executing manual tooth package installs, updates, and custom tooth specifications.')}
                </p>
              </div>

              <div>
                {!lipInstalled ? (
                  <button
                    onClick={handleInstallLip}
                    disabled={installingLip}
                    className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5 active:scale-95"
                  >
                    {installingLip ? <span>{t('loading', 'Installing...')}</span> : <Download size={14} />}
                    {t('installLipBinary', 'Install LIP Binary')}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pkgInput}
                      onChange={(e) => setPkgInput(e.target.value)}
                      placeholder={t('mods.repoPlaceholder', 'e.g. github.com/LiteLDev/LeviOptimize')}
                      className="bg-dark-900 border border-dark-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500 w-64 font-mono"
                    />
                    <button
                      onClick={handleInstallPackage}
                      disabled={installingTooth !== null}
                      className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow active:scale-95"
                    >
                      {installingTooth ? <span>{t('loading', 'Installing...')}</span> : <Download size={13} />}
                      {t('install', 'Install')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Mod Config Modal */}
      {selectedModConfig && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-dark-750">
              <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider">
                {t('configureMod', 'Configure Mod')}: {selectedModConfig.name}
              </h3>
              <button
                onClick={() => setSelectedModConfig(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-dark-800 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-slate-400 font-mono truncate">
              {selectedModConfig.path}
            </p>

            <div className="bg-dark-950 p-3 rounded-lg border border-dark-800">
              <textarea
                rows={12}
                value={JSON.stringify(selectedModConfig.config, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setSelectedModConfig({ ...selectedModConfig, config: parsed });
                  } catch (err) {
                    // let user keep editing text
                  }
                }}
                className="w-full bg-transparent font-mono text-xs text-emerald-400 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedModConfig(null)}
                className="px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={configSaving}
                className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-brand-500/20"
              >
                {configSaving ? t('loading', 'Saving...') : t('saveConfig', 'Save Configuration')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Mods;
