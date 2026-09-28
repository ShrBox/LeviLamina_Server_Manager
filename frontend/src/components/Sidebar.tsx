import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Server as ServerIcon, 
  Globe, 
  Users, 
  Box, 
  Package, 
  GitBranch, 
  Terminal, 
  Activity, 
  Archive, 
  Sliders, 
  CheckCircle2, 
  UploadCloud, 
  Blocks,
  Coins,
  ShoppingBag,
  Flame,
  Compass,
  Sparkles,
  Settings as SettingsIcon, 
  Info,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Api } from '../services/api';
import { Server, ServerStatus } from '../types';
import { useI18n } from '../i18n';

interface SidebarProps {
  currentPage: string;
  onSelectPage: (page: string) => void;
  activeServer: Server | null;
  serverStatus: ServerStatus;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  activeServer,
  serverStatus
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useI18n();
  const [enabledExtensions, setEnabledExtensions] = useState<{ [id: string]: boolean }>({});

  const loadExtensions = async () => {
    try {
      const manifests = await Api.getExtensionsCatalog();
      const map: { [id: string]: boolean } = {};
      manifests.forEach(m => {
        if (m.isEnabled) map[m.id] = true;
      });
      setEnabledExtensions(map);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadExtensions();
    window.addEventListener('extensions-updated', loadExtensions);
    return () => window.removeEventListener('extensions-updated', loadExtensions);
  }, []);

  const contentItems: any[] = [
    { id: 'mods', label: t('mods', 'Mods'), icon: Box },
    { id: 'addons', label: t('addons', 'Add-Ons'), icon: Package },
    { id: 'dependencies', label: t('dependencies', 'Dependencies'), icon: GitBranch },
  ];

  if (enabledExtensions['toolcoin'] || enabledExtensions['marketplace']) {
    contentItems.push({ id: 'toolcoin', label: t('extMarketplace', 'Marketplace'), icon: ShoppingBag });
  }

  if (enabledExtensions['curseforge']) {
    contentItems.push({ id: 'curseforge', label: t('extCurseForge', 'CurseForge'), icon: Flame });
  }

  if (enabledExtensions['mcpedl']) {
    contentItems.push({ id: 'mcpedl', label: t('extMCPEDL', 'MCPEDL'), icon: Compass });
  }

  const navItems = [
    { section: '', items: [
      { id: 'dashboard', label: t('dashboard', 'Dashboard'), icon: LayoutDashboard },
    ]},
    { section: 'MANAGEMENT', label: t('management', 'Management'), items: [
      { id: 'servers', label: t('servers', 'Servers'), icon: ServerIcon },
      { id: 'worlds', label: t('worlds', 'Worlds'), icon: Globe },
      { id: 'players', label: t('players', 'Players'), icon: Users },
    ]},
    { section: 'CONTENT', label: t('content', 'Content'), items: contentItems },
    { section: 'SERVER', label: t('server', 'Server'), items: [
      { id: 'console', label: t('console', 'Console'), icon: Terminal },
      { id: 'performance', label: t('performance', 'Performance'), icon: Activity },
      { id: 'backups', label: t('backups', 'Backups'), icon: Archive },
      { id: 'configuration', label: t('configuration', 'Configuration'), icon: Sliders },
    ]},
    { section: 'TOOLS', label: t('tools', 'Tools'), items: [
      { id: 'compatibility', label: t('compatibility', 'Compatibility'), icon: CheckCircle2 },
      { id: 'import', label: t('import', 'Import Center'), icon: UploadCloud },
      { id: 'extensions', label: t('extensions', 'Extensions'), icon: Blocks },
      { id: 'updates', label: t('updates', 'Updates'), icon: Sparkles },
    ]},
    { section: 'SYSTEM', label: t('system', 'System'), items: [
      { id: 'settings', label: t('settings', 'Settings'), icon: SettingsIcon },
      { id: 'about', label: t('about', 'About'), icon: Info },
      { id: 'logs', label: t('logs', 'Logs'), icon: FileText },
    ]},
  ];

  const getStatusColor = (status: ServerStatus) => {
    switch (status) {
      case 'ONLINE': return 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20';
      case 'STARTING': return 'text-amber-400 bg-amber-400/10 border-amber-500/20 animate-pulse';
      case 'STOPPING': return 'text-amber-400 bg-amber-400/10 border-amber-500/20';
      case 'CRASHED': return 'text-rose-400 bg-rose-400/10 border-rose-500/20';
      default: return 'text-slate-400 bg-slate-800/40 border-slate-700/30';
    }
  };

