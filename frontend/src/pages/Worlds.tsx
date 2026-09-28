/**
 * @file Worlds.tsx
 * @description Comprehensive Bedrock LevelDB world manager.
 *
 * Core Capabilities:
 * - Scans and enumerates world saves from `worlds/` directory.
 * - Synchronizes active level with `server.properties` (`level-name`).
 * - Edits Bedrock gamerules, difficulty, and spawn configurations.
 * - Re-orders and manages world pack load priority (`world_behavior_packs.json`).
 * - Imports and exports `.mcworld` archives.
 */

import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Plus, 
  FolderOpen, 
  Layers, 
  Archive, 
  RotateCw, 
  HardDrive, 
  Clock, 
  CheckCircle2, 
  Check, 
  Zap, 
  Trash2, 
  Package, 
  Sliders, 
  ShieldAlert, 
  Sparkles,
  Search,
  ExternalLink,
  Settings,
  AlertTriangle,
  Save,
  X,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Moon,
  Sun,
  Leaf,
  Sword,
  Activity,
  Wind,
  Zap as ZapIcon,
  MessageSquareOff,
  ServerCog,
  Gamepad2,
  Compass,
  Network,
  Cpu,
  ShieldCheck,
  Shield,
  Eye,
  Crown,
  User,
  Heart,
  Skull,
  Lock,
  MapPin,
  Flame,
  Terminal,
  CloudRain,
  Hash,
  FileText
} from 'lucide-react';
import { Api } from '../services/api';
import { Server, World, Addon, WorldOptions, WorldPackRecord } from '../types';
import { CustomSelect } from '../components/CustomSelect';
import { useI18n } from '../i18n';

interface WorldsProps {
  server: Server | null;
  worlds: World[];
  onRefreshWorlds: () => Promise<void> | void;
}

