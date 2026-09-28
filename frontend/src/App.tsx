/**
 * @file App.tsx
 * @description Main application container, router, and global state coordinator for LLSM.
 *
 * Core Responsibilities:
 * - Page navigation routing (`currentPage` state switcher).
 * - Global active server state (`activeServer`, `servers`).
 * - Real-time metrics polling interval (1.5s) when BDS is ONLINE.
 * - Wails event subscription lifecycle for "server:console", "server:status", and "app:activity".
 * - Application-wide theme initialization (dark/light/white mode).
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Servers } from './pages/Servers';
import { CreateServer, WizardStatus } from './pages/CreateServer';
import { TitleBar } from './components/TitleBar';
import { DraggableFloatingWizard } from './components/DraggableFloatingWizard';
import { Worlds } from './pages/Worlds';
import { Players } from './pages/Players';
import { Mods } from './pages/Mods';
import { Addons } from './pages/Addons';
import { Dependencies } from './pages/Dependencies';
import { Console } from './pages/Console';
import { Performance } from './pages/Performance';
import { Backups } from './pages/Backups';
import { Configuration } from './pages/Configuration';
import { Compatibility } from './pages/Compatibility';
import { ImportCenter } from './pages/ImportCenter';
import { Extensions } from './pages/Extensions';
import { ToolCoinPage } from './pages/ToolCoinPage';
import { CurseForgePage } from './pages/CurseForgePage';
import { MCPEDLPage } from './pages/MCPEDLPage';
import { Settings } from './pages/Settings';
import { About } from './pages/About';
import { Logs } from './pages/Logs';
import { UpdatesPage } from './pages/UpdatesPage';
import { ModalAlert, showDialog } from './components/ModalAlert';
import { UpdatesModal } from './components/UpdatesModal';
import { XboxLoginModal } from './components/XboxLoginModal';
import { XboxWelcomeBanner } from './components/XboxWelcomeBanner';
import { Api } from './services/api';
import { Server, ServerMetrics, ServerStatus, World, UpdateCheckReport, XboxAccount } from './types';
import { initSavedTheme } from './utils/theme';
import { useI18n } from './i18n/translations';

export const App: React.FC = () => {
  const { t } = useI18n();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>('OFFLINE');
  const [worlds, setWorlds] = useState<World[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [updateReport, setUpdateReport] = useState<UpdateCheckReport | null>(null);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [metrics, setMetrics] = useState<ServerMetrics>({
    status: 'OFFLINE',
    pid: 0,
    cpuPercent: 0,
    memoryMB: 0,
    uptimeSeconds: 0,
    playerCount: 0,
    maxPlayers: 10,
    tps: null,
    mspt: null,
  });
  const [wizardStatus, setWizardStatus] = useState<WizardStatus>({
    isActive: false,
    step: 1,
    name: '',
    isInstalling: false,
    percent: 0,
    statusText: '',
  });
  const [isWizardActive, setIsWizardActive] = useState(false);
  const [pendingImportPayload, setPendingImportPayload] = useState<{ path: string; type?: string } | null>(null);

  // Universal Navigation History (Back / Forward)
  const [history, setHistory] = useState<string[]>(['dashboard']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Xbox Account State
  const [xboxAccount, setXboxAccount] = useState<XboxAccount | null>(null);
  const [showXboxModal, setShowXboxModal] = useState(false);

  const handleNavigatePage = (page: string, payload?: { path: string; type?: string }) => {
    if (page === 'create-server') {
      setIsWizardActive(true);
    }
    setPendingImportPayload(payload || null);
    if (currentPage !== page) {
      const nextHistory = history.slice(0, historyIndex + 1);
      nextHistory.push(page);
      setHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
      setCurrentPage(page);
    }
  };

  const handleGoBack = () => {
    if (historyIndex > 0) {
      const prev = historyIndex - 1;
      setHistoryIndex(prev);
      setCurrentPage(history[prev]);
    }
  };

  const handleGoForward = () => {
    if (historyIndex < history.length - 1) {
      const next = historyIndex + 1;
      setHistoryIndex(next);
      setCurrentPage(history[next]);
    }
  };

  // Keyboard (Alt+Left, Alt+Right) and Mouse Back/Forward navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleGoBack();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleGoForward();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        handleGoBack();
      } else if (e.button === 4) {
        e.preventDefault();
        handleGoForward();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mouseup', handleMouseUp);

    // Prevent mouse pointer vanishing when swapping between applications in Windows
    const handleFocus = () => {
      document.documentElement.style.cursor = 'default';
      document.body.style.cursor = 'default';
      requestAnimationFrame(() => {
        document.documentElement.style.cursor = '';
        document.body.style.cursor = '';
      });
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('focus', handleFocus);
    };
  }, [historyIndex, history]);

  // Load Xbox profile on startup: if not logged in, prompt user to sign in
  useEffect(() => {
    const fetchXbox = async () => {
      try {
        const acc = await Api.getXboxAccount();
        if (acc && acc.isLoggedIn && acc.gamertag) {
          setXboxAccount(acc);
        } else {
          setXboxAccount(null);
          setShowXboxModal(true);
        }
      } catch {
        setShowXboxModal(true);
      }
    };
    fetchXbox();
  }, []);

  // Initial load
  useEffect(() => {
    initSavedTheme();
    loadServers();

    // Listen to real-time events emitted by Go backend via Wails
    if (window.runtime?.EventsOn) {
      window.runtime.EventsOn('server:console', (line: string) => {
        setLogs(prev => [...prev.slice(-1999), line]);
      });

      window.runtime.EventsOn('server:status', (data: { status: ServerStatus; exitCode: number }) => {
        setServerStatus(data.status);
      });

      window.runtime.EventsOn('server:setup_progress', (data: any) => {
        setWizardStatus(prev => ({
          ...prev,
          isInstalling: data.percent < 100,
          percent: data.percent,
          statusText: data.status,
          step: data.step || 7,
        }));
      });
    }
  }, []);

  // Global Keyboard Shortcuts (F11 Fullscreen, 'd' -> Dashboard, 'p' -> Players, etc. when not typing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F11: Fullscreen toggle
      if (e.key === 'F11') {
        e.preventDefault();
        Api.toggleFullscreen();
        return;
      }

      // Check if user is currently typing in an input element or contenteditable
      const activeEl = document.activeElement;
      if (activeEl) {
        const tag = activeEl.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          return;
        }
        if ((activeEl as HTMLElement).isContentEditable || activeEl.getAttribute('contenteditable') === 'true') {
          return;
        }
      }

      // Ignore when modifier keys are pressed (Ctrl, Alt, Meta) to preserve OS/browser shortcuts
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'd') {
        e.preventDefault();
        handleNavigatePage('dashboard');
      } else if (key === 'p') {
        e.preventDefault();
        handleNavigatePage('players');
      } else if (key === 'm') {
        e.preventDefault();
        handleNavigatePage('mods');
      } else if (key === 'w') {
        e.preventDefault();
        handleNavigatePage('worlds');
      } else if (key === 's') {
        e.preventDefault();
        handleNavigatePage('servers');
      } else if (key === 'c') {
        e.preventDefault();
        handleNavigatePage('configuration');
      } else if (key === 'b') {
        e.preventDefault();
        handleNavigatePage('backups');
      } else if (key === 'a') {
        e.preventDefault();
        handleNavigatePage('addons');
      } else if (key === 'l') {
        e.preventDefault();
        handleNavigatePage('console');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Poll metrics every 1.5s
  useEffect(() => {
    if (!activeServer) return;

    const interval = setInterval(async () => {
      try {
        const m = await Api.getServerMetrics(activeServer.id);
        setMetrics(m);
        setServerStatus(m.status);
      } catch (err) {
        // silent catch
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeServer]);

  const checkUpdates = async (serverId?: string, notifyIfFound = true) => {
    try {
      const rep = await Api.checkAllUpdates(serverId || activeServer?.id);
      if (rep) {
        setUpdateReport(rep);
        if (rep.hasUpdates && notifyIfFound) {
          showDialog({
            title: t('checkUpdatesTitle', 'Updates Available'),
            message: t('updatesReadyDesc', '{n} update(s) ready for your server dependencies and mods. Review them in the Updates Center.').replace('{n}', String(rep.totalUpdatesCount)),
            type: "info",
          });
        }
      }
    } catch (err) {
      console.warn("Update check error:", err);
    }
  };

  const loadServers = async () => {
    try {
      const srvList = await Api.getServers();
      setServers(srvList);

      const active = await Api.getActiveServer();
      if (active) {
        setActiveServer(active);
        loadWorlds(active.id);
        const st = await Api.getServerStatus(active.id);
        setServerStatus(st);
        const initialLogs = await Api.getConsoleLogs(active.id);
        setLogs(initialLogs);
        checkUpdates(active.id, true);
      } else if (srvList.length > 0) {
        handleSelectServer(srvList[0]);
      } else {
        checkUpdates(undefined, false);
      }
    } catch (err) {
      console.error("Failed to load servers:", err);
    }
  };

  const loadWorlds = async (serverId: string) => {
    try {
      const wList = await Api.listWorlds(serverId);
      setWorlds(wList || []);
      // Refresh active server so activeWorld stays perfectly synchronized
      const active = await Api.getActiveServer();
      if (active) {
        setActiveServer(active);
        setServers(prev => prev.map(s => s.id === active.id ? active : s));
      }
    } catch (err) {
      console.error("Failed to load worlds:", err);
      setWorlds([]);
    }
  };

  const handleSelectServer = async (server: Server) => {
    try {
      await Api.setActiveServer(server.id);
      setActiveServer(server);
      loadWorlds(server.id);
      const st = await Api.getServerStatus(server.id);
      setServerStatus(st);
      const currentLogs = await Api.getConsoleLogs(server.id);
      setLogs(currentLogs);
      checkUpdates(server.id, false);
    } catch (err) {
      console.error("Failed to select server:", err);
    }
  };

  const handleStartServer = async () => {
    if (!activeServer) return;
    try {
      await Api.startServer(activeServer.id);
      setServerStatus('STARTING');
    } catch (err: any) {
      alert(`${t('serverStartFailed', 'Failed to start server:')} ${err.message}`);
    }
  };

  const handleStopServer = async () => {
    if (!activeServer) return;
    try {
      await Api.stopServer(activeServer.id);
      setServerStatus('STOPPING');
    } catch (err: any) {
      alert(`${t('serverStopFailed', 'Failed to stop server:')} ${err.message}`);
    }
  };

  const handleRestartServer = async () => {
    if (!activeServer) return;
    try {
      await Api.restartServer(activeServer.id);
      setServerStatus('STARTING');
    } catch (err: any) {
      alert(`${t('serverRestartFailed', 'Failed to restart server:')} ${err.message}`);
    }
  };

  const handleBackupNow = async () => {
    if (!activeServer) return;
    try {
      await Api.createBackup(activeServer.id, 'FULL', '', 'Quick Dashboard Backup');
      alert(t('serverBackupSuccess', 'Full server backup completed successfully!'));
    } catch (err: any) {
      alert(`${t('serverBackupFailed', 'Backup failed:')} ${err.message}`);
    }
  };

  const handleOpenFolder = () => {
    if (activeServer) {
      Api.openFolder(activeServer.path);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-dark-950 text-slate-100 select-none">
      {/* Frameless Embedded Window TitleBar with window controls & profile */}
      <TitleBar 
        onNavigateProfile={() => handleNavigatePage('settings')}
        activeServerName={activeServer?.name}
        updatesCount={updateReport?.totalUpdatesCount || 0}
        onOpenUpdates={() => setShowUpdatesModal(true)}
        canGoBack={historyIndex > 0}
        canGoForward={historyIndex < history.length - 1}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        xboxAccount={xboxAccount}
        onOpenXboxModal={() => setShowXboxModal(true)}
      />

      {/* Main Workspace Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Persistent Left Sidebar */}
        <Sidebar
          currentPage={currentPage}
          onSelectPage={handleNavigatePage}
        activeServer={activeServer}
        serverStatus={serverStatus}
      />

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-hidden bg-gradient-to-br from-dark-900 via-dark-950 to-dark-900 relative">
        {/* Persistent Create Server Wizard Container: ALWAYS in DOM, never destroyed or cancelled on tab switch */}
        <div className={`h-full w-full ${currentPage === 'create-server' ? 'block animate-page-enter' : 'hidden'}`}>
          <CreateServer
            isActive={isWizardActive}
            onServerCreated={(newServer) => {
              setIsWizardActive(false);
              setWizardStatus({
                isActive: false,
                step: 1,
                name: '',
                isInstalling: false,
                percent: 0,
                statusText: '',
              });
              loadServers();
              setActiveServer(newServer);
              handleNavigatePage('dashboard');
              handleStartServer();
            }}
            onCancel={() => {
              setIsWizardActive(false);
              setWizardStatus({
                isActive: false,
                step: 1,
                name: '',
                isInstalling: false,
                percent: 0,
                statusText: '',
              });
              handleNavigatePage('servers');
            }}
            onStatusChange={(status) => {
              setWizardStatus(status);
              if (!status.isActive) {
                setIsWizardActive(false);
              }
            }}
          />
        </div>

        {/* Regular Navigation Pages */}
        {currentPage !== 'create-server' && (
          <div key={currentPage} className="h-full w-full overflow-hidden animate-page-enter">
            {currentPage === 'dashboard' && (
              <Dashboard
                server={activeServer}
                metrics={metrics}
                recentLogs={logs}
                onStart={handleStartServer}
                onStop={handleStopServer}
                onRestart={handleRestartServer}
                onOpenFolder={handleOpenFolder}
                onBackupNow={handleBackupNow}
                onOpenSettings={() => handleNavigatePage('configuration')}
                onNavigatePage={handleNavigatePage}
              />
            )}

            {currentPage === 'servers' && (
              <Servers
                servers={servers}
                activeServer={activeServer}
                serverStatus={serverStatus}
                onSelectServer={handleSelectServer}
                onOpenCreateWizard={() => handleNavigatePage('create-server')}
                onRefreshServers={loadServers}
              />
            )}

            {currentPage === 'worlds' && (
              <Worlds
                server={activeServer}
                worlds={worlds}
                onRefreshWorlds={async () => {
                  if (activeServer) {
                    await loadWorlds(activeServer.id);
                  }
                }}
              />
            )}

            {currentPage === 'players' && (
              <Players server={activeServer} />
            )}

            {currentPage === 'mods' && (
              <Mods 
                server={activeServer} 
                updateReport={updateReport}
                onOpenUpdates={() => setShowUpdatesModal(true)}
                onCheckUpdates={() => checkUpdates(activeServer?.id, true)}
              />
            )}

            {currentPage === 'addons' && (
              <Addons
                server={activeServer}
                worlds={worlds}
                initialArchivePath={pendingImportPayload?.path}
                onRefreshWorlds={async () => {
                  if (activeServer) {
                    await loadWorlds(activeServer.id);
                  }
                }}
              />
            )}

            {currentPage === 'dependencies' && (
              <Dependencies server={activeServer} />
            )}

            {currentPage === 'console' && (
              <Console
                server={activeServer}
                serverStatus={serverStatus}
                logs={logs}
                onClearLogs={() => setLogs([])}
                onStartServer={handleStartServer}
                onStopServer={handleStopServer}
                onRestartServer={handleRestartServer}
              />
            )}

            {currentPage === 'performance' && (
              <Performance server={activeServer} metrics={metrics} />
            )}

            {currentPage === 'backups' && (
              <Backups server={activeServer} worlds={worlds} />
            )}

            {currentPage === 'configuration' && (
              <Configuration server={activeServer} />
            )}

            {currentPage === 'compatibility' && (
              <Compatibility server={activeServer} />
            )}

            {currentPage === 'import' && (
              <ImportCenter
                server={activeServer}
                worlds={worlds}
                onRefreshWorlds={async () => {
                  if (activeServer) {
                    await loadWorlds(activeServer.id);
                  }
                }}
                onNavigatePage={handleNavigatePage}
              />
            )}

            {currentPage === 'extensions' && (
              <Extensions
                server={activeServer}
                onNavigatePage={handleNavigatePage}
              />
            )}

            {currentPage === 'updates' && (
              <UpdatesPage
                server={activeServer}
                servers={servers}
                onSelectServer={handleSelectServer}
                onNavigatePage={handleNavigatePage}
              />
            )}

            {currentPage === 'toolcoin' && (
              <ToolCoinPage
                server={activeServer}
                onNavigatePage={handleNavigatePage}
              />
            )}

            {currentPage === 'curseforge' && (
              <CurseForgePage
                server={activeServer}
                onNavigatePage={handleNavigatePage}
              />
            )}

            {currentPage === 'mcpedl' && (
              <MCPEDLPage
                server={activeServer}
                onNavigatePage={handleNavigatePage}
              />
            )}

            {currentPage === 'settings' && (
              <Settings 
                onOpenUpdates={() => setShowUpdatesModal(true)} 
                activeServer={activeServer}
                onAccountUpdated={setXboxAccount}
              />
            )}

            {currentPage === 'about' && (
              <About onNavigatePage={handleNavigatePage} />
            )}

            {currentPage === 'logs' && (
              <Logs />
            )}
          </div>
        )}
        </main>
      </div>

      <ModalAlert />

      {/* Dynamic Updates Center Modal */}
      <UpdatesModal
        isOpen={showUpdatesModal}
        onClose={() => setShowUpdatesModal(false)}
        report={updateReport}
        server={activeServer}
        onRefresh={() => checkUpdates(activeServer?.id, false)}
        onUpdateCompleted={() => {
          loadServers();
        }}
      />

      {/* Xbox Sign-In Welcome Banner */}
      <XboxWelcomeBanner account={xboxAccount} />

      {/* Xbox Login / Account Center Modal */}
      <XboxLoginModal
        isOpen={showXboxModal}
        onClose={() => setShowXboxModal(false)}
        activeServerId={activeServer?.id}
        onAccountUpdated={setXboxAccount}
      />

      {/* Draggable & Movable Floating Status Box when wizard is active in background */}
      {isWizardActive && currentPage !== 'create-server' && (
        <DraggableFloatingWizard
          wizardStatus={wizardStatus}
          onClick={() => handleNavigatePage('create-server')}
        />
      )}
    </div>
  );
};
export default App;
