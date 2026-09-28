/**
 * @file Dashboard.tsx
 * @description Primary server overview view featuring real-time telemetry, quick actions,
 * network connectivity endpoints, and recent console log streaming.
 *
 * Key Capabilities:
 * - Server lifecycle triggers (Start, Stop, Restart, Force Kill).
 * - Real-time CPU, RAM, Uptime, and Player metrics display.
 * - Dynamic IP detection (Local loopback, private LAN IPv4, VPN adapters like Tailscale/Radmin).
 * - Preflight file check status (BDS, LeviLamina modloader, LIP package manager).
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  RotateCw, 
  FolderOpen, 
  Archive, 
  Settings as SettingsIcon, 
  Users, 
  Clock, 
  Cpu, 
  HardDrive, 
  Layers, 
  Terminal,
  Activity,
  Copy,
  Check,
  Gamepad2,
  Zap,
  X,
  CheckCircle2,
  Circle,
  ShieldCheck
} from 'lucide-react';
import { Api } from '../services/api';
import { Server, ServerMetrics, ServerStatus } from '../types';
import { showDialog } from '../components/ModalAlert';
import { useI18n } from '../i18n';

interface DashboardProps {
  server: Server | null;
  metrics: ServerMetrics;
  recentLogs: string[];
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onOpenFolder: () => void;
  onBackupNow: () => void;
  onOpenSettings: () => void;
  onNavigatePage: (page: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  server,
  metrics,
  recentLogs,
  onStart,
  onStop,
  onRestart,
  onOpenFolder,
  onBackupNow,
  onOpenSettings,
  onNavigatePage,
}) => {
  const { t } = useI18n();
  const [setupStatus, setSetupStatus] = useState<{ hasBds: boolean; hasLeviLamina: boolean; hasLip: boolean; isReadyToStart: boolean }>({
    hasBds: true,
    hasLeviLamina: true,
    hasLip: true,
    isReadyToStart: true,
  });
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupRunning, setSetupRunning] = useState(false);
  const [setupProgress, setSetupProgress] = useState<{ step: number; totalSteps: number; percent: number; status: string }>({
    step: 0,
    totalSteps: 4,
    percent: 0,
    status: 'Ready to begin setup',
  });
  const [serverIPs, setServerIPs] = useState<{ local: string; lan: string; vpn?: string }>({ local: '127.0.0.1', lan: '127.0.0.1' });
  const [selectedIPMode, setSelectedIPMode] = useState<'local' | 'vpn' | 'lan'>(() => {
    return (localStorage.getItem('llsm_preferred_ip_mode') as 'local' | 'vpn' | 'lan') || 'local';
  });
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [memoryLimitMB, setMemoryLimitMB] = useState<number>(4096);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [recentLogs]);

  const getDisplayIP = () => {
    if (selectedIPMode === 'vpn' && serverIPs.vpn) return serverIPs.vpn;
    if (selectedIPMode === 'lan' && serverIPs.lan && serverIPs.lan !== '127.0.0.1') return serverIPs.lan;
    return serverIPs.local || '127.0.0.1';
  };
  const activeDisplayIP = getDisplayIP();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddr(label);
    setTimeout(() => setCopiedAddr(null), 2500);
  };

  useEffect(() => {
    Api.getServerIPs().then(setServerIPs).catch(console.error);
  }, []);

  useEffect(() => {
    if (server) {
      checkSetup();
      Api.getServerMemoryLimit(server.id).then(setMemoryLimitMB).catch(console.error);
    }
  }, [server]);

  const handleAdjustMemory = async (deltaMB: number) => {
    if (!server) return;
    const newLimit = Math.max(1024, Math.min(32768, memoryLimitMB + deltaMB));
    setMemoryLimitMB(newLimit);
    try {
      await Api.setServerMemoryLimit(server.id, newLimit);
    } catch (err: any) {
      console.error("Failed to update memory limit:", err);
    }
  };

  useEffect(() => {
    if (window.runtime?.EventsOn) {
      return window.runtime.EventsOn('server:setup_progress', (data: any) => {
        setSetupProgress(data);
      });
    }
  }, []);

  const checkSetup = async () => {
    if (!server) return;
    try {
      const res = await Api.checkServerFiles(server.id);
      setSetupStatus(res);
    } catch (err) {
      // ignore
    }
  };

  const [diagnosingNetwork, setDiagnosingNetwork] = useState(false);

  const handleFixJoinIssues = async () => {
    if (!server) return;
    setDiagnosingNetwork(true);
    try {
      const res = await Api.fixNetworkAndJoinIssues(server.id);
      const fixesSummary = res.fixedIssues && res.fixedIssues.length > 0 
        ? res.fixedIssues.map(f => `• ${f}`).join('\n')
        : 'All settings and network bindings are already in optimal condition.';
      const warningsSummary = res.warnings && res.warnings.length > 0
        ? `\n\nNotices:\n${res.warnings.map(w => `⚠️ ${w}`).join('\n')}`
        : '';
      const lanSummary = res.lanIp 
        ? `\n\n📡 Local LAN IP: ${res.lanIp}:${res.portIpv4 || 19132}\n(Friends on your Wi-Fi/LAN can connect to this IP)` 
        : '';
      const adminNotice = res.isAdmin === false
        ? '\n\nℹ️ Note: Running as standard user. Run as Administrator if Windows Firewall rules need updating.'
        : '';

      showDialog({
        title: 'Network & Join Diagnostics',
        message: `Diagnosis & auto-repair completed!\n\n${fixesSummary}${lanSummary}${warningsSummary}${adminNotice}`,
        type: res.warnings && res.warnings.length > 0 ? 'info' : 'success',
      });
    } catch (err: any) {
      showDialog({
        title: 'Diagnostic Error',
        message: 'Failed to run network diagnostics: ' + err.message,
        type: 'error',
      });
    } finally {
      setDiagnosingNetwork(false);
    }
  };

  const handleStartWithCheck = () => {
    if (!setupStatus.isReadyToStart) {
      setShowSetupModal(true);
      return;
    }
    onStart();
  };

  const handleRunSetup = async () => {
    if (!server) return;
    setSetupRunning(true);
    try {
      await Api.automateServerSetup(server.id);
      await checkSetup();
      alert("Server setup completed successfully! You can now start the server.");
      setShowSetupModal(false);
    } catch (err: any) {
      alert("Setup failed: " + err.message);
    } finally {
      setSetupRunning(false);
    }
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '00:00:00';
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const getStatusBadge = (status: ServerStatus) => {
    switch (status) {
      case 'ONLINE':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> {t('statusOnline', 'ONLINE')}</span>;
      case 'STARTING':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30"><span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> {t('statusStarting', 'STARTING')}</span>;
      case 'STOPPING':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">{t('statusStopping', 'STOPPING')}</span>;
      case 'CRASHED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">{t('statusCrashed', 'CRASHED')}</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">{t('statusOffline', 'OFFLINE')}</span>;
    }
  };

  if (!server) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-dark-850 border border-dark-750 flex items-center justify-center text-brand-500 mb-4 shadow-xl">
          <Activity size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">{t('noServerSelected', 'No Server Selected')}</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          {t('noServerSelectedDesc', 'Create a new LeviLamina Bedrock server or import an existing server instance to start managing it.')}
        </p>
        <button
          onClick={() => onNavigatePage('servers')}
          className="px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-brand-500/20 cursor-pointer"
        >
          {t('manageServers', 'Manage Servers')}
        </button>
      </div>
    );
  }

  const isRunning = metrics.status === 'ONLINE' || metrics.status === 'STARTING';

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 stagger-settle">
      {/* Header Banner - Game Launcher Style */}
      <div className="launcher-card p-7 rounded-2xl relative overflow-hidden border border-white/[0.08] animate-settle">
        {/* Background ambient glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="animate-slide-left">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl font-black tracking-tight text-slate-100 uppercase drop-shadow-sm font-sans">
                {server.name}
              </h1>
              {getStatusBadge(metrics.status)}
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                RakNet BDS
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs mt-3">
              {/* IP Type Selector Pills */}
              <div className="flex items-center p-0.5 rounded-xl bg-dark-900/90 border border-dark-750/70 shadow-inner">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIPMode('local');
                    localStorage.setItem('llsm_preferred_ip_mode', 'local');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    selectedIPMode === 'local'
                      ? 'bg-brand-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={t('dashboard.localIpTitle', 'Connect from Minecraft Bedrock on this PC (127.0.0.1)')}
                >
                  Local (127.0.0.1)
                </button>

                {serverIPs.vpn && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIPMode('vpn');
                      localStorage.setItem('llsm_preferred_ip_mode', 'vpn');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      selectedIPMode === 'vpn'
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title={`${t('dashboard.connectVia', 'Connect via')} Radmin VPN (${serverIPs.vpn})`}
                  >
                    VPN ({serverIPs.vpn})
                  </button>
                )}

                {serverIPs.lan && serverIPs.lan !== '127.0.0.1' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIPMode('lan');
                      localStorage.setItem('llsm_preferred_ip_mode', 'lan');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      selectedIPMode === 'lan'
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title={`${t('dashboard.connectVia', 'Connect via')} Wi-Fi / Local Network (${serverIPs.lan})`}
                  >
                    LAN ({serverIPs.lan})
                  </button>
                )}
              </div>

              {/* Server Address Badge */}
              <div className="flex items-center gap-2 bg-dark-900/90 px-3.5 py-1.5 rounded-xl border border-dark-750/70 shadow-inner font-mono">
                <span className="text-[10px] uppercase font-bold text-slate-400">{t('serverInfo', 'Server Address')}:</span>
                <span className="text-brand-400 font-bold tracking-wide">{activeDisplayIP}</span>
                <span className="text-slate-500">:</span>
                <span className="text-cyan-400 font-bold">{server.port}</span>
              </div>

              {/* Copy IP:Port */}
              <button
                type="button"
                onClick={() => copyToClipboard(`${activeDisplayIP}:${server.port}`, 'ADDR')}
                className="px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 text-xs font-sans font-semibold border border-dark-700/60 transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                title={t('copy', 'Copy')}
              >
                {copiedAddr === 'ADDR' ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span>{t('saved', 'Copied!')}</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} className="text-slate-400" />
                    <span>{t('copy', 'Copy IP:Port')}</span>
                  </>
                )}
              </button>

              {/* Fix Join & Network Issues */}
              <button
                type="button"
                onClick={handleFixJoinIssues}
                disabled={diagnosingNetwork}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 text-xs font-sans font-semibold border border-indigo-500/30 transition-all flex items-center gap-1.5 active:scale-95 shadow-sm disabled:opacity-50 cursor-pointer"
                title={t('dashboard.fixJoinIssuesTitle', 'Automatically fix Windows Firewall, UWP Loopback, and network ports for external & local joins')}
              >
                {diagnosingNetwork ? (
                  <RotateCw size={13} className="animate-spin text-indigo-400" />
                ) : (
                  <ShieldCheck size={13} className="text-indigo-400" />
                )}
                <span>{diagnosingNetwork ? t('dashboard.diagnosing', 'Fixing...') : t('dashboard.fixJoinIssuesBtn', 'Fix Join & Network Issues')}</span>
              </button>

              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-slate-400 font-sans text-xs flex items-center gap-1">
                {t('activeWorldBadge', 'Active World')}: <strong className="text-slate-100 font-mono bg-dark-850 px-2 py-0.5 rounded border border-dark-750/70">{server.activeWorld}</strong>
              </span>
            </div>
          </div>

          {/* Hero Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {!isRunning ? (
              <button
                onClick={handleStartWithCheck}
                className={`launcher-hero-button flex items-center gap-3 px-6 py-3.5 rounded-xl font-black text-sm text-slate-950 uppercase tracking-wider transition-all ${
                  !setupStatus.isReadyToStart
                    ? "!bg-gradient-to-r !from-amber-400 !to-amber-500 text-slate-950 shadow-amber-500/30"
                    : ""
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-slate-950/20 flex items-center justify-center">
                  <Play size={15} className="fill-current ml-0.5" />
                </div>
                {!setupStatus.isReadyToStart ? t('deployingServer', 'Setup & Launch') : t('start', 'Start Server')}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onStop}
                  className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-500/30 active:scale-95"
                >
                  <Square size={14} className="fill-current" /> {t('stop', 'Stop Server')}
                </button>
                <button
                  onClick={onRestart}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-slate-200 font-bold text-xs border border-white/[0.09] transition-all active:scale-95"
                >
                  <RotateCw size={14} /> {t('restart', 'Restart')}
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-dark-950/60 p-1 rounded-xl border border-white/[0.07]">
              <button
                onClick={onOpenFolder}
                className="p-2.5 rounded-lg hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all active:scale-90"
                title={t('openFolder', 'Open Folder')}
              >
                <FolderOpen size={16} />
              </button>
              <button
                onClick={onBackupNow}
                className="p-2.5 rounded-lg hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all active:scale-90"
                title={t('backupNow', 'Backup Now')}
              >
                <Archive size={16} />
              </button>
              <button
                onClick={onOpenSettings}
                className="p-2.5 rounded-lg hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all active:scale-90"
                title={t('configuration', 'Server Configuration')}
              >
                <SettingsIcon size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Required Alert Banner */}
      {!setupStatus.isReadyToStart && (
        <div className="bg-amber-500/10 border border-amber-500/35 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-md">
              <Activity size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                {t('dashboard.setupReadyTitle', 'Automated Installation Ready')}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 max-w-xl leading-relaxed">
                {t('dashboard.setupReadyDesc', 'The Bedrock server binary (bedrock_server.exe) or LeviLamina loader (bedrock_server_mod.exe) has not been placed in this folder yet.')}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowSetupModal(true)}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 flex items-center gap-2 shrink-0 active:scale-95 transition-all"
          >
            <Zap size={14} className="fill-current" />
            <span>{t('dashboard.runAutoSetup', 'Run Automated Setup Now')}</span>
          </button>
        </div>
      )}

      {/* Primary Metrics Grid with Animated Telemetry Gauges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 stagger-settle">
        {/* Minecraft Version */}
        <div 
          onClick={() => onNavigatePage('worlds')}
          className="launcher-card p-4 rounded-xl flex flex-col justify-between cursor-pointer hover:border-cyan-500/50 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
          title={t('dashboard.openWorldMgmt', 'Open World Management')}
        >
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Layers size={14} className="text-cyan-400" /> Minecraft
          </div>
          <div className="text-lg font-black text-slate-100 truncate group-hover:text-cyan-300 transition-colors">
            {server.minecraftVersion || "26.x.x"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> {t('dashboard.bedrockDedicated', 'Bedrock Dedicated')}
            </span>
          </div>
        </div>

        {/* LeviLamina Version */}
        <div 
          onClick={() => onNavigatePage('mods')}
          className="launcher-card p-4 rounded-xl flex flex-col justify-between cursor-pointer hover:border-brand-500/50 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
          title={t('dashboard.openModManager', 'Open LeviLamina Mod Manager')}
        >
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Layers size={14} className="text-brand-400" /> LeviLamina
          </div>
          <div className="text-lg font-black text-slate-100 truncate group-hover:text-brand-300 transition-colors">
            {server.leviLaminaVersion || "Detected"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${server.lipInstalled ? 'bg-brand-400' : 'bg-slate-500'}`}></span>
              {server.lipInstalled ? t('dashboard.lipActive', 'LIP Active') : t('dashboard.noLip', 'No LIP')}
            </span>
          </div>
        </div>

        {/* Players Meter */}
        <div 
          onClick={() => onNavigatePage('players')}
          className="launcher-card p-4 rounded-xl flex flex-col justify-between cursor-pointer hover:border-emerald-500/50 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
          title={t('playerManagerTitle', 'Open Player Management')}
        >
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Users size={14} className="text-emerald-400" /> {t('players', 'Players')}</span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">{metrics.playerCount}/{metrics.maxPlayers || 10}</span>
            </div>
            <div className="text-lg font-black text-slate-100 group-hover:text-emerald-300 transition-colors">
              {metrics.playerCount} <span className="text-xs font-normal text-slate-400">{t('online', 'Online')}</span>
            </div>
          </div>
          <div className="w-full bg-dark-950/80 h-1.5 rounded-full overflow-hidden mt-2 border border-white/[0.05]">
            <div 
              className="bg-emerald-400 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
              style={{ width: `${Math.min(100, (metrics.playerCount / (metrics.maxPlayers || 10)) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Uptime */}
        <div className="launcher-card p-4 rounded-xl flex flex-col justify-between">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Clock size={14} className="text-amber-400" /> Uptime
          </div>
          <div className="text-lg font-black font-mono text-slate-100 truncate">
            {formatUptime(metrics.uptimeSeconds)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{t('active', 'Current Session')}</div>
        </div>

        {/* CPU Meter */}
        <div className="launcher-card p-4 rounded-xl flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Cpu size={14} className="text-cyan-400" /> {t('cpuUsage', 'CPU Load')}</span>
              <span className="text-[10px] text-cyan-300 font-mono font-bold">{metrics.cpuPercent.toFixed(1)}%</span>
            </div>
            <div className="text-lg font-black text-slate-100">
              {metrics.cpuPercent > 0 ? `${metrics.cpuPercent.toFixed(1)}%` : "0.0%"}
            </div>
          </div>
          <div className="w-full bg-dark-950/80 h-1.5 rounded-full overflow-hidden mt-2 border border-white/[0.05]">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                metrics.cpuPercent > 80 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]' :
                metrics.cpuPercent > 50 ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]' :
                'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]'
              }`}
              style={{ width: `${Math.min(100, Math.max(metrics.cpuPercent, 2))}%` }}
            ></div>
          </div>
        </div>

        {/* RAM Meter - Clickable directly into Memory Configuration */}
        <div 
          onClick={() => {
            sessionStorage.setItem('focus_memory', '1');
            onNavigatePage('configuration');
          }}
          className="launcher-card p-4 rounded-xl flex flex-col justify-between cursor-pointer hover:border-purple-500/50 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
          title={t('dedicatedRam', 'Click to open Server Configuration & allocate dedicated RAM')}
        >
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><HardDrive size={14} className="text-purple-400" /> {t('ramUsage', 'Memory')}</span>
              <span className="text-[10px] text-purple-300 font-mono font-bold">{(memoryLimitMB / 1024).toFixed(0)} GB Max</span>
            </div>
            <div className="text-lg font-black text-slate-100 group-hover:text-purple-300 transition-colors">
              {metrics.memoryMB > 0 ? `${metrics.memoryMB.toFixed(0)} MB` : "0 MB"}
              {metrics.memoryMB > 0 && memoryLimitMB > 0 && (
                <span className="text-xs text-purple-300/80 font-normal ml-2 font-mono">
                  ({((metrics.memoryMB / memoryLimitMB) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
            <div className="w-full bg-dark-950/80 h-1.5 rounded-full overflow-hidden mt-1.5 border border-white/[0.05]" dir="ltr">
              <div 
                className="bg-purple-400 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(192,132,252,0.7)]"
                style={{ width: `${Math.min(100, Math.max((metrics.memoryMB / memoryLimitMB) * 100, 2))}%` }}
              ></div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.06] text-[10px] font-bold text-purple-400 group-hover:text-purple-300 transition-colors">
            <span>{t('dedicatedRam', 'Configure RAM')}</span>
          </div>
        </div>
      </div>

      {/* TPS / MSPT Notice & Live Console Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 stagger-settle">
        {/* Quick Console Feed */}
        <div className="lg:col-span-2 launcher-card rounded-2xl p-5 flex flex-col h-[340px] max-h-[340px] min-h-[340px] border border-white/[0.07] overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <Terminal size={17} className="text-brand-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 font-sans">{t('serverConsole', 'Live Console Stream')}</h3>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
            </div>
            <button
              onClick={() => onNavigatePage('console')}
              className="text-xs text-brand-400 hover:text-brand-300 font-bold transition-all"
            >
              {t('console', 'Open Full Terminal')}
            </button>
          </div>

          <div className="flex-1 min-h-0 bg-dark-950/90 p-4 rounded-xl border border-black/40 overflow-y-auto overflow-x-hidden font-mono text-xs text-slate-300 space-y-1 shadow-inner custom-scrollbar">
            {recentLogs.length === 0 ? (
              <div className="text-slate-600 italic py-12 text-center flex flex-col items-center gap-2">
                <Terminal size={24} className="text-slate-700" />
                <span>{t('dashboard.consoleStreamPrompt', 'Console output will stream here in real-time when BDS launches.')}</span>
              </div>
            ) : (
              recentLogs.slice(-30).map((line, idx) => (
                <div key={idx} className="leading-relaxed break-all font-mono hover:bg-white/[0.02] px-1 rounded">
                  {line}
                </div>
              ))
            )}
            <div ref={consoleEndRef} />
          </div>
        </div>

        {/* Server Health / Telemetry Card */}
        <div className="launcher-card rounded-2xl p-5 flex flex-col justify-between border border-white/[0.07] h-[340px] max-h-[340px] min-h-[340px] overflow-hidden">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 mb-4 flex items-center gap-2">
              <Activity size={17} className="text-brand-400" /> {t('dashboard.engineDiagnostics', 'BDS Engine Diagnostics')}
            </h3>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between py-2 border-b border-white/[0.06] text-xs">
                <span className="text-slate-400 font-medium">{t('dashboard.tps', 'Ticks Per Second (TPS)')}</span>
                <span className={`font-mono font-bold px-2 py-0.5 rounded border ${
                  metrics.tps !== null 
                    ? metrics.tps >= 19 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-white/[0.04] text-slate-500 border-white/[0.06]'
                }`}>
                  {metrics.tps !== null ? `${metrics.tps.toFixed(1)} / 20.0` : (metrics.status === 'ONLINE' ? t('dashboard.nominal', '20.0 (Nominal)') : t('dashboard.waitingForBds', 'Waiting for BDS'))}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/[0.06] text-xs">
                <span className="text-slate-400 font-medium">{t('dashboard.mspt', 'Tick Duration (MSPT)')}</span>
                <span className={`font-mono font-bold px-2 py-0.5 rounded border ${
                  metrics.mspt !== null 
                    ? metrics.mspt <= 50 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : 'bg-white/[0.04] text-slate-500 border-white/[0.06]'
                }`}>
                  {metrics.mspt !== null ? `${metrics.mspt.toFixed(1)} ms` : (metrics.status === 'ONLINE' ? t('dashboard.nominalMspt', 'Nominal (< 50 ms)') : t('dashboard.waitingForBds', 'Waiting for BDS'))}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/[0.06] text-xs">
                <span className="text-slate-400 font-medium">{t('dashboard.pid', 'Process PID')}</span>
                <span className="font-mono text-cyan-300 font-bold bg-dark-950/80 px-2 py-0.5 rounded border border-white/[0.06]">
                  {metrics.pid || t('dashboard.none', 'None')}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/[0.06] text-xs">
                <span className="text-slate-400 font-medium">{t('dashboard.autoRestartGuard', 'Auto-Restart Guard')}</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> {t('dashboard.activeCrashGuard', 'Active (Crash Guard)')}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-dark-900/60 border border-dark-750/70 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
            <Activity size={14} className="text-brand-400 shrink-0 mt-0.5" />
            <span>{t('dashboard.metricsNotice', 'Real-time tick metrics are captured directly from BDS engine lag notices & LeviOptimize hooks. Never faked or simulated.')}</span>
          </div>
        </div>
      </div>

      {/* Automated Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="launcher-card border border-white/[0.12] rounded-3xl w-full max-w-lg p-7 shadow-2xl space-y-6 animate-modal-in">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-500/15 border border-brand-500/35 text-brand-400 flex items-center justify-center shadow-md">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100 uppercase tracking-tight">{t('dashboard.autoSetupModalTitle', 'Automated Server Setup')}</h3>
                  <p className="text-xs text-slate-400">{t('dashboard.autoSetupModalSubtitle', 'Download & install BDS and LeviLamina')}</p>
                </div>
              </div>

              {!setupRunning && (
                <button
                  onClick={() => setShowSetupModal(false)}
                  className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 transition-colors"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Steps Visualizer */}
            <div className="space-y-4">
              <div className="bg-dark-850 p-4 rounded-2xl border border-dark-750 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">
                    {setupRunning ? `Step ${setupProgress.step} of ${setupProgress.totalSteps}` : "Setup Steps"}
                  </span>
                  <span className="font-mono text-brand-500 font-bold">{setupProgress.percent}%</span>
                </div>

                <div className="w-full bg-dark-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-brand-500 h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(0,208,132,0.5)]"
                    style={{ width: `${setupProgress.percent}%` }}
                  />
                </div>

                <div className="text-xs font-mono text-brand-400 font-medium">
                  {setupProgress.status}
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  {setupProgress.percent >= 25 ? (
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Circle size={14} className="text-slate-600 shrink-0" />
                  )}
                  <span>{t('dashboard.setupStep1', '1. Download official Minecraft Bedrock Dedicated Server')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {setupProgress.percent >= 50 ? (
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Circle size={14} className="text-slate-600 shrink-0" />
                  )}
                  <span>{t('dashboard.setupStep2', '2. Extract binaries into server directory')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {setupProgress.percent >= 75 ? (
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Circle size={14} className="text-slate-600 shrink-0" />
                  )}
                  <span>{t('dashboard.setupStep3', '3. Download and install LeviLamina mod framework')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {setupProgress.percent >= 100 ? (
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Circle size={14} className="text-slate-600 shrink-0" />
                  )}
                  <span>{t('dashboard.setupStep4', '4. Configure LIP package manager & verify executables')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-dark-750">
              {!setupRunning ? (
                <>
                  <button
                    onClick={() => setShowSetupModal(false)}
                    className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold"
                  >
                    {t('cancel', 'Cancel')}
                  </button>
                  <button
                    onClick={handleRunSetup}
                    className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-brand-500/25 flex items-center gap-2"
                  >
                    <Zap size={14} className="fill-current" />
                    <span>{t('dashboard.startAutoSetup', 'Start Automated Download & Setup')}</span>
                  </button>
                </>
              ) : (
                <div className="text-xs text-brand-500 font-semibold flex items-center gap-2">
                  <RotateCw size={15} className="animate-spin" /> {t('dashboard.processingSetup', 'Processing automated setup, please wait...')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
