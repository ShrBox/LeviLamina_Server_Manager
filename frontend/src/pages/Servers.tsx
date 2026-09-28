import React, { useState } from 'react';
import { 
  Server as ServerIcon, 
  Plus, 
  Upload, 
  FolderOpen, 
  Trash2, 
  Check, 
  AlertTriangle
} from 'lucide-react';
import { Api } from '../services/api';
import { Server, ServerStatus } from '../types';
import { useI18n } from '../i18n';

interface ServersProps {
  servers: Server[];
  activeServer: Server | null;
  serverStatus: ServerStatus;
  onSelectServer: (server: Server) => void;
  onOpenCreateWizard: () => void;
  onRefreshServers: () => void;
}

export const Servers: React.FC<ServersProps> = ({
  servers,
  activeServer,
  serverStatus,
  onSelectServer,
  onOpenCreateWizard,
  onRefreshServers,
}) => {
  const { t } = useI18n();
  const [deleteConfirmServer, setDeleteConfirmServer] = useState<Server | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleImportServer = async () => {
    try {
      const folderPath = await Api.selectFolder();
      if (folderPath) {
        await Api.importServer(folderPath);
        onRefreshServers();
        alert(t('importedSuccess', 'Existing server imported successfully!'));
      }
    } catch (err: any) {
      alert(t('importedFailed', 'Failed to import server: ') + err.message);
    }
  };

  const handleOpenFolder = (path: string) => {
    Api.openFolder(path);
  };

  const executeDelete = async () => {
    if (!deleteConfirmServer) return;
    setDeleting(true);
    try {
      await Api.deleteServer(deleteConfirmServer.id);
      setDeleteConfirmServer(null);
      onRefreshServers();
    } catch (err: any) {
      alert(t('deleteFailed', 'Failed to delete server: ') + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 stagger-settle">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="animate-slide-left">
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">
            {t('serverInstances', 'Server Instances')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('serverInstancesSubtitle', 'Manage multiple independent LeviLamina and Bedrock server instances.')}
          </p>
        </div>

        <div className="flex items-center gap-2 animate-slide-right">
          <button
            onClick={handleImportServer}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-200 font-semibold text-xs border border-dark-700 transition-all active:scale-95"
          >
            <Upload size={14} /> {t('importServer', 'Import Server')}
          </button>
          <button
            onClick={onOpenCreateWizard}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-brand-500/20 active:scale-95"
          >
            <Plus size={15} /> {t('createServer', 'Create Server')}
          </button>
        </div>
      </div>

      {/* Servers Grid */}
      {(servers || []).length === 0 ? (
        <div className="bg-dark-850 border border-dark-750 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3 animate-settle">
          <div className="w-12 h-12 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center text-slate-500">
            <ServerIcon size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-200">{t('noServersTitle', 'No Servers Found')}</h3>
          <p className="text-xs text-slate-400 max-w-sm">{t('noServersSubtitle', 'Create a new server or import an existing Bedrock server to get started.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-settle">
          {(servers || []).map((srv) => {
            const isActive = activeServer?.id === srv.id;
            const isOnline = isActive && serverStatus === 'ONLINE';
            const isStarting = isActive && serverStatus === 'STARTING';

            return (
              <div 
                key={srv.id}
                className={`bg-dark-850 rounded-2xl border p-5 flex flex-col justify-between space-y-4 transition-all ${
                  isActive 
                    ? 'border-brand-500/40 shadow-lg shadow-brand-500/5' 
                    : 'border-dark-750 hover:border-dark-650'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-base text-slate-100">{srv.name}</h2>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-brand-500/20 text-brand-500 border border-brand-500/30">
                            {t('active', 'Active')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate max-w-[220px] mt-0.5" title={srv.path}>
                        {srv.path}
                      </p>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                      isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      isStarting ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' :
                      'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}>
                      ● {isOnline ? t('online', 'ONLINE') : isStarting ? t('starting', 'STARTING') : t('offline', 'OFFLINE')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 my-4 text-xs">
                    <div className="bg-dark-900 p-2.5 rounded-lg border border-dark-750/70">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">{t('minecraftVersion', 'Minecraft')}</span>
                      <span className="font-bold text-slate-200">{srv.minecraftVersion || '26.x.x'}</span>
                    </div>
                    <div className="bg-dark-900 p-2.5 rounded-lg border border-dark-750/70">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">{t('leviLamina', 'LeviLamina')}</span>
                      <span className="font-bold text-slate-200">{srv.leviLaminaVersion || 'Detected'}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-1">
                    <div>{t('address', 'Address')}: <span className="font-mono text-brand-400 font-bold">127.0.0.1:{srv.port}</span></div>
                    <div>{t('defaultWorld', 'Default World')}: <span className="text-slate-300 font-medium">{srv.activeWorld}</span></div>
                  </div>
                </div>

                {/* Server Card Footer */}
                <div className="pt-3 border-t border-dark-750/70 flex items-center justify-between">
                  <div>
                    {!isActive ? (
                      <button
                        onClick={() => onSelectServer(srv)}
                        className="px-3 py-1.5 rounded-lg bg-dark-750 hover:bg-dark-700 text-slate-200 font-semibold text-xs transition-all border border-dark-650 active:scale-95"
                      >
                        {t('selectServer', 'Select Server')}
                      </button>
                    ) : (
                      <span className="text-xs text-brand-500 font-semibold flex items-center gap-1">
                        <Check size={14} /> {t('currentlySelected', 'Currently Selected')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-slate-400">
                    <button
                      onClick={() => handleOpenFolder(srv.path)}
                      className="p-1.5 hover:text-slate-200 transition-colors"
                      title={t('openInExplorer', 'Open in Explorer')}
                    >
                      <FolderOpen size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmServer(srv)}
                      className="p-1.5 hover:text-rose-400 transition-colors"
                      title={t('deleteServer', 'Delete Server')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Server Safeguard Modal */}
      {deleteConfirmServer && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">{t('deleteServerModalTitle', 'Delete Server Instance?')}</h3>
                <p className="text-xs text-slate-400">{t('confirmationRequired', 'Confirmation required')}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {t('deleteServerConfirmText', 'Are you sure you want to remove "{name}" from the manager? Files on disk will remain preserved in {path} unless manually removed.')
                .replace('{name}', deleteConfirmServer.name)
                .replace('{path}', deleteConfirmServer.path)}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmServer(null)}
                className="px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold active:scale-95"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                onClick={executeDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-md shadow-rose-500/20 active:scale-95 disabled:opacity-50"
              >
                {deleting ? t('removing', 'Removing...') : t('confirmDelete', 'Confirm Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
