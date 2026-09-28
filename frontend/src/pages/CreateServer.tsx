import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  FolderOpen, 
  Play, 
  Server as ServerIcon, 
  RotateCw, 
  AlertTriangle, 
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Cpu,
  Globe,
  Compass,
  ArrowRight
} from 'lucide-react';
import { Api } from '../services/api';
import { Server } from '../types';
import { CustomSelect } from '../components/CustomSelect';
import { useI18n } from '../i18n';

export interface WizardStatus {
  isActive: boolean;
  step: number;
  name: string;
  isInstalling: boolean;
  percent: number;
  statusText: string;
}

interface CreateServerProps {
  isActive: boolean;
  onServerCreated: (server: Server) => void;
  onCancel: () => void;
  onStatusChange?: (status: WizardStatus) => void;
}

export const CreateServer: React.FC<CreateServerProps> = ({ 
  isActive, 
  onServerCreated, 
  onCancel, 
  onStatusChange 
}) => {
  const { t } = useI18n();
  // 1: Configuration, 2: Deployment
  const [phase, setPhase] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [customLocationSet, setCustomLocationSet] = useState(false);
  const [location, setLocation] = useState('');
  const [minecraftVersion, setMinecraftVersion] = useState('Latest (1.21.x)');
  const [leviLaminaVersion, setLeviLaminaVersion] = useState('Latest');
  const [port, setPort] = useState(19132);
  const [worldName, setWorldName] = useState('World');
  const [gamemode, setGamemode] = useState('survival');
  const [difficulty, setDifficulty] = useState('easy');
  const [showAdvancedVersions, setShowAdvancedVersions] = useState(false);

  // Deployment & Progress State
  const [createdServer, setCreatedServer] = useState<Server | null>(null);
  const [setupState, setSetupState] = useState<'pending' | 'installing' | 'completed' | 'failed'>('pending');
  const [setupProgress, setSetupProgress] = useState<{ step: number; totalSteps: number; percent: number; status: string }>({
    step: 1,
    totalSteps: 4,
    percent: 10,
    status: t('setupInProgress', 'Initializing server environment...')
  });
  const [setupError, setSetupError] = useState<string | null>(null);

  // Initialize dynamic defaults (safe path & available port) on mount/activate
  useEffect(() => {
    if (!isActive) return;
    const initDefaults = async () => {
      try {
        const nextPort = await Api.getNextAvailablePort();
        setPort(nextPort);
        if (!customLocationSet && !name) {
          const defLoc = await Api.getDefaultServerLocation('MyServer');
          setLocation(defLoc);
        }
      } catch (err) {
        console.error("Failed to load initial server defaults:", err);
      }
    };
    initDefaults();
  }, [isActive]);

  // Synchronize wizard status for top bar / background tracker
  useEffect(() => {
    if (!isActive) return;
    onStatusChange?.({
      isActive: true,
      step: phase,
      name: name.trim() || 'New Server',
      isInstalling: setupState === 'installing',
      percent: setupProgress.percent,
      statusText: setupProgress.status,
    });
  }, [isActive, phase, name, setupState, setupProgress]);

  // Listen to live setup progress events from backend
  useEffect(() => {
    if (window.runtime?.EventsOn) {
      return window.runtime.EventsOn('server:setup_progress', (data: any) => {
        setSetupProgress(data);
      });
    }
  }, []);

  const sanitizeFolder = (n: string) => {
    return n.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_') || 'Server';
  };

  const handleNameChange = async (val: string) => {
    setName(val);
    if (!customLocationSet) {
      try {
        const defLoc = await Api.getDefaultServerLocation(val.trim() || 'Server');
        setLocation(defLoc);
      } catch {
        setLocation(`C:\\MinecraftServers\\${sanitizeFolder(val)}`);
      }
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await Api.selectFolder();
      if (selected) {
        setCustomLocationSet(true);
        const folder = sanitizeFolder(name || 'Server');
        if (!selected.toLowerCase().endsWith(`\\${folder.toLowerCase()}`) && !selected.toLowerCase().endsWith(`/${folder.toLowerCase()}`)) {
          setLocation(`${selected.replace(/[\\/]+$/, '')}\\${folder}`);
        } else {
          setLocation(selected);
        }
      }
    } catch (err: any) {
      alert("Error selecting folder: " + err.message);
    }
  };

  const runAutomatedSetup = async (srv: Server) => {
    setSetupState('installing');
    setSetupError(null);
    setSetupProgress({
      step: 1,
      totalSteps: 4,
      percent: 15,
      status: t('setupDownloadingDesc', 'Downloading official binaries and configuring your LeviLamina server instance automatically.')
    });

    try {
      await Api.automateServerSetup(srv.id);
      setSetupState('completed');
      setSetupProgress({
        step: 4,
        totalSteps: 4,
        percent: 100,
        status: t('setupDeployedDesc', 'Official Bedrock Dedicated Server, LeviLamina loader, and LIP package manager are fully deployed.')
      });
    } catch (err: any) {
      setSetupState('failed');
      setSetupError(err.message || t('setupIssue', 'Automated setup encountered an issue.'));
    }
  };

  const handleCreateAndDeploy = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const srv = await Api.createServer({
        name: name.trim(),
        location: location.trim(),
        minecraftVersion,
        leviLaminaVersion,
        port,
        worldName: worldName.trim() || 'World',
        gamemode,
        difficulty,
      });
      setCreatedServer(srv);
      setPhase(2);
      runAutomatedSetup(srv);
    } catch (err: any) {
      alert("Failed to create server: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPhase(1);
    setName('');
    setCustomLocationSet(false);
    setLocation('');
    setMinecraftVersion('Latest (1.21.x)');
    setLeviLaminaVersion('Latest');
    setPort(19132);
    setWorldName('World');
    setGamemode('survival');
    setDifficulty('easy');
    setShowAdvancedVersions(false);
    setCreatedServer(null);
    setSetupState('pending');
    setSetupProgress({
      step: 1,
      totalSteps: 4,
      percent: 10,
      status: t('setupInProgress', 'Initializing server environment...')
    });
    setSetupError(null);
    onStatusChange?.({
      isActive: false,
      step: 1,
      name: '',
      isInstalling: false,
      percent: 0,
      statusText: '',
    });
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-center">
      <div className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* PHASE 1: STREAMLINED CONFIGURATION */}
        {phase === 1 && (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateAndDeploy();
            }}
            className="space-y-6 animate-fade-in-up"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-dark-750/70 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse" />
                  <h1 className="text-lg font-bold text-slate-100 uppercase tracking-tight">
                    {t('createLeviServer', 'New LeviLamina Server')}
                  </h1>
                </div>
                <p className="text-xs text-slate-400">
                  {t('createSubtitle', 'Configure and automatically deploy an official Bedrock server with LeviLamina and LIP.')}
                </p>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-mono font-bold">
                <Sparkles size={13} />
                <span>Auto-Deploy</span>
              </div>
            </div>

            {/* Section 1: Server Identity & Directory */}
            <div className="bg-dark-850/80 rounded-xl p-4 border border-dark-750/80 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <ServerIcon size={14} className="text-brand-400" />
                <span>{t('serverIdentity', 'Server Identity & Folder')}</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {t('serverNameLabel', 'Server Name')} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder={t('serverNamePlaceholder', 'e.g. Survival SMP')}
                    className="w-full bg-dark-900 border border-dark-700 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      {t('installPathLabel', 'Installation Directory')}
                    </label>
                    {customLocationSet && (
                      <button
                        type="button"
                        onClick={async () => {
                          setCustomLocationSet(false);
                          const defLoc = await Api.getDefaultServerLocation(name || 'Server');
                          setLocation(defLoc);
                        }}
                        className="text-[10px] text-brand-400 hover:text-brand-300 underline"
                      >
                        {t('resetFolder', 'Reset to default')}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        setCustomLocationSet(true);
                      }}
                      className="flex-1 bg-dark-900 border border-dark-700 focus:border-brand-500 rounded-xl px-4 py-2 text-xs font-mono text-slate-200 focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleSelectFolder}
                      className="px-3.5 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 font-semibold text-xs border border-dark-700 flex items-center gap-1.5 shrink-0 transition-colors active:scale-95"
                    >
                      <FolderOpen size={14} /> {t('browse', 'Browse')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: World & Network */}
            <div className="bg-dark-850/80 rounded-xl p-4 border border-dark-750/80 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Globe size={14} className="text-brand-400" />
                <span>{t('worldAndNetwork', 'World & Network Configuration')}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('portLabel', 'Port (IPv4 UDP)')}
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value) || 19132)}
                    className="w-full bg-dark-900 border border-dark-700 focus:border-brand-500 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Default: 19132</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('worldNameLabel', 'Default World Name')}
                  </label>
                  <input
                    type="text"
                    value={worldName}
                    onChange={(e) => setWorldName(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-700 focus:border-brand-500 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Saved in worlds/{worldName || 'World'}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('gamemodeLabel', 'Game Mode')}
                  </label>
                  <CustomSelect
                    value={gamemode}
                    onChange={(val) => setGamemode(String(val))}
                    options={[
                      { value: 'survival', label: t('survival', 'Survival') },
                      { value: 'creative', label: t('creative', 'Creative') },
                      { value: 'adventure', label: t('adventure', 'Adventure') },
                    ]}
                    fullWidth
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('difficultyLabel', 'Difficulty')}
                  </label>
                  <CustomSelect
                    value={difficulty}
                    onChange={(val) => setDifficulty(String(val))}
                    options={[
                      { value: 'peaceful', label: t('peaceful', 'Peaceful') },
                      { value: 'easy', label: t('easy', 'Easy') },
                      { value: 'normal', label: t('normal', 'Normal') },
                      { value: 'hard', label: t('hard', 'Hard') },
                    ]}
                    fullWidth
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Engine Preset & Advanced Versions */}
            <div className="bg-dark-850/60 rounded-xl p-3.5 border border-dark-750/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className="text-brand-400" />
                  <span className="text-xs font-bold text-slate-200">
                    {t('enginePreset', 'Framework & Engine Preset')}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Latest Stable
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvancedVersions(!showAdvancedVersions)}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <span>{showAdvancedVersions ? t('hideAdvanced', 'Hide Options') : t('customizeVersions', 'Customize')}</span>
                  {showAdvancedVersions ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {showAdvancedVersions && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 mt-3 border-t border-dark-750/70 animate-fade-in-up">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      {t('bdsVersionLabel', 'Bedrock Dedicated Server')}
                    </label>
                    <CustomSelect
                      value={minecraftVersion}
                      onChange={(val) => setMinecraftVersion(String(val))}
                      options={[
                        { value: 'Latest (1.21.x)', label: 'Latest Stable (Recommended)' },
                        { value: '1.21.60', label: '1.21.60' },
                        { value: '1.21.50', label: '1.21.50' },
                        { value: '1.21.40', label: '1.21.40' },
                        { value: '1.21.30', label: '1.21.30' },
                      ]}
                      fullWidth
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      {t('leviVersionLabel', 'LeviLamina Release')}
                    </label>
                    <CustomSelect
                      value={leviLaminaVersion}
                      onChange={(val) => setLeviLaminaVersion(String(val))}
                      options={[
                        { value: 'Latest', label: 'Latest Stable (Recommended)' },
                        { value: 'v1.4.x', label: 'v1.4.x' },
                        { value: 'v1.3.x', label: 'v1.3.x' },
                      ]}
                      fullWidth
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Form Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-dark-750/70">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onCancel();
                }}
                className="px-4 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 font-semibold text-xs transition-colors active:scale-95"
              >
                {t('cancel', 'Cancel')}
              </button>

              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-emerald-500 hover:from-brand-400 hover:to-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-brand-500/20 active:scale-95 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <RotateCw size={14} className="animate-spin" />
                    <span>{t('creatingServer', 'Creating Server...')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('createAndDeploy', 'Create & Deploy Server')}</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* PHASE 2: AUTOMATED PROVISIONING & PROGRESS */}
        {phase === 2 && createdServer && (
          <div className="space-y-6 animate-fade-in-up py-2">
            <div className="text-center">
              <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                setupState === 'completed' 
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : setupState === 'failed'
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  : 'bg-brand-500/15 text-brand-400 border-brand-500/30 animate-pulse'
              }`}>
                {setupState === 'completed' ? t('setupFinished', 'Setup Finished') : setupState === 'failed' ? t('setupIncomplete', 'Setup Incomplete') : t('setupInProgress', 'Automated Installation in Progress')}
              </span>
              <h2 className="text-xl font-black text-slate-100 uppercase tracking-tight mt-2.5">
                {setupState === 'completed' ? t('serverReady', 'Server Ready to Launch') : setupState === 'failed' ? t('setupIssue', 'Setup Encountered an Issue') : t('deployingServer', 'Deploying') + ' ' + createdServer.name}
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {setupState === 'completed'
                  ? t('setupDeployedDesc', 'Official Bedrock Dedicated Server, LeviLamina loader, and LIP package manager are fully deployed.')
                  : setupState === 'failed'
                  ? setupError
                  : t('setupDownloadingDesc', 'Downloading official binaries and configuring your LeviLamina server instance automatically.')}
              </p>
            </div>

            {/* High-Tech Circular Progress Ring */}
            <div className="relative flex flex-col items-center justify-center my-2">
              <div className="absolute w-44 h-44 rounded-full bg-brand-500/10 blur-2xl animate-pulse pointer-events-none" />

              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 drop-shadow-md" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    stroke="currentColor"
                    strokeWidth="7"
                    className="text-dark-800"
                    fill="transparent"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    stroke="currentColor"
                    strokeWidth="7"
                    strokeDasharray={301.6}
                    strokeDashoffset={301.6 - (301.6 * Math.max(5, setupProgress.percent)) / 100}
                    strokeLinecap="round"
                    className={`transition-all duration-500 ease-out ${
                      setupState === 'completed'
                        ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                        : setupState === 'failed'
                        ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]'
                        : 'text-brand-400 drop-shadow-[0_0_10px_rgba(var(--brand-500),0.8)]'
                    }`}
                    fill="transparent"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  {setupState === 'completed' ? (
                    <div className="animate-card-pop flex flex-col items-center">
                      <CheckCircle2 size={40} className="text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
                      <span className="text-[10px] font-mono font-black uppercase tracking-wider text-emerald-400 mt-1">{t('ready', 'Ready')}</span>
                    </div>
                  ) : setupState === 'failed' ? (
                    <div className="animate-card-pop flex flex-col items-center">
                      <AlertTriangle size={38} className="text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]" />
                      <span className="text-[10px] font-mono font-black uppercase tracking-wider text-rose-400 mt-1">{t('failed', 'Failed')}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-black font-mono tracking-tight text-slate-100">
                        {setupProgress.percent}
                        <span className="text-sm text-brand-400 ml-0.5 font-bold">%</span>
                      </span>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Step {setupProgress.step}/4</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Pill */}
              <div className="mt-4 inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-dark-950/80 border border-dark-700/80 shadow-md">
                <span className={`w-2 h-2 rounded-full ${
                  setupState === 'completed' 
                    ? 'bg-emerald-400' 
                    : setupState === 'failed' 
                    ? 'bg-rose-400' 
                    : 'bg-brand-400 animate-pulse'
                }`} />
                <span className="text-xs font-mono font-semibold text-slate-200">
                  {setupProgress.status}
                </span>
              </div>
            </div>

            {/* Installation Steps Checklist Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {[
                { stepNum: 1, percent: 25, label: t('stepDirStructure', '1. Directory Structure') },
                { stepNum: 2, percent: 50, label: t('stepBdsServer', '2. Bedrock Dedicated Server') },
                { stepNum: 3, percent: 75, label: t('stepLeviLoader', '3. LeviLamina Framework') },
                { stepNum: 4, percent: 100, label: t('stepLipWorld', '4. LIP Tool & Default World') },
              ].map(item => {
                const isDone = setupProgress.percent >= item.percent;
                const isCurrent = !isDone && setupProgress.step === item.stepNum;
                return (
                  <div
                    key={item.stepNum}
                    className={`p-3.5 rounded-xl border flex items-center justify-between transition-all duration-300 ${
                      isDone
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-sm'
                        : isCurrent
                        ? 'bg-brand-500/10 border-brand-500/40 text-brand-300 shadow-md shadow-brand-500/10 animate-pulse'
                        : 'bg-dark-850/60 border-dark-750/70 text-slate-500'
                    }`}
                  >
                    <span className="font-semibold">{item.label}</span>
                    {isDone ? (
                      <CheckCircle2 size={16} className="text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]" />
                    ) : isCurrent ? (
                      <RotateCw size={15} className="animate-spin text-brand-400" />
                    ) : (
                      <Clock size={15} className="text-slate-600" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions based on state */}
            {setupState === 'completed' && (
              <div className="pt-2 flex flex-col sm:flex-row gap-3 animate-card-pop">
                <button
                  type="button"
                  onClick={() => {
                    const s = createdServer;
                    resetForm();
                    if (s) onServerCreated(s);
                  }}
                  className="flex-1 py-3.5 rounded-xl launcher-hero-button text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 shadow-xl cursor-pointer"
                >
                  <Play size={16} className="fill-current" />
                  <span>{t('startServerNow', 'Start Server Now')}</span>
                </button>
              </div>
            )}

            {setupState === 'failed' && (
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => runAutomatedSetup(createdServer)}
                  className="px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md active:scale-95 cursor-pointer"
                >
                  <RotateCw size={14} /> {t('retryInstallation', 'Retry Installation')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const s = createdServer;
                    resetForm();
                    if (s) onServerCreated(s);
                  }}
                  className="px-5 py-3 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 font-semibold text-xs active:scale-95 cursor-pointer"
                >
                  {t('proceedToDashboard', 'Proceed to Dashboard')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
