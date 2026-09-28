import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  Terminal, 
  Zap, 
  ShieldCheck, 
  Server as ServerIcon, 
  Trash2, 
  AlertTriangle,
  Palette,
  Sparkles,
  Wifi,
  Sun,
  Moon,
  RotateCw,
  Globe,
  ArrowUpCircle,
  Sliders,
  User,
  Gamepad2,
  Copy,
  Check,
  ExternalLink,
  LogOut
} from 'lucide-react';
import { Api } from '../services/api';
import { AccentColor, ACCENT_PALETTES, applyAccentColor, ThemeMode, applyThemeMode, GuiScale, applyGuiScale } from '../utils/theme';
import { getSafeAvatarUrl, DEFAULT_AVATAR_SVG } from '../utils/avatar';
import { CustomSelect } from '../components/CustomSelect';
import { confirmAction } from '../components/ModalAlert';
import { useI18n, SUPPORTED_LANGUAGES, LanguageCode } from '../i18n';
import { XboxAccount, DeviceAuthResponse, Server } from '../types';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';

interface AppSettings {
  autoRestartOnCrash: boolean;
  maxCrashRetries: number;
  autoBackupOnShutdown: boolean;
  defaultPort: number;
  defaultMaxPlayers: number;
  idleTimeoutMinutes: number;

  autoAcceptEula: boolean;
  llReleaseChannel: 'stable' | 'preview' | 'nightly';
  lipMirror: 'official' | 'ghproxy' | 'custom';
  autoCheckModUpdates: boolean;

  themeMode: ThemeMode;
  accentColor: AccentColor;
  customAccentHex: string;
  guiScale: GuiScale;
  consoleBufferSize: number;
  autoScrollConsole: boolean;
  soundAlerts: boolean;
  glassmorphism: boolean;

  enforceZipSlipProtection: boolean;
  enforceRollbackSnapshots: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  autoRestartOnCrash: true,
  maxCrashRetries: 5,
  autoBackupOnShutdown: false,
  defaultPort: 19132,
  defaultMaxPlayers: 10,
  idleTimeoutMinutes: 30,

  autoAcceptEula: true,
  llReleaseChannel: 'stable',
  lipMirror: 'official',
  autoCheckModUpdates: true,

  themeMode: 'light',
  accentColor: 'emerald',
  customAccentHex: '#00d084',
  guiScale: '100%',
  consoleBufferSize: 1000,
  autoScrollConsole: true,
  soundAlerts: false,
  glassmorphism: true,

  enforceZipSlipProtection: true,
  enforceRollbackSnapshots: true,
};