export const Worlds: React.FC<WorldsProps> = ({ server, worlds, onRefreshWorlds }) => {
  const { t } = useI18n();
  // World creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [folderName, setFolderName] = useState('');
  const [isFolderAuto, setIsFolderAuto] = useState(true);
  const [gamemode, setGamemode] = useState('survival');
  const [difficulty, setDifficulty] = useState('normal');
  const [seed, setSeed] = useState('');
  const [setActiveNow, setSetActiveNow] = useState(true);
  const [selectedBPs, setSelectedBPs] = useState<Record<string, { uuid: string; version: number[] }>>({});
  const [selectedRPs, setSelectedRPs] = useState<Record<string, { uuid: string; version: number[] }>>({});
  const [creating, setCreating] = useState(false);

  // Available addons
  const [serverAddons, setServerAddons] = useState<Addon[]>([]);
  const [loadingAddons, setLoadingAddons] = useState(false);

  // Active world synchronization state
  const [activeWorldFolder, setActiveWorldFolder] = useState<string>(server?.activeWorld || '');

  useEffect(() => {
    if (server?.activeWorld) {
      setActiveWorldFolder(server.activeWorld);
    }
  }, [server?.activeWorld]);

  // World Options modal state (Aternos-Style)
  const [showWorldOptionsModal, setShowWorldOptionsModal] = useState(false);
  const [optionsWorld, setOptionsWorld] = useState<World | null>(null);
  const [worldOptions, setWorldOptions] = useState<WorldOptions>({
    levelName: '',
    gamemode: 'survival',
    difficulty: 'normal',
    allowCheats: false,
    pvp: true,
    hardcore: false,
    defaultPlayerPermission: 'member',
    showCoordinates: true,
    maxPlayers: 10,
    serverPort: 19132,
    allowList: false,
    viewDistance: 32,
    tickDistance: 4,
    playerIdleTimeout: 30,
    levelSeed: '',
    levelType: 'DEFAULT',
    forceGamemode: false,
    spawnProtectionRadius: 16,
    texturePackRequired: false,
    contentLogFileEnabled: true,
    transport: 'raknet',
    onlineMode: true,
    serverAuthoritativeMovement: 'server-auth',
    compressionThreshold: 1,
    // Extended gamerules
    playersSleepingPercentage: 100,
    mobGriefing: true,
    naturalRegeneration: true,
    keepInventory: false,
    doWeatherCycle: true,
    doDaylightCycle: true,
    randomTickSpeed: 1,
    chatRestriction: 'None',
    clientSideChunkGenerationEnabled: true,
    blockNetworkIdsAreHashes: false,
    serverAuthoritativeBlockBreaking: false,
  });
  const [savingOptions, setSavingOptions] = useState(false);
  const [optionsTab, setOptionsTab] = useState<'gameplay' | 'generation' | 'network' | 'mechanics' | 'addons'>('gameplay');
  // Add-On priority reorder state (local copy within the modal)
  const [reorderBPs, setReorderBPs] = useState<WorldPackRecord[]>([]);
  const [reorderRPs, setReorderRPs] = useState<WorldPackRecord[]>([]);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [draggingBpIdx, setDraggingBpIdx] = useState<number | null>(null);
  const [dragOverBpIdx, setDragOverBpIdx] = useState<number | null>(null);
  const [draggingRpIdx, setDraggingRpIdx] = useState<number | null>(null);
  const [dragOverRpIdx, setDragOverRpIdx] = useState<number | null>(null);
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null);

  // Manage packs modal state
  const [packManagerWorld, setPackManagerWorld] = useState<World | null>(null);
  const [packManagerUpdating, setPackManagerUpdating] = useState<string | null>(null);

  // Delete confirmation
  const [worldToDelete, setWorldToDelete] = useState<World | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Notification toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleOpenWorldOptions = async (w: World) => {
    if (!server) return;
    setOptionsWorld(w);
    setOptionsTab('gameplay');
    try {
      const opts = await Api.getWorldOptions(server.id, w.folder || w.name);
      setWorldOptions(opts);
      setReorderBPs([...(w.behaviorPacks || [])]);
      setReorderRPs([...(w.resourcePacks || [])]);
      setShowWorldOptionsModal(true);
    } catch (err: any) {
      showToast('Failed to load world options: ' + err.message, 'error');
    }
  };

  const isServerRunning = server?.status === 'ONLINE' || server?.status === 'STARTING';

  const handleSaveWorldOptions = async () => {
    if (!server || !optionsWorld) return;
    if (isServerRunning) {
      showToast('Cannot modify world options while server is running. Please stop the server first.', 'error');
      return;
    }
    setSavingOptions(true);
    try {
      await Api.saveWorldOptions(server.id, optionsWorld.folder || optionsWorld.name, worldOptions);
      showToast('World options saved successfully!');
      setShowWorldOptionsModal(false);
      onRefreshWorlds();
    } catch (err: any) {
      showToast('Failed to save world options: ' + err.message, 'error');
    } finally {
      setSavingOptions(false);
    }
  };

  const handleSavePackPriority = async () => {
    if (!server || !optionsWorld) return;
    if (isServerRunning) {
      showToast(t('worlds.stopServerToSaveOptions', 'Stop server to save world options'), 'error');
      return;
    }
    setReorderSaving(true);
    try {
      await Api.reorderWorldPacks(
        server.id,
        optionsWorld.folder || optionsWorld.name,
        reorderBPs,
        reorderRPs
      );
      showToast(t('worlds.prioritySaved', 'Pack priority order saved!'));
      onRefreshWorlds();
    } catch (err: any) {
      showToast("Failed to save pack priority: " + err.message, 'error');
    } finally {
      setReorderSaving(false);
    }
  };

  const movePack = (
    list: WorldPackRecord[],
    setList: React.Dispatch<React.SetStateAction<WorldPackRecord[]>>,
    idx: number,
    dir: -1 | 1
  ) => {
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const newList = [...list];
    const [item] = newList.splice(idx, 1);
    newList.splice(target, 0, item);
    setList(newList);
    if (item?.pack_id) {
      setRecentlyMovedId(item.pack_id);
      setTimeout(() => setRecentlyMovedId(null), 700);
    }
  };

  const handleDragDrop = (
    list: WorldPackRecord[],
    setList: React.Dispatch<React.SetStateAction<WorldPackRecord[]>>,
    fromIdx: number,
    toIdx: number
  ) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= list.length || toIdx >= list.length) return;
    const updated = [...list];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setList(updated);
    if (moved?.pack_id) {
      setRecentlyMovedId(moved.pack_id);
      setTimeout(() => setRecentlyMovedId(null), 700);
    }
  };

  useEffect(() => {
    if (server) {
      loadServerAddons();
    }
  }, [server]);

  const loadServerAddons = async () => {
    if (!server) return;
    setLoadingAddons(true);
    try {
      const list = await Api.listAddons(server.id);
      setServerAddons(list || []);
    } catch (err) {
      console.error("Failed to load addons for worlds:", err);
    } finally {
      setLoadingAddons(false);
    }
  };

  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    if (isFolderAuto) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      setFolderName(slug);
    }
  };

  const toggleCreateBP = (addon: Addon) => {
    const next = { ...selectedBPs };
    if (next[addon.uuid]) {
      delete next[addon.uuid];
    } else {
      const ver = addon.modules?.[0]?.version || [1, 0, 0];
      next[addon.uuid] = { uuid: addon.behaviorUuid || addon.uuid, version: addon.behaviorVersion || ver };
    }
    setSelectedBPs(next);
  };

  const toggleCreateRP = (addon: Addon) => {
    const next = { ...selectedRPs };
    if (next[addon.uuid]) {
      delete next[addon.uuid];
    } else {
      const ver = addon.modules?.[0]?.version || [1, 0, 0];
      next[addon.uuid] = { uuid: addon.resourceUuid || addon.uuid, version: addon.resourceVersion || ver };
    }
    setSelectedRPs(next);
  };

  const toggleCreateWholeAddon = (addon: Addon) => {
    const bpChecked = !!selectedBPs[addon.uuid];
    const rpChecked = !!selectedRPs[addon.uuid];
    const bothChecked = bpChecked && rpChecked;

    const nextBPs = { ...selectedBPs };
    const nextRPs = { ...selectedRPs };

    if (bothChecked) {
      delete nextBPs[addon.uuid];
      delete nextRPs[addon.uuid];
    } else {
      const ver = addon.modules?.[0]?.version || [1, 0, 0];
      if (addon.hasBehaviorPack) {
        nextBPs[addon.uuid] = { uuid: addon.behaviorUuid || addon.uuid, version: addon.behaviorVersion || ver };
      }
      if (addon.hasResourcePack) {
        nextRPs[addon.uuid] = { uuid: addon.resourceUuid || addon.uuid, version: addon.resourceVersion || ver };
      }
    }

    setSelectedBPs(nextBPs);
    setSelectedRPs(nextRPs);
  };

  const handleCreateWorld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server || !folderName.trim()) return;

    setCreating(true);
    try {
      const bpRecords = Object.values(selectedBPs).map(b => ({
        pack_id: b.uuid,
        version: b.version
      }));
      const rpRecords = Object.values(selectedRPs).map(r => ({
        pack_id: r.uuid,
        version: r.version
      }));

      await Api.createWorldWithOptions(server.id, {
        folderName: folderName.trim(),
        displayName: displayName.trim() || folderName.trim(),
        gamemode,
        difficulty,
        seed: seed.trim(),
        setActive: setActiveNow,
        behaviorPacks: bpRecords,
        resourcePacks: rpRecords
      });

      setShowCreateModal(false);
      setFolderName('');
      setDisplayName('');
      setSelectedBPs({});
      setSelectedRPs({});
      onRefreshWorlds();
      showToast(`World '${displayName || folderName}' created and configured successfully!`);
    } catch (err: any) {
      showToast(err.message || "Failed to create world", 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleSetActive = async (world: World) => {
    if (!server) return;
    const targetFolder = world.folder || world.name;
    setActiveWorldFolder(targetFolder);
    try {
      await Api.setActiveWorld(server.id, targetFolder);
      if (onRefreshWorlds) {
        await onRefreshWorlds();
      }
      showToast(`'${world.levelName || targetFolder}' is now the active server world!`);
    } catch (err: any) {
      if (server?.activeWorld) {
        setActiveWorldFolder(server.activeWorld);
      }
      showToast(err.message || "Failed to set active world", 'error');
    }
  };

  const handleDeleteWorld = async () => {
    if (!server || !worldToDelete) return;
    const targetFolder = worldToDelete.folder || worldToDelete.name;
    setDeleting(true);
    try {
      await Api.deleteWorld(server.id, targetFolder);
      setWorldToDelete(null);
      onRefreshWorlds();
      showToast(`World '${worldToDelete.levelName || targetFolder}' removed successfully.`);
    } catch (err: any) {
      showToast(err.message || "Failed to delete world", 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Toggle pack in Manage Packs Modal
  const handleToggleWorldPack = async (addon: Addon, packType: 'behavior' | 'resource', currentlyPlugged: boolean) => {
    if (!server || !packManagerWorld) return;
    const worldFolder = packManagerWorld.folder || packManagerWorld.name;
    const targetUUID = packType === 'behavior' ? (addon.behaviorUuid || addon.uuid) : (addon.resourceUuid || addon.uuid);
    const ver = packType === 'behavior' 
      ? (addon.behaviorVersion || addon.modules[0]?.version || [1, 0, 0]) 
      : (addon.resourceVersion || addon.modules[0]?.version || [1, 0, 0]);
    const key = `${targetUUID}-${packType}`;
    setPackManagerUpdating(key);

    try {
      if (currentlyPlugged) {
        await Api.unassignAddonFromWorld(server.id, worldFolder, packType, targetUUID);
      } else {
        await Api.assignAddonToWorld(server.id, worldFolder, packType, targetUUID, ver);
      }
      // Refresh world list to update state
      await onRefreshWorlds();
      await loadServerAddons();

      // Refresh packManagerWorld view
      const updatedWorlds = await Api.listWorlds(server.id);
      const updatedCurr = (updatedWorlds || []).find(w => (w.folder || w.name) === worldFolder);
      if (updatedCurr) {
        setPackManagerWorld(updatedCurr);
      }
      showToast(`${packType === 'behavior' ? 'Behavior' : 'Resource'} pack ${currentlyPlugged ? 'unplugged from' : 'plugged into'} world.`);
    } catch (err: any) {
      showToast(err.message || "Failed to update pack assignment", 'error');
    } finally {
      setPackManagerUpdating(null);
    }
  };

  // Toggle both Behavior and Resource packs together for whole addon with one button
  const handleToggleWholeAddon = async (addon: Addon, currentlyActive: boolean) => {
    if (!server || !packManagerWorld) return;
    const worldFolder = packManagerWorld.folder || packManagerWorld.name;
    const bpId = addon.behaviorUuid || addon.uuid;
    const rpId = addon.resourceUuid || addon.uuid;
    const bpVer = addon.behaviorVersion || addon.modules?.[0]?.version || [1, 0, 0];
    const rpVer = addon.resourceVersion || addon.modules?.[0]?.version || [1, 0, 0];

    const key = `${addon.uuid}-whole`;
    setPackManagerUpdating(key);

    try {
      if (currentlyActive) {
        if (addon.hasBehaviorPack) {
          await Api.unassignAddonFromWorld(server.id, worldFolder, 'behavior', bpId);
        }
        if (addon.hasResourcePack) {
          await Api.unassignAddonFromWorld(server.id, worldFolder, 'resource', rpId);
        }
      } else {
        if (addon.hasBehaviorPack) {
          await Api.assignAddonToWorld(server.id, worldFolder, 'behavior', bpId, bpVer);
        }
        if (addon.hasResourcePack) {
          await Api.assignAddonToWorld(server.id, worldFolder, 'resource', rpId, rpVer);
        }
      }

      await onRefreshWorlds();
      await loadServerAddons();

      const updatedWorlds = await Api.listWorlds(server.id);
      const updatedCurr = (updatedWorlds || []).find(w => (w.folder || w.name) === worldFolder);
      if (updatedCurr) {
        setPackManagerWorld(updatedCurr);
      }
      showToast(`Add-on '${addon.name}' ${currentlyActive ? 'disabled' : 'enabled'} for this world.`);
    } catch (err: any) {
      showToast(err.message || "Failed to update add-on assignment", 'error');
    } finally {
      setPackManagerUpdating(null);
    }
  };

  // ── Inline options panel: show instead of the worlds list ──────────────
  if (showWorldOptionsModal && optionsWorld) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-dark-900/60 animate-page-enter">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-600 text-emerald-200'
              : 'bg-rose-950/90 border-rose-600 text-rose-200'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-400" /> : <ShieldAlert size={18} className="text-rose-400" />}
            <span className="text-xs font-semibold">{toast.message}</span>
          </div>
        )}

        {/* Panel Header */}
        <div className="px-6 pt-5 pb-4 border-b border-dark-750 bg-dark-900/80 backdrop-blur-md shrink-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 animate-slide-left">
              <button
                type="button"
                onClick={() => setShowWorldOptionsModal(false)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold border border-dark-700 transition-all active:scale-95 group cursor-pointer"
              >
                <ChevronUp size={14} className="ltr:rotate-[-90deg] rtl:rotate-90 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5 transition-transform text-slate-400 group-hover:text-brand-400" />
                <span>{t('backToWorlds', 'Back to Worlds')}</span>
              </button>
              <span className="text-dark-700">|</span>
              <div>
                <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
                  <Settings className="text-brand-500" size={20} />
                  <span>{t('worldOptions', 'World Options')}</span>
                  <span className="text-xs font-mono font-normal text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-lg border border-brand-500/20 lowercase">
                    {optionsWorld.folder || optionsWorld.name}
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('configSubtitle', 'Safe visual editor for level.dat and world options.')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 animate-slide-right">
              {isServerRunning && (
                <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                  <span>{t('worlds.stopServerToSaveOptions', 'Stop server to save world options')}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowWorldOptionsModal(false)}
                className="px-3.5 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold border border-dark-700 transition-all active:scale-95 cursor-pointer"
              >
                {t('cancel', 'Cancel')}
              </button>
              {optionsTab === 'addons' ? (
                <button
                  type="button"
                  disabled={reorderSaving || isServerRunning}
                  onClick={handleSavePackPriority}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-brand-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {reorderSaving ? <RotateCw size={14} className="animate-spin" /> : <Layers size={14} />}
                  <span>{t('worlds.savePriority', 'Save Priority Order')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={savingOptions || isServerRunning}
                  onClick={handleSaveWorldOptions}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-brand-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {savingOptions ? <RotateCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{t('save', 'Save Changes')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Unified Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-dark-900/80 rounded-2xl border border-dark-750/80 backdrop-blur-md animate-slide-down">
            {[
              { id: 'gameplay',   icon: Gamepad2, label: t('generalGameplay',    'Gameplay & Rules') },
              { id: 'generation', icon: Compass,  label: t('worldGeneration',    'World Generation') },
              { id: 'network',    icon: Network,  label: t('networkPerformance', 'Network & Protocol') },
              { id: 'mechanics',  icon: Cpu,      label: t('gameRules',          'Engine & Mechanics') },
              { id: 'addons',     icon: Layers,   label: t('worlds.addonPriorityTab', 'Add-On Priority') },
            ].map(tab => {
              const TabIcon = tab.icon;
              const isActive = optionsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setOptionsTab(tab.id as any)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer outline-none ${
                    isActive
                      ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/25 scale-[1.02]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-dark-800/60'
                  }`}
                >
                  <TabIcon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content (scrollable) */}
        <div key={optionsTab} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300 animate-tab-enter">

          {/* ─── TAB 1: GAMEPLAY & RULES ─── */}
          {optionsTab === 'gameplay' && (
            <div className="space-y-6 w-full max-w-6xl stagger-settle">
              {/* Core Parameters Card */}
              <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Gamepad2 size={15} className="text-brand-500" />
                  {t('generalSettings', 'Core Game Parameters')}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">{t('gamemodeLabel', 'Game Mode')}</label>
                    <CustomSelect
                      value={worldOptions.gamemode}
                      onChange={(val) => setWorldOptions({ ...worldOptions, gamemode: String(val) })}
                      options={[
                        { value: 'survival', label: t('survival', 'Survival') },
                        { value: 'creative', label: t('creative', 'Creative') },
                        { value: 'adventure', label: t('adventure', 'Adventure') },
                      ]}
                      fullWidth
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">{t('difficultyLabel', 'Difficulty')}</label>
                    <CustomSelect
                      value={worldOptions.difficulty}
                      onChange={(val) => setWorldOptions({ ...worldOptions, difficulty: String(val) })}
                      options={[
                        { value: 'peaceful', label: t('peaceful', 'Peaceful') },
                        { value: 'easy', label: t('easy', 'Easy') },
                        { value: 'normal', label: t('normal', 'Normal') },
                        { value: 'hard', label: t('hard', 'Hard') },
                      ]}
                      fullWidth
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">{t('playerPermissions', 'Default Player Role')}</label>
                    <CustomSelect
                      value={worldOptions.defaultPlayerPermission}
                      onChange={(val) => setWorldOptions({ ...worldOptions, defaultPlayerPermission: String(val) })}
                      options={[
                        { value: 'visitor', label: `${t('visitor', 'Visitor')} (${t('worlds.readOnly', 'Read-Only')})` },
                        { value: 'member', label: `${t('member', 'Member')} (${t('worlds.standard', 'Standard')})` },
                        { value: 'operator', label: `${t('operator', 'Operator')} (${t('worlds.admin', 'Admin')})` },
                      ]}
                      fullWidth
                    />
                  </div>
                </div>
              </div>

              {/* Players Sleeping % Card */}
              <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Moon size={15} className="text-brand-500" />
                    {t('worlds.sleepingPercent', 'Players Sleeping Percentage')}
                  </h2>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-900 border border-dark-700 shadow-sm">
                    <span className="text-xs font-mono font-bold text-brand-400">
                      {worldOptions.playersSleepingPercentage ?? 100}%
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {(worldOptions.playersSleepingPercentage ?? 100) === 0
                        ? `(${t('worlds.sleepAny', 'Any Player')})`
                        : (worldOptions.playersSleepingPercentage ?? 100) === 100
                        ? `(${t('worlds.sleepAll', 'All Players')})`
                        : ''}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400">
                  {t('worlds.sleepingPercentDesc', 'Percentage of players that need to sleep to skip the night (0 = any 1 player, 100 = all players)')}
                </p>

                {(() => {
                  const sleepingPct = worldOptions.playersSleepingPercentage ?? 100;
                  return (
                    <>
                      <div className="space-y-3 pt-1">
                        <div className="relative flex items-center">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={sleepingPct}
                            onChange={e => setWorldOptions({ ...worldOptions, playersSleepingPercentage: parseInt(e.target.value) || 0 })}
                            className="custom-slider"
                            style={{
                              '--slider-track': `linear-gradient(to right, rgb(var(--brand-500)) 0%, rgb(var(--brand-500)) ${sleepingPct}%, rgba(255, 255, 255, 0.08) ${sleepingPct}%, rgba(255, 255, 255, 0.08) 100%)`
                            } as React.CSSProperties}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500 font-mono px-1 select-none">
                          {[0, 25, 50, 75, 100].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setWorldOptions({ ...worldOptions, playersSleepingPercentage: val })}
                              className={`hover:text-brand-400 transition-colors cursor-pointer ${
                                sleepingPct === val ? 'text-brand-400 font-bold' : ''
                              }`}
                            >
                              {val}%
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {[
                          { val: 0,   label: t('worlds.sleepAny', '0% — Any Player') },
                          { val: 25,  label: '25%' },
                          { val: 50,  label: '50% — Half' },
                          { val: 100, label: t('worlds.sleepAll', '100% — All Players') },
                        ].map(preset => (
                          <button
                            key={preset.val}
                            type="button"
                            onClick={() => setWorldOptions({ ...worldOptions, playersSleepingPercentage: preset.val })}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                              sleepingPct === preset.val
                                ? 'bg-brand-500 text-slate-950 border-brand-500 font-bold shadow-md shadow-brand-500/20 scale-[1.02]'
                                : 'bg-dark-900 text-slate-400 border-dark-700 hover:border-dark-600 hover:text-slate-200'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Gameplay Rules & Permissions */}
              <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Sword size={15} className="text-brand-500" />
                  {t('generalGameplay', 'Gameplay Rules & Permissions')}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {[
                    { key: 'allowCheats',         label: t('allowCheats', 'Allow Cheats'),                 desc: t('worlds.allowCheatsDesc', 'Enables commands like /gamemode, /tp, /give'),                  def: false, icon: Terminal },
                    { key: 'pvp',                 label: t('pvp', 'Player vs Player (PvP)'),               desc: t('worlds.pvpDesc', 'Allows combat and damage between players'),                            def: true,  icon: Sword },
                    { key: 'hardcore',            label: t('hardcore', 'Hardcore Mode'),                   desc: t('worlds.hardcoreDesc', 'Players become permanent spectators upon death'),                 def: false, icon: Skull },
                    { key: 'forceGamemode',       label: t('forceGamemode', 'Force Gamemode'),             desc: t('worlds.forceGamemodeDesc', 'Forces joining players into world default gamemode'),        def: false, icon: Lock },
                    { key: 'showCoordinates',     label: t('showCoordinates', 'Show Coordinates'),         desc: t('worlds.showCoordsDesc', 'Displays XYZ position on HUD for all players'),                 def: true,  icon: MapPin },
                    { key: 'mobGriefing',         label: t('worlds.mobGriefing', 'Mob Griefing'),          desc: t('worlds.mobGriefingDesc', 'Allow creepers, endermen, and mobs to break blocks'),           def: true,  icon: Flame },
                    { key: 'naturalRegeneration', label: t('worlds.naturalRegen', 'Natural Regeneration'), desc: t('worlds.naturalRegenDesc', 'Players regenerate health naturally over time'),             def: true,  icon: Heart },
                    { key: 'keepInventory',       label: t('worlds.keepInventory', 'Keep Inventory on Death'), desc: t('worlds.keepInventoryDesc', 'Players keep items and experience when they die'),       def: false, icon: Archive },
                  ].map(item => {
                    const IIcon = item.icon;
                    const checked = (worldOptions as any)[item.key] !== undefined ? Boolean((worldOptions as any)[item.key]) : item.def;
                    return (
                      <div
                        key={item.key}
                        onClick={() => setWorldOptions({ ...worldOptions, [item.key]: !checked })}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          checked
                            ? 'bg-dark-900 border-brand-500/50 shadow-sm ring-1 ring-brand-500/20'
                            : 'bg-dark-900/60 border-dark-750 hover:border-dark-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-dark-800 border border-dark-700 shrink-0 ${checked ? 'text-brand-400' : 'text-slate-400'}`}>
                            <IIcon size={16} />
                          </div>
                          <div>
                            <div className={`font-semibold text-xs ${checked ? 'text-slate-100' : 'text-slate-300'}`}>
                              {item.label}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-snug">{item.desc}</div>
                          </div>
                        </div>
                        <div dir="ltr" className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${checked ? 'bg-brand-500' : 'bg-dark-750'}`}>
                          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 2: WORLD GENERATION ─── */}
          {optionsTab === 'generation' && (
            <div className="space-y-6 w-full max-w-6xl stagger-settle">
              <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <FolderOpen size={15} className="text-brand-500" />
                  {t('worldNameLabel', 'World Identity & Level Name')}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">{t('worldNameLabel', 'World Name')}</label>
                    <input
                      type="text"
                      value={worldOptions.levelName}
                      onChange={e => setWorldOptions({ ...worldOptions, levelName: e.target.value })}
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-brand-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      {t('worlds.worldNameDirDesc', 'Changing this renames the world directory and synchronizes server.properties')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">{t('worldSeed', 'World Seed (level-seed)')}</label>
                    <input
                      type="text"
                      placeholder={t('worlds.seedPlaceholder', 'e.g. 123456789 or CustomText')}
                      value={worldOptions.levelSeed || ''}
                      onChange={e => setWorldOptions({ ...worldOptions, levelSeed: e.target.value })}
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      {t('worlds.seedDesc', 'Leave blank for random procedural generation')}
                    </p>
                  </div>
                </div>
              </div>

              {/* World Type */}
              <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Compass size={15} className="text-brand-500" />
                  {t('levelType', 'World Type (level-type)')}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {[
                    { id: 'DEFAULT', label: t('worlds.levelDefault', 'Default'), desc: 'Infinite terrain, biomes, caves', icon: Globe },
                    { id: 'FLAT',    label: t('worlds.levelFlat',    'Flat'),    desc: 'Completely flat bedrock plane', icon: Layers },
                    { id: 'LEGACY',  label: t('worlds.levelLegacy',  'Legacy'),  desc: 'Classic limited boundary world', icon: Archive },
                  ].map(lt => {
                    const LIcon = lt.icon;
                    const isSelected = (worldOptions.levelType || 'DEFAULT').toUpperCase() === lt.id;
                    return (
                      <div
                        key={lt.id}
                        onClick={() => setWorldOptions({ ...worldOptions, levelType: lt.id })}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'bg-dark-900 border-brand-500 shadow-md ring-1 ring-brand-500/30'
                            : 'bg-dark-900/60 border-dark-750 hover:border-dark-700 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <LIcon size={18} className={isSelected ? 'text-brand-400' : 'text-slate-400'} />
                          {isSelected && <Check size={15} className="text-brand-400" />}
                        </div>
                        <div>
                          <div className={`font-bold text-xs ${isSelected ? 'text-slate-100' : 'text-slate-300'}`}>{lt.label}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{lt.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 3: NETWORK & PROTOCOL ─── */}
          {optionsTab === 'network' && (
            <div className="space-y-6 w-full max-w-6xl stagger-settle">
              {/* Transport Protocol */}
              <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-dark-750">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Network size={15} className="text-brand-500" />
                    {t('worlds.transportTitle', 'Network Transport Protocol')}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-500/15 text-brand-400 border border-brand-500/30">
                    {worldOptions.transport === 'nethernet' ? 'NetherNet' : 'RakNet'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div
                    onClick={() => setWorldOptions({ ...worldOptions, transport: 'raknet' })}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      worldOptions.transport !== 'nethernet'
                        ? 'bg-dark-900 border-brand-500 ring-1 ring-brand-500/30 shadow-md'
                        : 'bg-dark-900/60 border-dark-750 hover:border-dark-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-100">RakNet (UDP) — Recommended</span>
                      {worldOptions.transport !== 'nethernet' && <Check size={15} className="text-brand-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {t('worlds.raknetDesc', 'Standard Minecraft Bedrock UDP networking. Works with all Bedrock clients and LAN.')}
                    </p>
                  </div>

                  <div
                    onClick={() => setWorldOptions({ ...worldOptions, transport: 'nethernet' })}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      worldOptions.transport === 'nethernet'
                        ? 'bg-dark-900 border-brand-500 ring-1 ring-brand-500/30 shadow-md'
                        : 'bg-dark-900/60 border-dark-750 hover:border-dark-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-100">NetherNet (WebRTC)</span>
                      {worldOptions.transport === 'nethernet' && <Check size={15} className="text-brand-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {t('worlds.nethernetDesc', 'Experimental WebRTC protocol. May cause connection drops or LAN discovery issues.')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Port & Max Players */}
              <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Sliders size={15} className="text-brand-500" />
                  {t('networkPerformance', 'Connection Limits')}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">{t('portLabel', 'Server Port (IPv4)')}</label>
                    <input
                      type="number"
                      min={1024}
                      max={65535}
                      value={worldOptions.serverPort}
                      onChange={e => setWorldOptions({ ...worldOptions, serverPort: parseInt(e.target.value) || 19132 })}
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Default Bedrock port is 19132</p>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">{t('maxPlayers', 'Max Players')}</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={worldOptions.maxPlayers}
                      onChange={e => setWorldOptions({ ...worldOptions, maxPlayers: parseInt(e.target.value) || 10 })}
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Maximum concurrent connections allowed</p>
                  </div>
                </div>
              </div>

              {/* Online Mode & Whitelist switches */}
              <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <ShieldCheck size={15} className="text-brand-500" />
                  {t('securityAndNetwork', 'Authentication & Access Control')}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  {[
                    { key: 'onlineMode', label: t('onlineMode', 'Online Mode (Xbox Auth)'), desc: t('worlds.onlineModeDesc', 'Authenticates players with Microsoft Xbox Live servers'), def: true, icon: ShieldCheck },
                    { key: 'allowList',  label: t('allowlistEnforced', 'Enforce Whitelist'),  desc: t('worlds.whitelistDesc', 'Only players in allowlist.json can join'),                def: false, icon: Lock },
                  ].map(item => {
                    const IIcon = item.icon;
                    const checked = (worldOptions as any)[item.key] !== undefined ? Boolean((worldOptions as any)[item.key]) : item.def;
                    return (
                      <div
                        key={item.key}
                        onClick={() => setWorldOptions({ ...worldOptions, [item.key]: !checked })}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          checked
                            ? 'bg-dark-900 border-brand-500/50 shadow-sm ring-1 ring-brand-500/20'
                            : 'bg-dark-900/60 border-dark-750 hover:border-dark-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-dark-800 border border-dark-700 shrink-0 ${checked ? 'text-brand-400' : 'text-slate-400'}`}>
                            <IIcon size={16} />
                          </div>
                          <div>
                            <div className={`font-semibold text-xs ${checked ? 'text-slate-100' : 'text-slate-300'}`}>{item.label}</div>
                            <div className="text-[11px] text-slate-400 leading-snug">{item.desc}</div>
                          </div>
                        </div>
                        <div dir="ltr" className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${checked ? 'bg-brand-500' : 'bg-dark-750'}`}>
                          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 4: ENGINE & MECHANICS ─── */}
          {optionsTab === 'mechanics' && (
            <div className="space-y-6 w-full max-w-6xl stagger-settle">
              {/* Group 1: Simulation Limits & World Distances */}
              <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Sliders size={15} className="text-brand-500" />
                  Simulation Limits & World Distances
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">{t('spawnProtection', 'Spawn Protection')}</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={worldOptions.spawnProtectionRadius ?? 16}
                      onChange={e => setWorldOptions({ ...worldOptions, spawnProtectionRadius: parseInt(e.target.value) || 0 })}
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Radius in blocks (0 to disable)</p>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">{t('idleTimeout', 'Idle Timeout')}</label>
                    <input
                      type="number"
                      min={0}
                      max={300}
                      value={worldOptions.playerIdleTimeout}
                      onChange={e => setWorldOptions({ ...worldOptions, playerIdleTimeout: parseInt(e.target.value) || 0 })}
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Minutes before AFK kick (0 = off)</p>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">{t('viewDistance', 'View Distance')}</label>
                    <input
                      type="number"
                      min={4}
                      max={64}
                      value={worldOptions.viewDistance}
                      onChange={e => setWorldOptions({ ...worldOptions, viewDistance: parseInt(e.target.value) || 32 })}
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Client render distance (chunks)</p>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">{t('tickDistance', 'Tick Distance')}</label>
                    <input
                      type="number"
                      min={4}
                      max={12}
                      value={worldOptions.tickDistance}
                      onChange={e => setWorldOptions({ ...worldOptions, tickDistance: parseInt(e.target.value) || 4 })}
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Active simulation radius (chunks)</p>
                  </div>
                </div>
              </div>

              {/* Group 2: Speed & Chat */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-semibold">{t('worlds.randomTickSpeed', 'Random Tick Speed')}</label>
                    <span className="text-xs font-mono font-bold text-brand-400 bg-dark-900 border border-dark-700 px-2 py-0.5 rounded">
                      {worldOptions.randomTickSpeed ?? 1}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{t('worlds.randomTickSpeedDesc', 'Controls how fast blocks like crops and fire spread (default: 1)')}</p>
                  <input
                    type="number"
                    min={0}
                    max={4096}
                    value={worldOptions.randomTickSpeed ?? 1}
                    onChange={e => setWorldOptions({ ...worldOptions, randomTickSpeed: parseInt(e.target.value) || 0 })}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                  />
                  <div className="flex items-center gap-1.5 pt-1">
                    {[
                      { val: 1, label: '1 (Normal)' },
                      { val: 3, label: '3 (Fast)' },
                      { val: 20, label: '20 (Rapid)' },
                    ].map(p => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setWorldOptions({ ...worldOptions, randomTickSpeed: p.val })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 cursor-pointer ${
                          (worldOptions.randomTickSpeed ?? 1) === p.val
                            ? 'bg-brand-500 text-slate-950 border-brand-500 font-bold'
                            : 'bg-dark-900 text-slate-400 border-dark-700 hover:border-dark-600 hover:text-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-3">
                  <label className="block text-slate-300 font-semibold">{t('worlds.chatRestriction', 'Chat Restriction')}</label>
                  <p className="text-[11px] text-slate-400">{t('worlds.chatRestrictionDesc', 'Restrict player chat visibility and messaging')}</p>
                  <CustomSelect
                    value={worldOptions.chatRestriction || 'None'}
                    onChange={val => setWorldOptions({ ...worldOptions, chatRestriction: String(val) })}
                    options={[
                      { value: 'None', label: t('worlds.chatNone', 'None (Standard Chat)') },
                      { value: 'Dropped', label: t('worlds.chatDropped', 'Dropped (Hidden)') },
                      { value: 'Disabled', label: t('worlds.chatDisabled', 'Disabled (Muted)') },
                    ]}
                    fullWidth
                  />
                </div>
              </div>

              {/* Group 3: Simulation & Engine Toggles */}
              <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Cpu size={15} className="text-brand-500" />
                  {t('worlds.experimentalSettings', 'Simulation & World Engine Rules')}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                  {[
                    { key: 'doWeatherCycle',                   label: t('worlds.weatherCycle', 'Weather Cycle'), desc: t('worlds.weatherCycleDesc', 'Enable rain, thunder and snow weather cycles'), def: true, icon: CloudRain },
                    { key: 'doDaylightCycle',                  label: t('worlds.daylightCycle', 'Daylight Cycle'), desc: t('worlds.daylightCycleDesc', 'Enable day/night cycle time progression'), def: true, icon: Sun },
                    { key: 'clientSideChunkGenerationEnabled', label: t('worlds.clientChunkGen', 'Client-Side Chunk Gen'), desc: t('worlds.clientChunkGenDesc', 'Allow clients to generate terrain locally for better performance'), def: true, icon: Cpu },
                    { key: 'blockNetworkIdsAreHashes',         label: t('worlds.blockNetworkHashes', 'Block Network ID Hashes'), desc: t('worlds.blockNetworkHashesDesc', 'Use hash-based block IDs for network traffic (experimental)'), def: false, icon: Hash },
                    { key: 'serverAuthoritativeBlockBreaking', label: t('worlds.serverBlockBreaking', 'Server Auth Block Breaking'), desc: t('worlds.serverBlockBreakingDesc', 'Validate all block breaking events server-side to prevent exploits'), def: false, icon: ShieldCheck },
                    { key: 'texturePackRequired',              label: t('texturepackRequired', 'Require Resource Packs'), desc: t('worlds.texturepackDesc', 'Forces players to accept and download server packs before joining'), def: false, icon: Layers },
                    { key: 'contentLogFileEnabled',            label: t('worlds.contentLogFile', 'Content Log File'), desc: t('worlds.contentLogDesc', 'Writes scripting errors and pack warnings to content log file'), def: true, icon: FileText },
                    { key: 'emitServerTelemetry',              label: t('worlds.serverTelemetry', 'Server Telemetry (Suppress Startup Notice)'), desc: t('worlds.serverTelemetryDesc', 'Enables emit-server-telemetry to silence BDS startup banner (does not boost server performance)'), def: true, icon: Activity },
                  ].map(item => {
                    const IIcon = item.icon;
                    const checked = (worldOptions as any)[item.key] !== undefined ? Boolean((worldOptions as any)[item.key]) : item.def;
                    return (
                      <div
                        key={item.key}
                        onClick={() => setWorldOptions({ ...worldOptions, [item.key]: !checked })}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          checked
                            ? 'bg-dark-900 border-brand-500/50 shadow-sm ring-1 ring-brand-500/20'
                            : 'bg-dark-900/60 border-dark-750 hover:border-dark-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-dark-800 border border-dark-700 shrink-0 ${checked ? 'text-brand-400' : 'text-slate-400'}`}>
                            <IIcon size={16} />
                          </div>
                          <div>
                            <div className={`font-semibold text-xs ${checked ? 'text-slate-100' : 'text-slate-300'}`}>
                              {item.label}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-snug">{item.desc}</div>
                          </div>
                        </div>
                        <div dir="ltr" className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${checked ? 'bg-brand-500' : 'bg-dark-750'}`}>
                          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 5: ADD-ON PRIORITY ─── */}
          {optionsTab === 'addons' && (
            <div className="space-y-6 w-full max-w-6xl stagger-settle">
              <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-dark-750">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Layers size={15} className="text-brand-500" />
                      {t('worlds.addonPriorityTab', 'Add-On Priority & Execution Order')}
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {t('worlds.addonPriorityDesc', 'Use arrows to reorder packs. Higher position = loaded first.')}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-lg border border-brand-500/20">
                    {reorderBPs.length + reorderRPs.length} Packs
                  </span>
                </div>

                {/* Behavior Packs */}
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Package size={15} className="text-brand-400" />
                    <span>{t('worlds.behaviorPackPriority', 'Behavior Pack Load Order')}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({reorderBPs.length})</span>
                  </div>
                  {reorderBPs.length === 0 ? (
                    <div className="p-6 bg-dark-900/60 border border-dark-750 rounded-xl text-center text-slate-500 text-xs">
                      {t('worlds.noBehaviorPacks', 'No behavior packs attached to this world.')}
                    </div>
                  ) : (
                    <div className="space-y-2 stagger-settle">
                      {reorderBPs.map((pack, idx) => {
                        const info = serverAddons.find(a => a.behaviorUuid?.toLowerCase() === pack.pack_id?.toLowerCase() || a.uuid?.toLowerCase() === pack.pack_id?.toLowerCase());
                        const packTitle = pack.name || info?.name || (optionsWorld?.levelName || optionsWorld?.name ? `${optionsWorld?.levelName || optionsWorld?.name} (Behavior Pack)` : pack.pack_id);
                        const isDragging = draggingBpIdx === idx;
                        const isDragOver = dragOverBpIdx === idx;
                        const isRecentlyMoved = recentlyMovedId === pack.pack_id;

                        return (
                          <div
                            key={pack.pack_id}
                            draggable={true}
                            onDragStart={(e) => {
                              setDraggingBpIdx(idx);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              if (dragOverBpIdx !== idx) setDragOverBpIdx(idx);
                            }}
                            onDragLeave={() => {
                              if (dragOverBpIdx === idx) setDragOverBpIdx(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggingBpIdx !== null) {
                                handleDragDrop(reorderBPs, setReorderBPs, draggingBpIdx, idx);
                              }
                              setDraggingBpIdx(null);
                              setDragOverBpIdx(null);
                            }}
                            onDragEnd={() => {
                              setDraggingBpIdx(null);
                              setDragOverBpIdx(null);
                            }}
                            className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-sm border transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
                              isDragging
                                ? 'opacity-40 scale-[0.98] border-brand-500/80 ring-2 ring-brand-500/40 bg-brand-500/5'
                                : isDragOver
                                ? 'border-brand-400 bg-brand-500/15 translate-y-1 shadow-md scale-[1.01]'
                                : isRecentlyMoved
                                ? 'border-brand-500 ring-2 ring-brand-500/40 bg-brand-500/10 scale-[1.01]'
                                : 'bg-dark-900/80 border-dark-750 hover:border-dark-650 hover:bg-dark-850'
                            }`}
                          >
                            <span className="text-xs font-mono text-brand-400 font-bold w-6 text-center shrink-0">#{idx + 1}</span>
                            <div className="p-1 rounded-md text-slate-500 hover:text-brand-400 hover:bg-dark-800 transition-colors shrink-0">
                              <GripVertical size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-xs text-slate-100 truncate">{packTitle}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">{pack.pack_id}</div>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => movePack(reorderBPs, setReorderBPs, idx, -1)}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand-400 hover:bg-dark-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all border border-dark-750 cursor-pointer"
                              >
                                <ChevronUp size={15} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === reorderBPs.length - 1}
                                onClick={() => movePack(reorderBPs, setReorderBPs, idx, 1)}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand-400 hover:bg-dark-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all border border-dark-750 cursor-pointer"
                              >
                                <ChevronDown size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Resource Packs */}
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Layers size={15} className="text-brand-400" />
                    <span>{t('worlds.resourcePackPriority', 'Resource Pack Load Order')}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({reorderRPs.length})</span>
                  </div>
                  {reorderRPs.length === 0 ? (
                    <div className="p-6 bg-dark-900/60 border border-dark-750 rounded-xl text-center text-slate-500 text-xs">
                      {t('worlds.noResourcePacks', 'No resource packs attached to this world.')}
                    </div>
                  ) : (
                    <div className="space-y-2 stagger-settle">
                      {reorderRPs.map((pack, idx) => {
                        const info = serverAddons.find(a => a.resourceUuid?.toLowerCase() === pack.pack_id?.toLowerCase() || a.uuid?.toLowerCase() === pack.pack_id?.toLowerCase());
                        const packTitle = pack.name || info?.name || (optionsWorld?.levelName || optionsWorld?.name ? `${optionsWorld?.levelName || optionsWorld?.name} (Resource Pack)` : pack.pack_id);
                        const isDragging = draggingRpIdx === idx;
                        const isDragOver = dragOverRpIdx === idx;
                        const isRecentlyMoved = recentlyMovedId === pack.pack_id;

                        return (
                          <div
                            key={pack.pack_id}
                            draggable={true}
                            onDragStart={(e) => {
                              setDraggingRpIdx(idx);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              if (dragOverRpIdx !== idx) setDragOverRpIdx(idx);
                            }}
                            onDragLeave={() => {
                              if (dragOverRpIdx === idx) setDragOverRpIdx(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggingRpIdx !== null) {
                                handleDragDrop(reorderRPs, setReorderRPs, draggingRpIdx, idx);
                              }
                              setDraggingRpIdx(null);
                              setDragOverRpIdx(null);
                            }}
                            onDragEnd={() => {
                              setDraggingRpIdx(null);
                              setDragOverRpIdx(null);
                            }}
                            className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-sm border transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
                              isDragging
                                ? 'opacity-40 scale-[0.98] border-brand-500/80 ring-2 ring-brand-500/40 bg-brand-500/5'
                                : isDragOver
                                ? 'border-brand-400 bg-brand-500/15 translate-y-1 shadow-md scale-[1.01]'
                                : isRecentlyMoved
                                ? 'border-brand-500 ring-2 ring-brand-500/40 bg-brand-500/10 scale-[1.01]'
                                : 'bg-dark-900/80 border-dark-750 hover:border-dark-650 hover:bg-dark-850'
                            }`}
                          >
                            <span className="text-xs font-mono text-brand-400 font-bold w-6 text-center shrink-0">#{idx + 1}</span>
                            <div className="p-1 rounded-md text-slate-500 hover:text-brand-400 hover:bg-dark-800 transition-colors shrink-0">
                              <GripVertical size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-xs text-slate-100 truncate">{packTitle}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">{pack.pack_id}</div>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => movePack(reorderRPs, setReorderRPs, idx, -1)}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand-400 hover:bg-dark-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all border border-dark-750 cursor-pointer"
                              >
                                <ChevronUp size={15} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === reorderRPs.length - 1}
                                onClick={() => movePack(reorderRPs, setReorderRPs, idx, 1)}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand-400 hover:bg-dark-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all border border-dark-750 cursor-pointer"
                              >
                                <ChevronDown size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Panel Footer */}
        <div className="px-6 py-4 border-t border-dark-750 bg-dark-900/80 backdrop-blur-md shrink-0 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowWorldOptionsModal(false)}
            className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold active:scale-95 border border-dark-700 transition-colors cursor-pointer"
          >
            {t('cancel', 'Cancel')}
          </button>
          {optionsTab === 'addons' ? (
            <button
              type="button"
              disabled={reorderSaving || isServerRunning}
              onClick={handleSavePackPriority}
              className={`px-5 py-2 rounded-xl font-bold text-xs shadow-md active:scale-95 flex items-center gap-1.5 transition-all cursor-pointer ${
                isServerRunning
                  ? 'bg-dark-750 text-slate-500 cursor-not-allowed border border-dark-700'
                  : 'bg-brand-500 hover:bg-brand-600 text-slate-950 shadow-brand-500/20'
              }`}
            >
              {reorderSaving ? <RotateCw size={14} className="animate-spin" /> : <Layers size={14} />}
              <span>{t('worlds.savePriority', 'Save Priority Order')}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={savingOptions || isServerRunning}
              onClick={handleSaveWorldOptions}
              className={`px-5 py-2 rounded-xl font-bold text-xs shadow-md active:scale-95 flex items-center gap-1.5 transition-all cursor-pointer ${
                isServerRunning
                  ? 'bg-dark-750 text-slate-500 cursor-not-allowed border border-dark-700'
                  : 'bg-brand-500 hover:bg-brand-600 text-slate-950 shadow-brand-500/20'
              }`}
            >
              {savingOptions ? <RotateCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{t('save', 'Save Changes')}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 stagger-settle animate-page-enter">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${
          toast.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-600 text-emerald-200' 
            : 'bg-rose-950/90 border-rose-600 text-rose-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-400" /> : <ShieldAlert size={18} className="text-rose-400" />}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="animate-slide-left">
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <Globe className="text-brand-500" size={22} />
            {t('worldManagerTitle', 'World Management')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('worldManagerSubtitle', 'Create new worlds with pre-plugged Add-ons, switch active levels with 1 click, and manage pack bindings.')}
          </p>
        </div>

        <div className="flex items-center gap-2 animate-slide-right">
          <button
            onClick={() => {
              onRefreshWorlds();
              loadServerAddons();
            }}
            className="p-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700 transition-all shadow-sm"
            title={t('refresh', 'Refresh world records')}
          >
            <RotateCw size={15} />
          </button>
          <button
            onClick={() => {
              loadServerAddons();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-brand-500/20 active:scale-98"
          >
            <Plus size={16} /> {t('createNewWorld', 'Create World')}
          </button>
        </div>
      </div>

      {/* Quick Setup Hint Banner */}
      <div className="bg-gradient-to-r from-brand-950/40 via-dark-850 to-dark-850 border border-brand-500/30 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-500 shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">{t('worlds.bannerTitle', 'Streamlined Add-On & Mod Provisioning')}</div>
            <div className="text-[11px] text-slate-400">
              {t('worlds.bannerDesc', 'Attach Behavior Packs and Resource Packs directly when creating a new world or manage them anytime with the Manage Packs button.')}
            </div>
          </div>
        </div>
        <div className="text-xs font-mono text-brand-400 font-semibold px-3 py-1.5 rounded-lg bg-dark-900/80 border border-dark-750 shrink-0">
          {t('worlds.configuredCount', '{n} Worlds Configured').replace('{n}', String((worlds || []).length))}
        </div>
      </div>

      {/* Worlds Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-settle">
        {(worlds || []).map((w) => {
          const worldFolderName = w.folder || w.name;
          const currentActive = (activeWorldFolder || server?.activeWorld || '').trim().toLowerCase();
          const isActive = currentActive !== ''
            ? (
                worldFolderName.toLowerCase() === currentActive ||
                Boolean(w.name && w.name.toLowerCase() === currentActive) ||
                Boolean(w.levelName && w.levelName.toLowerCase() === currentActive)
              )
            : Boolean(w.isActive);
          const bpCount = (w.behaviorPacks || []).length;
          const rpCount = (w.resourcePacks || []).length;
          const sizeStr = typeof w.sizeMB === 'number' ? w.sizeMB.toFixed(2) : '0.00';
          const dateStr = w.lastModified ? new Date(w.lastModified).toLocaleDateString() : t('date', 'Recent');

          return (
            <div 
              key={worldFolderName}
              className={`bg-dark-850 rounded-2xl border p-5 flex flex-col justify-between space-y-4 transition-all ${
                isActive 
                  ? 'border-brand-500/50 shadow-xl shadow-brand-500/10 ring-1 ring-brand-500/20' 
                  : 'border-dark-750 hover:border-dark-650'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="space-y-0.5">
                    <h2 className="font-bold text-base text-slate-100 flex items-center gap-1.5">
                      {w.levelName || w.name || t('worlds.unnamedWorld', 'Unnamed World')}
                    </h2>
                    <p className="text-[11px] text-slate-400 font-mono">{t('installationFolder', 'Folder:')} {worldFolderName}</p>
                  </div>
                  {isActive ? (
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-brand-500/20 text-brand-400 border border-brand-500/40 flex items-center gap-1 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                      {t('activeWorldBadge', 'Active World')}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetActive(w)}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-dark-750 hover:bg-brand-500 hover:text-slate-950 text-slate-300 border border-dark-700 transition-all flex items-center gap-1"
                      title={t('activateWorld', 'Set this world as the primary server world in server.properties')}
                    >
                      <Zap size={11} /> {t('activateWorld', 'Set Active')}
                    </button>
                  )}
                </div>

                {/* Pack Stats Box */}
                <div className="grid grid-cols-2 gap-2 my-3 text-xs">
                  <div className="bg-dark-900/90 p-2.5 rounded-xl border border-dark-750/70 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                      <Layers size={11} className="text-brand-500" /> {t('behaviorPack', 'Behavior')}
                    </span>
                    <span className="font-bold text-slate-200 mt-1 text-sm">{bpCount} <span className="text-[10px] font-normal text-slate-400">{t('addons', 'packs')}</span></span>
                  </div>
                  <div className="bg-dark-900/90 p-2.5 rounded-xl border border-dark-750/70 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                      <Archive size={11} className="text-cyan-400" /> {t('resourcePack', 'Resource')}
                    </span>
                    <span className="font-bold text-slate-200 mt-1 text-sm">{rpCount} <span className="text-[10px] font-normal text-slate-400">{t('addons', 'packs')}</span></span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span className="flex items-center gap-1"><HardDrive size={13} /> {sizeStr} MB</span>
                  <span className="flex items-center gap-1"><Clock size={13} /> {dateStr}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-dark-750/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      loadServerAddons();
                      setPackManagerWorld(w);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-dark-750 hover:bg-dark-700 text-brand-400 font-semibold text-xs flex items-center gap-1 border border-dark-650 transition-all active:scale-95"
                    title={t('managePacks', 'Plug or unplug installed Add-ons on this world')}
                  >
                    <Sliders size={12} /> {t('managePacks', 'Packs')}
                  </button>

                  <button
                    onClick={() => handleOpenWorldOptions(w)}
                    className="px-2.5 py-1.5 rounded-lg bg-dark-750 hover:bg-dark-700 text-slate-200 font-semibold text-xs flex items-center gap-1 border border-dark-650 transition-all active:scale-95"
                    title={t('worldOptions', 'Configure world gameplay options')}
                  >
                    <Settings size={12} className="text-emerald-400" /> {t('worldOptions', 'Options')}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (server) {
                        Api.openFolder(`${server.path}\\worlds\\${worldFolderName}`);
                      }
                    }}
                    className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs border border-dark-700"
                    title={t('openFolder', 'Open World Folder in File Explorer')}
                  >
                    <FolderOpen size={14} />
                  </button>
                  <button
                    disabled={isActive}
                    onClick={() => setWorldToDelete(w)}
                    className={`p-1.5 rounded-lg text-xs border transition-all ${
                      isActive 
                        ? 'bg-dark-900 text-slate-600 border-dark-800 cursor-not-allowed' 
                        : 'bg-dark-800 hover:bg-rose-950/60 hover:text-rose-400 hover:border-rose-800 text-slate-400 border-dark-700'
                    }`}
                    title={isActive ? t('warning', 'Active world cannot be deleted') : t('deleteWorld', 'Delete world from disk')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= Enhanced Create World Modal ================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleCreateWorld} 
            className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-dark-750 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-500">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider">{t('createNewWorld', 'Create & Configure World')}</h3>
                  <p className="text-[11px] text-slate-400">{t('worlds.createModalDesc', 'Set world parameters and plug installed Add-ons immediately')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* World Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">{t('worldNameLabel', 'Display Name (Level Name) *')}</label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => handleDisplayNameChange(e.target.value)}
                    placeholder="e.g. Survival SMP Season 2"
                    className="w-full bg-dark-850 border border-dark-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-300">{t('worlds.folderIdLabel', 'Folder ID (Disk Identifier) *')}</label>
                    <button
                      type="button"
                      onClick={() => setIsFolderAuto(!isFolderAuto)}
                      className="text-[10px] text-brand-400 hover:underline"
                    >
                      {isFolderAuto ? t('worlds.customFolder', 'Custom Folder') : t('worlds.autoSlug', 'Auto Slug')}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    disabled={isFolderAuto}
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="e.g. survival_smp_2"
                    className={`w-full border rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none ${
                      isFolderAuto 
                        ? 'bg-dark-900 border-dark-800 text-slate-400 cursor-not-allowed' 
                        : 'bg-dark-850 border-dark-700 text-slate-200 focus:border-brand-500'
                    }`}
                  />
                </div>
              </div>

              {/* Game Options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">{t('gamemodeLabel', 'Default Gamemode')}</label>
                  <CustomSelect
                    className="w-full"
                    triggerClassName="w-full py-2.5 bg-dark-850"
                    align="left"
                    value={gamemode}
                    onChange={(val) => setGamemode(String(val))}
                    options={[
                      { value: 'survival', label: t('survival', 'Survival') },
                      { value: 'creative', label: t('creative', 'Creative') },
                      { value: 'adventure', label: t('adventure', 'Adventure') },
                    ]}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">{t('difficultyLabel', 'Difficulty')}</label>
                  <CustomSelect
                    className="w-full"
                    triggerClassName="w-full py-2.5 bg-dark-850"
                    align="left"
                    value={difficulty}
                    onChange={(val) => setDifficulty(String(val))}
                    options={[
                      { value: 'peaceful', label: t('peaceful', 'Peaceful') },
                      { value: 'easy', label: t('easy', 'Easy') },
                      { value: 'normal', label: t('normal', 'Normal') },
                      { value: 'hard', label: t('hard', 'Hard') },
                    ]}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">{t('worldSeed', 'World Seed (Optional)')}</label>
                  <input
                    type="text"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="e.g. 84920491823"
                    className="w-full bg-dark-850 border border-dark-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Set Active Checkbox */}
              <div className="bg-dark-850/80 p-3 rounded-xl border border-dark-750 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">{t('activateWorld', 'Set as Primary Active World')}</div>
                  <div className="text-[11px] text-slate-400">{t('worlds.setActiveDesc', 'Updates server.properties (level-name) immediately on creation')}</div>
                </div>
                <input
                  type="checkbox"
                  checked={setActiveNow}
                  onChange={(e) => setSetActiveNow(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-500 focus:ring-0 cursor-pointer accent-brand-500"
                />
              </div>

              {/* Plug Installed Add-ons */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold uppercase tracking-wider text-[11px] text-slate-300 flex items-center gap-1.5">
                    <Package size={14} className="text-brand-500" /> {t('worlds.plugAddonsTitle', 'Plug Installed Add-ons to this World')}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {t('worlds.packsSelected', '{n} packs selected').replace('{n}', String(Object.keys(selectedBPs).length + Object.keys(selectedRPs).length))}
                  </span>
                </div>

                {(serverAddons || []).length === 0 ? (
                  <div className="p-4 bg-dark-850 border border-dark-750 rounded-xl text-center text-slate-400 text-xs">
                    {t('worlds.noAddonsNotice', 'No Add-ons currently installed on this server. You can install Add-ons anytime from the Add-Ons tab.')}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-52 overflow-y-auto pr-1">
                    {(serverAddons || []).map((addon) => {
                      const bpChecked = !!selectedBPs[addon.uuid];
                      const rpChecked = !!selectedRPs[addon.uuid];

                      return (
                        <div key={addon.uuid} className="bg-dark-850 border border-dark-750 rounded-xl p-3 flex flex-col justify-between gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-slate-200 text-xs truncate max-w-[180px]">{addon.name}</div>
                              <div className="text-[10px] text-slate-400">v{addon.version || "1.0.0"}</div>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-dark-750 text-slate-300 border border-dark-700">
                              {addon.type}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-dark-750/70">
                            {addon.hasBehaviorPack && addon.hasResourcePack ? (
                              <button
                                type="button"
                                onClick={() => toggleCreateWholeAddon(addon)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  bpChecked && rpChecked
                                    ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-sm'
                                    : 'bg-brand-500/20 text-brand-400 border border-brand-500/40 hover:bg-brand-500 hover:text-slate-950'
                                }`}
                              >
                                {bpChecked && rpChecked ? <Check size={12} /> : <Plus size={12} />}
                                <span>{bpChecked && rpChecked ? t('addons.addonActiveBoth', 'Add-On Active (Both)') : t('addons.enableBoth', 'Enable Add-On (Both Packs)')}</span>
                              </button>
                            ) : (
                              <>
                                {addon.hasBehaviorPack && (
                                  <button
                                    type="button"
                                    onClick={() => toggleCreateBP(addon)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                      bpChecked
                                        ? 'bg-brand-500 text-slate-950 font-bold'
                                        : 'bg-dark-750 text-slate-300 hover:bg-dark-700'
                                    }`}
                                  >
                                    {bpChecked && <Check size={10} />} + {t('behaviorPack', 'Behavior')}
                                  </button>
                                )}

                                {addon.hasResourcePack && (
                                  <button
                                    type="button"
                                    onClick={() => toggleCreateRP(addon)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                      rpChecked
                                        ? 'bg-cyan-500 text-slate-950 font-bold'
                                        : 'bg-dark-750 text-slate-300 hover:bg-dark-700'
                                    }`}
                                  >
                                    {rpChecked && <Check size={10} />} + {t('resourcePack', 'Resource')}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-5 border-t border-dark-750 bg-dark-900/60 shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-brand-500/20 active:scale-98"
              >
                {creating ? t('loading', 'Creating & Provisioning...') : t('createWorld', 'Create World Now')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= Manage Packs Modal for Existing World ================= */}
      {/* ================= Manage Packs Modal for Existing World ================= */}
      {packManagerWorld && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-dark-750 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider">
                    {t('managePacks', 'Pack Manager')}: {packManagerWorld.levelName || packManagerWorld.folder || packManagerWorld.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">{t('worlds.packManagerDesc', 'Plug or unplug installed Add-ons directly on this world')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPackManagerWorld(null)}
                className="w-7 h-7 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {(serverAddons || []).length === 0 ? (
                <div className="p-6 bg-dark-850 border border-dark-750 rounded-xl text-center text-slate-400 text-xs">
                  {t('worlds.noAddonsNotice', 'No Add-ons installed on server. Use the Add-ons tab to drop and install packs.')}
                </div>
              ) : (
                (serverAddons || []).map((addon) => {
                  const bpId = addon.behaviorUuid || addon.uuid;
                  const rpId = addon.resourceUuid || addon.uuid;
                  const bpRegistered = (packManagerWorld.behaviorPacks || []).some(
                    (p) => p.pack_id?.toLowerCase() === bpId?.toLowerCase() || p.pack_id?.toLowerCase() === addon.uuid?.toLowerCase()
                  );
                  const rpRegistered = (packManagerWorld.resourcePacks || []).some(
                    (p) => p.pack_id?.toLowerCase() === rpId?.toLowerCase() || p.pack_id?.toLowerCase() === addon.uuid?.toLowerCase()
                  );

                  return (
                    <div key={addon.uuid} className="bg-dark-850 border border-dark-750 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="font-bold text-slate-200 text-xs flex items-center gap-2">
                          {addon.name}
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-dark-750 text-slate-400 font-normal">v{addon.version}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">UUID: {addon.uuid}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {addon.hasBehaviorPack && addon.hasResourcePack ? (
                          <button
                            type="button"
                            disabled={packManagerUpdating === `${addon.uuid}-whole`}
                            onClick={() => handleToggleWholeAddon(addon, bpRegistered && rpRegistered)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 shadow-sm active:scale-95 ${
                              bpRegistered && rpRegistered
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-600'
                                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 border-emerald-500/60'
                            }`}
                            title={bpRegistered && rpRegistered ? t('disablePack', 'Disable whole add-on') : t('enablePack', 'Enable whole add-on')}
                          >
                            {bpRegistered && rpRegistered ? (
                              <>
                                <Check size={13} className="text-emerald-400" />
                                <span>{t('addons.addonActiveBoth', 'Add-On Active')}</span>
                              </>
                            ) : (
                              <>
                                <Plus size={13} />
                                <span>{t('addons.enableBoth', 'Enable Add-On (Both Packs)')}</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <>
                            {addon.hasBehaviorPack && (
                              <button
                                type="button"
                                disabled={packManagerUpdating === `${addon.uuid}-behavior`}
                                onClick={() => handleToggleWorldPack(addon, 'behavior', bpRegistered)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${
                                  bpRegistered
                                    ? 'bg-brand-500/20 text-brand-400 border-brand-500/40 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-600'
                                    : 'bg-dark-800 text-slate-400 border-dark-700 hover:border-brand-500 hover:text-slate-200'
                                }`}
                              >
                                {bpRegistered ? (
                                  <>
                                    <Check size={12} />
                                    <span>{t('behaviorPack', 'Behavior')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus size={12} />
                                    <span>{t('behaviorPack', 'Behavior')}</span>
                                  </>
                                )}
                              </button>
                            )}

                            {addon.hasResourcePack && (
                              <button
                                type="button"
                                disabled={packManagerUpdating === `${addon.uuid}-resource`}
                                onClick={() => handleToggleWorldPack(addon, 'resource', rpRegistered)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${
                                  rpRegistered
                                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-600'
                                    : 'bg-dark-800 text-slate-400 border-dark-700 hover:border-cyan-500 hover:text-slate-200'
                                }`}
                              >
                                {rpRegistered ? (
                                  <>
                                    <Check size={12} />
                                    <span>{t('resourcePack', 'Resource')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus size={12} />
                                    <span>{t('resourcePack', 'Resource')}</span>
                                  </>
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-dark-750 bg-dark-900/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span>{t('worlds.changesImmediate', 'Changes are committed immediately to world configuration files.')}</span>
              <button
                type="button"
                onClick={() => setPackManagerWorld(null)}
                className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 font-semibold"
              >
                {t('close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= Delete Confirmation Modal ================= */}
      {worldToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider">{t('deleteWorldTitle', 'Delete World')}</h3>
                <p className="text-[11px] text-slate-400">{t('deleteWorldConfirm', 'Are you sure you want to delete this world? All chunks, builds, and player inventories in this save will be permanently deleted.')}</p>
              </div>
            </div>

            <div className="bg-dark-850 p-3 rounded-xl border border-dark-750 text-xs text-slate-300">
              <div className="font-bold">{worldToDelete.levelName || worldToDelete.folder || worldToDelete.name}</div>
              <div className="text-slate-400 font-mono text-[11px] mt-0.5">{t('installationFolder', 'Folder:')} worlds/{worldToDelete.folder || worldToDelete.name}</div>
            </div>

            <p className="text-[11px] text-rose-400/90 font-medium">
              {t('worlds.deletePermanentNotice', 'This action permanently removes the world files and pack registrations from disk and cannot be undone.')}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWorldToDelete(null)}
                className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteWorld}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 active:scale-98"
              >
                {deleting ? t('loading', 'Deleting...') : t('confirmDelete', 'Delete Permanently')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