  return (
    <aside className={`h-full bg-dark-900 border-r border-dark-750 flex flex-col transition-all duration-300 relative select-none ${collapsed ? 'w-20' : 'w-64'}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between bg-dark-950/40">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-brand-500 shadow-[0_0_12px_rgba(var(--brand-500),0.9)]"></div>
              <div className="absolute w-5 h-5 rounded-full bg-brand-500/20 animate-ping"></div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-sm tracking-widest text-slate-100 uppercase font-sans">
                  LEVI<span className="text-brand-400">LAMINA</span>
                </h1>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-brand-500/15 text-brand-400 border border-brand-500/30">
                  Beta
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide">Server Manager</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500/30 to-brand-600/10 border border-brand-500/40 flex items-center justify-center font-black text-brand-400 text-sm shadow-md shadow-brand-500/10">
            LL
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-200 transition-all ml-auto active:scale-90"
          title={collapsed ? t('sidebar.expand', "Expand sidebar") : t('sidebar.collapse', "Collapse sidebar")}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navItems.map((group, gIdx) => (
          <div key={gIdx}>
            {!collapsed && group.label && (
              <div className="px-3 pb-1.5 text-[10px] font-extrabold text-slate-500 tracking-widest uppercase">
                {group.label}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectPage(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 relative group ${
                      isActive 
                        ? 'bg-gradient-to-r from-brand-500/25 via-brand-500/10 to-transparent text-slate-100 font-bold border-l-2 border-brand-500 shadow-lg shadow-brand-500/10 backdrop-blur-sm' 
                        : 'text-slate-400 hover:text-slate-100 hover:bg-dark-800/40 hover:translate-x-1'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon 
                      size={18} 
                      className={`transition-transform duration-200 group-hover:scale-110 ${
                        isActive ? 'text-brand-400 drop-shadow-[0_0_10px_rgba(var(--brand-500),0.7)]' : 'text-slate-400 group-hover:text-slate-200'
                      }`} 
                    />
                    {!collapsed && (
                      <span className="flex-1 text-left">
                        <span className="tracking-wide">{item.label}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Persistent Bottom Server Status */}
      <div className="p-3 border-t border-dark-750/70 bg-dark-900/60 backdrop-blur-md">
        {!collapsed ? (
          <div className="launcher-card p-3 rounded-xl border border-dark-750/70">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">{t('active', 'Active')}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1.5 shadow-sm ${getStatusColor(serverStatus)}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  serverStatus === 'ONLINE' ? 'bg-emerald-400 animate-pulse' :
                  serverStatus === 'STARTING' ? 'bg-amber-400 animate-ping' :
                  serverStatus === 'CRASHED' ? 'bg-rose-400' : 'bg-slate-500'
                }`}></span>
                {t(serverStatus.toLowerCase(), serverStatus)}
              </span>
            </div>
            <div className="font-bold text-xs text-slate-100 truncate" title={activeServer?.name || t('noServerSelected', 'No Server Selected')}>
              {activeServer?.name || t('noServerSelected', 'No Server Selected')}
            </div>
            {activeServer && (
              <div className="mt-1.5 pt-1.5 border-t border-dark-750/60 space-y-0.5">
                <div className="text-[11px] text-slate-300 truncate font-mono flex items-center justify-between">
                  <span className="text-brand-400 font-bold">{t('serverPort', 'Port')}:</span>
                  <span className="bg-dark-850 px-1.5 py-0.5 rounded text-[10px] text-slate-200 border border-dark-700/50">{activeServer.port}</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate flex items-center justify-between">
                  <span>{t('worldNameLabel', 'World')}:</span>
                  <span className="text-slate-300 font-medium truncate max-w-[110px]">{activeServer.activeWorld}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center py-1" title={`Server: ${activeServer?.name || 'None'} (${serverStatus})`}>
            <div className={`w-3.5 h-3.5 rounded-full border-2 ${
              serverStatus === 'ONLINE' ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.9)]' :
              serverStatus === 'STARTING' ? 'bg-amber-500 border-amber-300 animate-pulse' :
              serverStatus === 'CRASHED' ? 'bg-rose-500 border-rose-300' : 'bg-slate-600 border-slate-500'
            }`} />
          </div>
        )}
      </div>
    </aside>
  );
};