interface SettingsProps {
  onOpenUpdates?: () => void;
  activeServer?: Server | null;
  onAccountUpdated?: (acc: XboxAccount | null) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onOpenUpdates, activeServer, onAccountUpdated }) => {
  const { lang, setLang, t, isRTL } = useI18n();
  const [activeTab, setActiveTab] = useState<'appearance' | 'account' | 'updates' | 'server' | 'levilamina' | 'security' | 'cleanup'>('appearance');
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateResult, setUpdateResult] = useState<any>(null);
  const [updateStatusText, setUpdateStatusText] = useState<string | null>(null);

  const handleCheckUpdatesNow = async () => {
    setIsCheckingUpdates(true);
    setUpdateStatusText(t('checking', 'Checking for updates...'));
    try {
      const activeServerId = localStorage.getItem('llsm_active_server_id') || '';
      const rep = await Api.checkForUpdates(activeServerId);
      setUpdateResult(rep);
      if (rep && rep.hasUpdates) {
        setUpdateStatusText(`${rep.totalUpdatesCount} ${t('updatesAvailable', 'Updates Available')}`);
      } else {
        setUpdateStatusText(t('allUpdated', 'All components are up to date'));
      }
    } catch (err: any) {
      setUpdateStatusText(t('error', 'Error') + ": " + (err.message || 'Check failed'));
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const localTheme = (localStorage.getItem('llsm_theme_mode') as ThemeMode) || 'light';
      const localAccent = (localStorage.getItem('llsm_accent_color') as AccentColor) || 'emerald';
      const localCustomHex = localStorage.getItem('llsm_custom_accent_hex') || '#00d084';
      const localScale = (localStorage.getItem('llsm_gui_scale') as GuiScale) || '100%';
      return {
        ...DEFAULT_SETTINGS,
        themeMode: localTheme,
        accentColor: localAccent,
        customAccentHex: localCustomHex,
        guiScale: localScale,
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loopbackLoading, setLoopbackLoading] = useState(false);

  // Xbox Account State
  const [xboxAccount, setXboxAccount] = useState<XboxAccount | null>(null);
  const [xboxLoading, setXboxLoading] = useState(false);
  const [xboxAuthStep, setXboxAuthStep] = useState<'idle' | 'device_code' | 'manual'>('idle');
  const [deviceAuth, setDeviceAuth] = useState<DeviceAuthResponse | null>(null);
  const [pollingDevice, setPollingDevice] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [manualTag, setManualTag] = useState('');
  const [opToast, setOpToast] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadXbox();
  }, []);

  const loadXbox = async () => {
    setXboxLoading(true);
    try {
      const acc = await Api.getXboxAccount();
      if (acc && acc.isLoggedIn && acc.gamertag) {
        setXboxAccount(acc);
      } else {
        setXboxAccount(null);
      }
    } catch {
    } finally {
      setXboxLoading(false);
    }
  };

  const handleStartDeviceAuth = async () => {
    setXboxLoading(true);
    setOpToast(null);
    try {
      const auth = await Api.startXboxDeviceAuth();
      setDeviceAuth(auth);
      setXboxAuthStep('device_code');
      setPollingDevice(true);
      if (auth.verificationUri) {
        try {
          if (BrowserOpenURL) {
            BrowserOpenURL(auth.verificationUri);
          } else {
            window.open(auth.verificationUri, '_blank');
          }
        } catch {
          window.open(auth.verificationUri, '_blank');
        }
      }
    } catch (err: any) {
      alert("Failed to start Microsoft authorization: " + err.message);
    } finally {
      setXboxLoading(false);
    }
  };

  useEffect(() => {
    if (!pollingDevice || !deviceAuth?.deviceCode) return;

    const intervalId = setInterval(async () => {
      try {
        const acc = await Api.pollXboxDeviceAuth(deviceAuth.deviceCode);
        if (acc && acc.isLoggedIn) {
          setXboxAccount(acc);
          setPollingDevice(false);
          setXboxAuthStep('idle');
          if (onAccountUpdated) onAccountUpdated(acc);
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('pending')) {
          console.warn("Polling error:", err.message);
        }
      }
    }, (deviceAuth.interval || 5) * 1000);

    return () => clearInterval(intervalId);
  }, [pollingDevice, deviceAuth]);

  const handleManualSaveXbox = async () => {
    const tag = manualTag.trim();
    if (!tag) return;
    setXboxLoading(true);
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
      setXboxAccount(acc);
      setXboxAuthStep('idle');
      if (onAccountUpdated) onAccountUpdated(acc);
    } catch (err: any) {
      alert("Failed to save account: " + err.message);
    } finally {
      setXboxLoading(false);
    }
  };

  const handleLogoutXbox = async () => {
    setXboxLoading(true);
    try {
      await Api.clearXboxAccount();
      setXboxAccount(null);
      setXboxAuthStep('idle');
      setDeviceAuth(null);
      if (onAccountUpdated) onAccountUpdated(null);
    } catch (err: any) {
      alert("Failed to sign out: " + err.message);
    } finally {
      setXboxLoading(false);
    }
  };

  const handleGrantOp = async () => {
    if (!activeServer?.id) {
      alert("Please start or select a server first.");
      return;
    }
    setXboxLoading(true);
    try {
      await Api.addXboxAccountAsOp(activeServer.id);
      setOpToast(`Operator permissions granted to ${xboxAccount?.gamertag}!`);
    } catch (err: any) {
      alert("Failed to grant operator permissions: " + err.message);
    } finally {
      setXboxLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (deviceAuth?.userCode) {
      navigator.clipboard.writeText(deviceAuth.userCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const loadSettings = async () => {
    try {
      const json = await Api.getAppSettings();
      if (json) {
        const parsed = JSON.parse(json);
        setSettings(prev => ({ ...prev, ...parsed }));
        if (parsed.accentColor) {
          applyAccentColor(parsed.accentColor, parsed.customAccentHex);
        }
        if (parsed.themeMode) {
          applyThemeMode(parsed.themeMode);
        }
        if (parsed.guiScale) {
          applyGuiScale(parsed.guiScale);
        }
      }
    } catch (err) {
      console.error("Failed loading app settings from backend:", err);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const handleSelectAccent = (colorKey: AccentColor) => {
    updateSetting('accentColor', colorKey);
    applyAccentColor(colorKey, settings.customAccentHex);
  };

  const handleCustomHexChange = (hex: string) => {
    updateSetting('customAccentHex', hex);
    if (settings.accentColor === 'custom') {
      applyAccentColor('custom', hex);
    }
  };

  const handleSelectMode = (mode: ThemeMode) => {
    updateSetting('themeMode', mode);
    applyThemeMode(mode);
  };

  const handleSelectGuiScale = (scale: GuiScale) => {
    updateSetting('guiScale', scale);
    applyGuiScale(scale);
  };

  const handleSave = async () => {
    try {
      const json = JSON.stringify(settings, null, 2);
      await Api.saveAppSettings(json);
      setDirty(false);
      showToast(t('saved', 'Saved'));
    } catch (err: any) {
      alert("Failed to save settings: " + err.message);
    }
  };

  const handleReset = async () => {
    const confirmed = await confirmAction({
      title: t('resetAllSettings', 'Reset All Settings'),
      message: t('resetAllSettingsDesc', 'Restore all application configuration to factory defaults.'),
      confirmText: t('resetDefaults', 'Reset'),
      cancelText: t('cancel', 'Cancel'),
      isDestructive: true,
    });
    if (confirmed) {
      setSettings(DEFAULT_SETTINGS);
      const json = JSON.stringify(DEFAULT_SETTINGS, null, 2);
      await Api.saveAppSettings(json);
      applyAccentColor('emerald');
      applyThemeMode('light');
      setDirty(false);
      showToast(t('saved', 'Saved'));
    }
  };

  const handleEnableLoopback = async () => {
    setLoopbackLoading(true);
    try {
      if ((window as any).go?.backend?.App?.EnableWindowsLoopbackExemption) {
        const msg = await (window as any).go.backend.App.EnableWindowsLoopbackExemption();
        showToast(msg || t('success', 'Success'));
      } else {
        showToast(t('success', 'Success'));
      }
    } catch (err: any) {
      alert("Failed to register loopback exemption: " + err.message);
    } finally {
      setLoopbackLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-xl bg-dark-900 border border-brand-500/50 text-slate-100 shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 size={18} className="text-brand-400" />
          <span className="text-xs font-semibold">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="animate-slide-left">
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <SettingsIcon className="text-brand-500" size={22} />
            {t('settingsTitle', 'LeviLamina Launcher Settings')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('settingsSubtitle', 'Customize application theme colors, server watchdog behaviors, LIP package mirrors, and security safeguards.')}
          </p>
        </div>

        <div className="flex items-center gap-2 animate-slide-right">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold border border-dark-700 transition-all active:scale-95"
          >
            <RotateCcw size={14} /> {t('resetDefaults', 'Reset')}
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-lg active:scale-95 ${
              dirty 
                ? 'bg-brand-500 hover:bg-brand-600 text-slate-950 shadow-brand-500/25 animate-pulse' 
                : 'bg-dark-750 hover:bg-dark-700 text-slate-200 shadow-dark-900/50'
            }`}
          >
            <Save size={14} /> {dirty ? t('saveChanges', 'Save Changes') : t('saved', 'Saved')}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-dark-900/80 rounded-2xl border border-dark-750/80 backdrop-blur-md animate-slide-down">
        {[
          { id: 'appearance', label: t('themeAndAppearance', 'Theme & Language'), icon: Palette },
          { id: 'account', label: t('xboxAccount', 'Xbox Account'), icon: Gamepad2 },
          { id: 'updates', label: t('checkForUpdates', 'Check for Updates'), icon: RotateCw },
          { id: 'server', label: t('serverWatchdog', 'Server & Watchdog'), icon: ServerIcon },
          { id: 'levilamina', label: t('levilaminaAndLip', 'LeviLamina & LIP'), icon: Zap },
          { id: 'security', label: t('securityAndNetwork', 'Security & Network'), icon: ShieldCheck },
          { id: 'cleanup', label: t('dataAndWipe', 'Data & Wipe'), icon: AlertTriangle },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer outline-none focus:outline-none ${
                isActive
                  ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/25 scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-800/60'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div key={activeTab} className="animate-tab-enter">
        {/* ================= TAB 1: APPEARANCE & CUSTOMIZATION ================= */}
        {activeTab === 'appearance' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-settle">
            {/* Display Language Selection */}
            <div className="bg-dark-850 rounded-2xl border border-dark-750 p-6 space-y-4 lg:col-span-2 relative z-20">
              <div className="flex items-center justify-between pb-3 border-b border-dark-750">
                <div className="flex items-center gap-2.5">
                  <Globe size={18} className="text-brand-500" />
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      {t('language', 'Language')}
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      {t('languageDesc', 'Select the display language for the launcher and server manager.')}
                    </p>
                  </div>
                </div>
                {lang === 'ar' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-500/15 text-brand-400 border border-brand-500/30">
                    Tajawal Font Active
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                    {SUPPORTED_LANGUAGES.find(l => l.code === lang)?.name || 'English'}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-semibold text-xs text-slate-200">{t('selectLanguage', 'Select Language')}</div>
                  <div className="text-[11px] text-slate-400">
                    {t('languageDesc', 'Select the display language for the launcher and server manager.')}
                  </div>
                </div>
                <div className="w-72 sm:w-80">
                  <CustomSelect
                    value={lang}
                    onChange={(val) => setLang(val as LanguageCode)}
                    options={SUPPORTED_LANGUAGES.map((l) => ({
                      value: l.code,
                      label: l.code === 'en' ? 'English (US)' : l.nativeName === l.name ? l.name : `${l.nativeName} (${l.name})`,
                      badge: l.code === 'ar' ? 'Tajawal' : undefined,
                    }))}
                    placement="auto"
                    fullWidth
                  />
                </div>
              </div>
            </div>

            {/* Theme Mode */}
            <div className="bg-dark-850 rounded-2xl border border-dark-750 p-6 space-y-5 lg:col-span-2">
              <div className="flex items-center justify-between pb-3 border-b border-dark-750">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-brand-500" />
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      {t('themeMode', 'Theme Mode')}
                    </h2>
                    <p className="text-[11px] text-slate-400">{t('themeModeDesc', 'Choose between dark mode, light mode, or system default.')}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                  settings.themeMode === 'light' 
                    ? 'bg-amber-400/10 text-amber-500 border-amber-400/30'
                    : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                }`}>
                  {settings.themeMode === 'light' ? t('lightMode', 'Light Mode') : t('darkMode', 'Dark Mode')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Dark Mode Option */}
                <div
                  onClick={() => handleSelectMode('dark')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4 active:scale-95 ${
                    settings.themeMode === 'dark'
                      ? 'bg-dark-900 border-brand-500 shadow-lg shadow-brand-500/10 ring-1 ring-brand-500/40'
                      : 'bg-dark-900/50 border-dark-750 hover:border-dark-600'
                  }`}
                >
                  <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shrink-0">
                    <Moon size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-100">{t('darkMode', 'Dark Mode')}</span>
                      {settings.themeMode === 'dark' && <CheckCircle2 size={15} className="text-brand-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Deep charcoal and black glassmorphism designed for low eye strain and nighttime operations.
                    </p>
                  </div>
                </div>

                {/* Bright Mode Option */}
                <div
                  onClick={() => handleSelectMode('light')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4 active:scale-95 ${
                    settings.themeMode === 'light'
                      ? 'bg-dark-900 border-brand-500 shadow-lg shadow-brand-500/10 ring-1 ring-brand-500/40'
                      : 'bg-dark-900/50 border-dark-750 hover:border-dark-600'
                  }`}
                >
                  <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 shrink-0">
                    <Sun size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-100">{t('lightMode', 'Light Mode')}</span>
                      {settings.themeMode === 'light' && <CheckCircle2 size={15} className="text-brand-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Crisp daylight surfaces, clean white cards, and ultra-readable dark slate text.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Color Palettes */}
            <div className="bg-dark-850 rounded-2xl border border-dark-750 p-6 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-dark-750">
                <Palette size={18} className="text-brand-500" />
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    {t('accentColor', 'Accent Color')}
                  </h2>
                  <p className="text-[11px] text-slate-400">{t('accentColorDesc', 'Select your preferred accent highlight hue across the launcher.')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.values(ACCENT_PALETTES).map((palette) => {
                  const isSelected = settings.accentColor === palette.id;
                  return (
                    <button
                      key={palette.id}
                      onClick={() => handleSelectAccent(palette.id)}
                      className={`p-3 rounded-xl border flex items-center gap-3 transition-all active:scale-95 ${
                        isSelected 
                          ? 'bg-dark-900 border-white/[0.25] shadow-md ring-1 ring-brand-400' 
                          : 'bg-dark-900/50 border-dark-750 hover:border-dark-700'
                      }`}
                    >
                      <span 
                        className="w-5 h-5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: palette.hex500 }}
                      />
                      <span className="font-semibold text-xs text-slate-200 truncate">{palette.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Hex Color Option */}
              <div className="pt-2 border-t border-dark-750">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-5 h-5 rounded-full shrink-0 shadow-sm border border-dark-700"
                      style={{ backgroundColor: settings.customAccentHex || '#00d084' }}
                    />
                    <span className="font-semibold text-xs text-slate-200">{t('customHex', 'Custom Hex')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.customAccentHex || '#00d084'}
                      onChange={(e) => {
                        handleCustomHexChange(e.target.value);
                        handleSelectAccent('custom');
                      }}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={settings.customAccentHex || '#00d084'}
                      onChange={(e) => handleCustomHexChange(e.target.value)}
                      className="w-24 bg-dark-900 border border-dark-700 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Terminal & UX */}
            <div className="bg-dark-850 rounded-2xl border border-dark-750 p-6 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-dark-750">
                <Terminal size={18} className="text-amber-400" />
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    {t('interactiveConsole', 'Interactive Server Console')}
                  </h2>
                  <p className="text-[11px] text-slate-400">{t('settings.terminalUXDesc', 'Buffer sizing, auto-scroll mechanics, and auditory signals')}</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-semibold text-slate-200">{t('settings.consoleBufferCapacity', 'Console Log Buffer Capacity')}</div>
                    <div className="text-slate-400 text-[11px]">{t('settings.consoleBufferCapacityDesc', 'Maximum lines retained in active interactive console memory')}</div>
                  </div>
                  <CustomSelect
                    value={settings.consoleBufferSize}
                    onChange={(val) => updateSetting('consoleBufferSize', Number(val))}
                    options={[
                      { value: 500, label: '500 lines' },
                      { value: 1000, label: '1,000 lines' },
                      { value: 2500, label: '2,500 lines' },
                      { value: 5000, label: '5,000 lines' },
                    ]}
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-t border-dark-750/70">
                  <div>
                    <div className="font-semibold text-slate-200">{t('autoScroll', 'Auto-Scroll')}</div>
                    <div className="text-slate-400 text-[11px]">{t('settings.autoScrollDesc', 'Follow live log lines smoothly in real-time')}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoScrollConsole}
                    onChange={(e) => updateSetting('autoScrollConsole', e.target.checked)}
                    className="w-4 h-4 rounded text-brand-500 focus:ring-0 cursor-pointer accent-brand-500"
                  />
                </div>
              </div>
            </div>

            {/* GUI Size Scale Option */}
            <div className="bg-dark-850 rounded-2xl border border-dark-750 p-6 space-y-5 lg:col-span-2 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-dark-750">
                <div className="flex items-center gap-2">
                  <Sliders size={18} className="text-brand-500" />
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      {t('guiScale', 'GUI Size Scale')}
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      {t('guiScaleDesc', 'Adjust overall application scaling and interface zoom for higher readability or compact displays.')}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-brand-500/15 text-brand-400 border border-brand-500/30">
                  {settings.guiScale || '100%'}
                </span>
              </div>

              {/* Scale Presets */}
              <div className="space-y-4">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {(['75%', '85%', '90%', '100%', '110%', '125%'] as GuiScale[]).map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => handleSelectGuiScale(scale)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer active:scale-95 ${
                        settings.guiScale === scale
                          ? 'bg-brand-500 text-slate-950 border-brand-500 shadow-md shadow-brand-500/20'
                          : 'bg-dark-900 border-dark-700 text-slate-300 hover:border-brand-500/50 hover:bg-dark-800'
                      }`}
                    >
                      {scale === '100%' ? `${scale} (Default)` : scale}
                    </button>
                  ))}
                </div>

                {/* Range Slider */}
                <div className="flex items-center gap-4 pt-2">
                  <span className="text-[11px] font-mono text-slate-400">75%</span>
                  <input
                    type="range"
                    min="75"
                    max="150"
                    step="5"
                    value={parseInt(settings.guiScale || '100')}
                    onChange={(e) => handleSelectGuiScale(`${e.target.value}%` as GuiScale)}
                    className="custom-slider flex-1 cursor-pointer"
                  />
                  <span className="text-[11px] font-mono text-slate-400">150%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB: XBOX ACCOUNT ================= */}
        {activeTab === 'account' && (
          <div className="space-y-6 w-full max-w-6xl stagger-settle">
            <div className="bg-dark-850 rounded-2xl border border-dark-750 p-6 space-y-6 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-dark-750">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Gamepad2 size={22} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
                      Xbox Live & Microsoft Account
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Connect your Xbox gamer profile to verify your identity and easily grant operator privileges.
                    </p>
                  </div>
                </div>

                {xboxAccount?.isLoggedIn && (
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/35">
                    Connected
                  </span>
                )}
              </div>

              {opToast && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in-up">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                  <span>{opToast}</span>
                </div>
              )}

              {/* LOGGED IN ACCOUNT CARD */}
              {xboxAccount && xboxAccount.isLoggedIn ? (
                <div className="space-y-5">
                  <div className="p-5 rounded-2xl bg-dark-900 border border-emerald-500/30 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img 
                          src={getSafeAvatarUrl(xboxAccount.avatarUrl, xboxAccount.gamertag)}
                          alt={xboxAccount.gamertag}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-full object-cover border-2 border-emerald-400 bg-dark-800 shadow-md"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = DEFAULT_AVATAR_SVG(xboxAccount.gamertag?.[0] || 'X');
                          }}
                        />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 shadow-sm" title="Connected">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">
                            {xboxAccount.gamertag}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/35">
                            Verified
                          </span>
                        </div>
                        {xboxAccount.xuid && (
                          <div className="text-xs text-slate-400 mt-0.5 font-mono">
                            XUID: <span className="text-slate-200">{xboxAccount.xuid}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 mt-0.5 capitalize">
                          Account Source: {xboxAccount.source || 'Xbox Live'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleGrantOp}
                        disabled={xboxLoading}
                        className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-brand-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <ShieldCheck size={16} />
                        Grant Operator (OP) on Server
                      </button>

                      <button
                        onClick={handleLogoutXbox}
                        disabled={xboxLoading}
                        className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <LogOut size={14} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* SIGN-IN OPTIONS */
                <div className="space-y-4">
                  {xboxAuthStep === 'device_code' && deviceAuth ? (
                    <div className="p-6 rounded-2xl bg-dark-900 border border-emerald-500/30 text-center space-y-4 animate-spring-pop">
                      <div className="text-xs text-slate-400">
                        To sign in with Microsoft, enter the authorization code below:
                      </div>

                      <div className="flex items-center justify-center gap-2">
                        <div className="text-3xl font-black font-mono tracking-widest text-emerald-400 bg-dark-800 px-6 py-3 rounded-2xl border border-emerald-500/40 select-all shadow-inner">
                          {deviceAuth.userCode}
                        </div>
                        <button
                          onClick={handleCopyCode}
                          className="p-3.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 border border-white/[0.08] transition-all cursor-pointer active:scale-95 shadow-sm"
                          title="Copy Code"
                        >
                          {copiedCode ? <Check size={20} className="text-emerald-400" /> : <Copy size={20} />}
                        </button>
                      </div>

                      <div className="flex items-center justify-center gap-2 text-xs text-brand-400">
                        <RotateCw size={14} className="animate-spin" />
                        <span>Awaiting authorization from microsoft.com/devicelogin...</span>
                      </div>

                      <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                          onClick={() => {
                            if (deviceAuth.verificationUri) {
                              try {
                                if (BrowserOpenURL) BrowserOpenURL(deviceAuth.verificationUri);
                                else window.open(deviceAuth.verificationUri, '_blank');
                              } catch { window.open(deviceAuth.verificationUri, '_blank'); }
                            }
                          }}
                          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer"
                        >
                          Open Microsoft Login Page <ExternalLink size={14} />
                        </button>
                        <button
                          onClick={() => { setXboxAuthStep('idle'); setPollingDevice(false); }}
                          className="px-4 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold border border-white/[0.08]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : xboxAuthStep === 'manual' ? (
                    <div className="p-5 rounded-2xl bg-dark-900 border border-dark-750 space-y-4 animate-spring-pop">
                      <div>
                        <label className="text-xs font-bold text-slate-200 block mb-1.5">
                          Minecraft Xbox Gamertag
                        </label>
                        <input
                          type="text"
                          value={manualTag}
                          onChange={e => setManualTag(e.target.value)}
                          placeholder="e.g. Steve"
                          className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand-500"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleManualSaveXbox}
                          disabled={!manualTag.trim() || xboxLoading}
                          className="py-2.5 px-5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
                        >
                          Save Account
                        </button>
                        <button
                          onClick={() => setXboxAuthStep('idle')}
                          className="py-2.5 px-4 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold border border-white/[0.08]"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      {/* Option 2: Microsoft Device Flow */}
                      <div 
                        onClick={handleStartDeviceAuth}
                        className="p-5 rounded-2xl bg-dark-900 hover:bg-dark-800 border border-white/[0.08] hover:border-white/[0.2] cursor-pointer transition-all space-y-3 group shadow-sm active:scale-95"
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                          <ExternalLink size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white group-hover:text-blue-300 transition-colors">
                            Microsoft Sign-In
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                            Sign in through Microsoft's official device authentication portal.
                          </div>
                        </div>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          Official OAuth
                        </span>
                      </div>

                      {/* Option 3: Manual Entry */}
                      <div 
                        onClick={() => setXboxAuthStep('manual')}
                        className="p-5 rounded-2xl bg-dark-900 hover:bg-dark-800 border border-white/[0.08] hover:border-white/[0.2] cursor-pointer transition-all space-y-3 group shadow-sm active:scale-95"
                      >
                        <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                          <User size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors">
                            Manual Gamertag
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                            Set an offline or custom Minecraft Bedrock gamertag manually.
                          </div>
                        </div>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                          Offline / Custom
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: UPDATES CENTER ================= */}
        {activeTab === 'updates' && (
          <div className="space-y-6 w-full max-w-6xl stagger-settle">
            <div className="bg-dark-850 rounded-2xl border border-dark-750 p-6 space-y-6 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-dark-750">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400">
                    <RotateCw size={20} className={isCheckingUpdates ? "animate-spin" : ""} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
                        {t('checkUpdatesTitle', 'Check for Updates')}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-500/20 text-brand-400 border border-brand-500/35">
                        v2.0.0
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {t('checkUpdatesDesc', 'Verify and install latest updates for LeviLamina, LIP, and installed packages.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCheckUpdatesNow}
                    disabled={isCheckingUpdates}
                    className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-brand-500/20 active:scale-95 cursor-pointer"
                  >
                    <RotateCw size={14} className={isCheckingUpdates ? "animate-spin" : ""} />
                    {isCheckingUpdates ? t('checking', 'Checking for updates...') : t('checkUpdates', 'Check for Updates')}
                  </button>
                  {onOpenUpdates && (
                    <button
                      type="button"
                      onClick={onOpenUpdates}
                      className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 border border-dark-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      <ArrowUpCircle size={14} className="text-brand-400" />
                      {t('updates', 'Updates')}
                    </button>
                  )}
                </div>
              </div>

              {/* Status Banner */}
              {updateStatusText && (
                <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
                  updateResult?.hasUpdates 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}>
                  <div className="flex items-center gap-2.5">
                    {updateResult?.hasUpdates ? (
                      <ArrowUpCircle size={18} className="text-amber-400 shrink-0" />
                    ) : (
                      <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                    )}
                    <span className="text-xs font-semibold">{updateStatusText}</span>
                  </div>
                  {updateResult?.hasUpdates && onOpenUpdates && (
                    <button
                      onClick={onOpenUpdates}
                      className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-all shadow-sm shrink-0 active:scale-95"
                    >
                      {t('updateAvailable', 'Update Available')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: SERVER & WATCHDOG ================= */}
        {activeTab === 'server' && (
          <div className="bg-dark-850 rounded-2xl border border-dark-750 p-6 space-y-5 w-full max-w-6xl animate-settle">
            <div className="flex items-center gap-2 pb-3 border-b border-dark-750">
              <ServerIcon size={18} className="text-brand-500" />
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  {t('serverWatchdogTitle', 'Server & Watchdog Settings')}
                </h2>
                <p className="text-[11px] text-slate-400">{t('serverWatchdogDesc', 'Configure crash detection, auto-restart, and port defaults.')}</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-semibold text-slate-200">{t('autoRestartCrash', 'Auto-Restart on Crash')}</div>
                  <div className="text-slate-400 text-[11px]">{t('autoRestartCrashDesc', 'Automatically relaunch the server if the BDS or LeviLamina process terminates unexpectedly.')}</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoRestartOnCrash}
                  onChange={(e) => updateSetting('autoRestartOnCrash', e.target.checked)}
                  className="w-4 h-4 rounded text-brand-500 focus:ring-0 cursor-pointer accent-brand-500"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-dark-750/70">
                <div>
                  <div className="font-semibold text-slate-200">{t('maxCrashRetries', 'Max Crash Retries')}</div>
                  <div className="text-slate-400 text-[11px]">{t('settings.maxCrashRetriesDesc', 'Prevents rapid loop cycles if BDS crashes continuously within 60 seconds')}</div>
                </div>
                <CustomSelect
                  value={settings.maxCrashRetries}
                  onChange={(val) => updateSetting('maxCrashRetries', Number(val))}
                  options={[
                    { value: 3, label: '3' },
                    { value: 5, label: '5' },
                    { value: 10, label: '10' },
                  ]}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-dark-750/70">
                <div>
                  <div className="font-semibold text-slate-200">{t('autoOnShutdown', 'Backup on Server Shutdown')}</div>
                  <div className="text-slate-400 text-[11px]">{t('settings.autoBackupShutdownDesc', 'Captures a compressed world snapshot whenever the server process stops')}</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoBackupOnShutdown}
                  onChange={(e) => updateSetting('autoBackupOnShutdown', e.target.checked)}
                  className="w-4 h-4 rounded text-brand-500 focus:ring-0 cursor-pointer accent-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dark-750/70">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">{t('defaultPort', 'Default Server Port')}</label>
                  <input
                    type="number"
                    value={settings.defaultPort}
                    onChange={(e) => updateSetting('defaultPort', parseInt(e.target.value) || 19132)}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">{t('maxPlayers', 'Max Players')}</label>
                  <input
                    type="number"
                    value={settings.defaultMaxPlayers}
                    onChange={(e) => updateSetting('defaultMaxPlayers', parseInt(e.target.value) || 10)}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: LEVILAMINA & LIP ================= */}
        {activeTab === 'levilamina' && (
          <div className="bg-dark-850 rounded-2xl border border-dark-750 p-6 space-y-5 w-full max-w-6xl animate-settle">
            <div className="flex items-center gap-2 pb-3 border-b border-dark-750">
              <Zap size={18} className="text-cyan-400" />
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  {t('leviLipTitle', 'LeviLamina & LIP Settings')}
                </h2>
                <p className="text-[11px] text-slate-400">{t('leviLipDesc', 'Configure package registry mirrors, release channels, and update policies.')}</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-semibold text-slate-200">{t('autoAcceptEula', 'Auto-Accept Minecraft BDS EULA')}</div>
                  <div className="text-slate-400 text-[11px]">{t('autoAcceptEulaDesc', 'Automatically agree to Mojang EULA when provisioning new instances.')}</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoAcceptEula}
                  onChange={(e) => updateSetting('autoAcceptEula', e.target.checked)}
                  className="w-4 h-4 rounded text-brand-500 focus:ring-0 cursor-pointer accent-brand-500"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-dark-750/70">
                <div>
                  <div className="font-semibold text-slate-200">{t('releaseChannel', 'LeviLamina Release Channel')}</div>
                  <div className="text-slate-400 text-[11px]">{t('settings.releaseChannelDesc', 'Release stream checked when discovering LeviLamina core versions')}</div>
                </div>
                <CustomSelect
                  value={settings.llReleaseChannel}
                  onChange={(val) => updateSetting('llReleaseChannel', val as any)}
                  options={[
                    { value: 'stable', label: 'Stable' },
                    { value: 'preview', label: 'Preview' },
                    { value: 'nightly', label: 'Nightly' },
                  ]}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-dark-750/70">
                <div>
                  <div className="font-semibold text-slate-200">{t('lipMirror', 'LIP Package Mirror')}</div>
                  <div className="text-slate-400 text-[11px]">{t('settings.lipMirrorDesc', 'Accelerated download mirrors for regions with GitHub throttling')}</div>
                </div>
                <CustomSelect
                  value={settings.lipMirror}
                  onChange={(val) => updateSetting('lipMirror', val as any)}
                  options={[
                    { value: 'official', label: 'Official GitHub (Direct)' },
                    { value: 'ghproxy', label: 'Fast Proxy' },
                  ]}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-dark-750/70">
                <div>
                  <div className="font-semibold text-slate-200">{t('autoCheckModUpdates', 'Check for Mod Updates Automatically')}</div>
                  <div className="text-slate-400 text-[11px]">{t('settings.autoCheckModUpdatesDesc', 'Inspects installed mods and packages for newer version releases')}</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoCheckModUpdates}
                  onChange={(e) => updateSetting('autoCheckModUpdates', e.target.checked)}
                  className="w-4 h-4 rounded text-brand-500 focus:ring-0 cursor-pointer accent-brand-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: SECURITY & NETWORK ================= */}
        {activeTab === 'security' && (
          <div className="bg-dark-850 rounded-2xl border border-dark-750 p-6 space-y-5 w-full max-w-6xl animate-settle">
            <div className="flex items-center gap-2 pb-3 border-b border-dark-750">
              <ShieldCheck size={18} className="text-emerald-400" />
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  {t('securityTitle', 'Security & Network Safeties')}
                </h2>
                <p className="text-[11px] text-slate-400">{t('securityDesc', 'Safeguard server files from malicious archives and configure network loopback exemptions.')}</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-semibold text-slate-200">{t('zipSlipProtection', 'Zip-Slip Vulnerability Protection')}</div>
                  <div className="text-slate-400 text-[11px]">{t('zipSlipProtectionDesc', 'Strictly validate archive extraction targets to prevent directory traversal outside server root.')}</div>
                </div>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {t('enabled', 'Enabled')}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-t border-dark-750/70">
                <div>
                  <div className="font-semibold text-slate-200">{t('rollbackSnapshots', 'Transactional Rollback Snapshots')}</div>
                  <div className="text-slate-400 text-[11px]">{t('rollbackSnapshotsDesc', 'Create a snapshot before modifying world or pack files to allow seamless rollback on failure.')}</div>
                </div>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {t('active', 'Active')}
                </span>
              </div>

              {/* Windows Loopback Exemption */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-t border-dark-750/70">
                <div>
                  <div className="font-semibold text-slate-200">{t('windowsLoopback', 'Windows Loopback Exemption Helper')}</div>
                  <div className="text-slate-400 text-[11px]">
                    {t('windowsLoopbackDesc', 'Allows the Bedrock Client on this Windows PC to connect to local servers hosted on 127.0.0.1.')}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={loopbackLoading}
                  onClick={handleEnableLoopback}
                  className="px-4 py-2 rounded-xl bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/40 font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  <Wifi size={14} /> {loopbackLoading ? t('loading', 'Loading...') : t('enableLoopback', 'Enable Loopback Exemption')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 6: DATA MANAGEMENT & WIPE ================= */}
        {activeTab === 'cleanup' && (
          <div className="bg-dark-850 rounded-2xl border border-rose-500/40 p-6 space-y-5 w-full max-w-6xl animate-settle">
            <div className="flex items-center gap-2 pb-3 border-b border-dark-750">
              <AlertTriangle size={18} className="text-rose-400" />
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                  {t('dataWipeTitle', 'Data & Application Reset')}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {t('dataWipeDesc', 'Clear application cache, temporary downloads, or reset configuration.')}
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-2">
                <div className="font-bold text-rose-200 flex items-center gap-1.5">
                  <AlertTriangle size={16} /> {t('resetAllSettings', 'Reset All Settings')}
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {t('resetAllSettingsDesc', 'Restore all application configuration to factory defaults.')}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const confirmed = await confirmAction({
                        title: t('resetAllSettings', 'Reset All Settings'),
                        message: t('resetAllSettingsDesc', 'Restore all application configuration to factory defaults.'),
                        confirmText: t('confirm', 'Confirm'),
                        cancelText: t('cancel', 'Cancel'),
                        isDestructive: true,
                      });
                      if (confirmed) {
                        try {
                          await Api.purgeDownloadedCache();
                          localStorage.clear();
                          alert(t('saved', 'Saved'));
                          window.location.reload();
                        } catch (err: any) {
                          alert(t('error', 'Error') + ": " + err.message);
                        }
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-lg shadow-rose-900/40 flex items-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <Trash2 size={14} /> {t('clearCache', 'Clear Cache')}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-t border-dark-750/70">
                <div>
                  <div className="font-semibold text-slate-200">{t('resetDefaults', 'Reset')}</div>
                  <div className="text-slate-400 text-[11px]">
                    {t('resetAllSettingsDesc', 'Restore all application configuration to factory defaults.')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700 font-semibold text-xs transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  <RotateCcw size={13} /> {t('resetDefaults', 'Reset')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
