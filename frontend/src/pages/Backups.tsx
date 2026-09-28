import React, { useState, useEffect } from 'react';
import { 
  Archive, 
  RotateCw, 
  Plus, 
  RotateCcw, 
  HardDrive, 
  Clock, 
  AlertTriangle,
  FolderOpen,
  CheckCircle2,
  Settings,
  Trash2,
  ShieldCheck,
  X
} from 'lucide-react';
import { Api } from '../services/api';
import { Backup, Server, World } from '../types';
import { CustomSelect } from '../components/CustomSelect';
import { confirmAction } from '../components/ModalAlert';
import { useI18n } from '../i18n';

interface BackupsProps {
  server: Server | null;
  worlds?: World[];
}

export const Backups: React.FC<BackupsProps> = ({ server, worlds = [] }) => {
  const { t } = useI18n();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [restoreConfirmBackup, setRestoreConfirmBackup] = useState<Backup | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [pruning, setPruning] = useState(false);

  // Form State
  const [backupType, setBackupType] = useState('FULL');
  const [targetWorld, setTargetWorld] = useState('');
  const [description, setDescription] = useState(t('backups.manualBackup', 'Manual Backup'));

  // Automation & Retention Settings State
  const [backupInterval, setBackupInterval] = useState('60');
  const [retentionCount, setRetentionCount] = useState('10');
  const [autoOnStop, setAutoOnStop] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  const safeWorlds = Array.isArray(worlds) ? worlds : [];

  useEffect(() => {
    if (server) {
      loadBackups();
      loadBackupSettings();
      if (safeWorlds.length > 0 && !targetWorld) {
        setTargetWorld(safeWorlds[0].name);
      }
    }
  }, [server, worlds]);

  const loadBackups = async () => {
    if (!server) return;
    setLoading(true);
    try {
      const list = await Api.listBackups(server.id);
      setBackups(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to load backups:", err);
      setBackups([]);
    } finally {
      setLoading(false);
    }
  };

  const loadBackupSettings = async () => {
    if (!server) return;
    try {
      const interval = await Api.getPreference(`backup_interval_${server.id}`, '60');
      const retention = await Api.getPreference(`backup_retention_${server.id}`, '10');
      const onStop = await Api.getPreference(`backup_on_stop_${server.id}`, 'true');
      setBackupInterval(interval);
      setRetentionCount(retention);
      setAutoOnStop(onStop === 'true');
    } catch (err) {
      console.error("Failed to load backup settings:", err);
    }
  };

  const handleSaveSettings = async () => {
    if (!server) return;
    setSettingsSaving(true);
    try {
      await Api.setPreference(`backup_interval_${server.id}`, backupInterval);
      await Api.setPreference(`backup_retention_${server.id}`, retentionCount);
      await Api.setPreference(`backup_on_stop_${server.id}`, autoOnStop ? 'true' : 'false');
      setSettingsSavedMsg(true);
      setTimeout(() => setSettingsSavedMsg(false), 3000);
    } catch (err: any) {
      alert((t('error', 'Error') + ": ") + err.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handlePruneNow = async () => {
    if (!server) return;
    const maxRetained = parseInt(retentionCount, 10);
    if (isNaN(maxRetained) || maxRetained <= 0) {
      alert(t('backups.pruneInvalidLimit', 'Please choose a retention limit greater than 0 before pruning.'));
      return;
    }

    const confirmed = await confirmAction({
      title: t('backups.pruneConfirmTitle', 'Prune Older Backups?'),
      message: t('backups.pruneConfirmMsg', 'Are you sure you want to clean up older backups and retain only the newest {n}? Removed backup archives cannot be recovered.').replace('{n}', String(maxRetained)),
      confirmText: t('backups.pruneBtn', 'Prune Backups'),
      cancelText: t('cancel', 'Cancel'),
      isDestructive: true,
    });
    if (!confirmed) return;

    setPruning(true);
    try {
      const pruned = await Api.pruneBackups(server.id, maxRetained);
      await loadBackups();
      alert(t('backups.pruneCompletedMsg', 'Cleanup completed! Removed {p} older backup(s), keeping the newest {n}.').replace('{p}', String(pruned)).replace('{n}', String(maxRetained)));
    } catch (err: any) {
      alert((t('failed', 'Failed') + ": ") + err.message);
    } finally {
      setPruning(false);
    }
  };

  const safeBackups = Array.isArray(backups) ? backups : [];

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server) return;

    setCreating(true);
    try {
      await Api.createBackup(
        server.id,
        backupType,
        backupType === 'WORLD' ? targetWorld : '',
        description
      );
      setShowCreateModal(false);
      setDescription(t('backups.manualBackup', 'Manual Backup'));
      loadBackups();
      alert(t('backupCreatedSuccess', 'Backup created successfully!'));
    } catch (err: any) {
      alert((t('failed', 'Failed') + ": ") + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!server || !restoreConfirmBackup) return;
    setRestoring(true);
    try {
      await Api.restoreBackup(server.id, restoreConfirmBackup.filePath);
      setRestoreConfirmBackup(null);
      alert(t('backupRestoredSuccess', 'Backup restored successfully!'));
    } catch (err: any) {
      alert((t('failed', 'Failed') + ": ") + err.message);
    } finally {
      setRestoring(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 stagger-settle">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="animate-slide-left">
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">
            {t('backupsTitle', 'Server & World Backups')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('backupsSubtitle', 'Full snapshot archives, automated schedule intervals, and retention prune ranges.')}
          </p>
        </div>

        <div className="flex items-center gap-2 animate-slide-right">
          <button
            onClick={loadBackups}
            className="p-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700 transition-all"
            title={t('refresh', 'Refresh list')}
          >
            <RotateCw size={15} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-200 font-bold text-xs border border-dark-700 transition-all active:scale-95"
            title={t('backupSettings', 'Backup Settings')}
          >
            <Settings size={14} /> {t('backupSettings', 'Backup Settings')}
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-brand-500/20 active:scale-95"
          >
            <Plus size={15} /> {t('createBackup', 'Create Backup')}
          </button>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-settle">
        <div className="bg-dark-850 p-4 rounded-xl border border-dark-750 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {t('total', 'Total Backups')}
            </div>
            <div className="text-xl font-black text-slate-100 mt-0.5">{safeBackups.length}</div>
          </div>
          <Archive size={22} className="text-brand-400 opacity-80" />
        </div>

        <div className="bg-dark-850 p-4 rounded-xl border border-dark-750 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {t('backupInterval', 'Auto Interval')}
            </div>
            <div className="text-sm font-bold text-slate-200 mt-1">
              {backupInterval === '0' 
                ? t('disabled', 'Manual Only') 
                : t('backups.everyXMins', 'Every {n} Mins').replace('{n}', backupInterval)}
            </div>
          </div>
          <Clock size={22} className="text-blue-400 opacity-80" />
        </div>

        <div className="bg-dark-850 p-4 rounded-xl border border-dark-750 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {t('retentionLimit', 'Retention Limit')}
            </div>
            <div className="text-sm font-bold text-purple-400 mt-1">
              {retentionCount === '0' 
                ? t('all', 'Unlimited') 
                : t('backups.keepLastX', 'Keep Last {n}').replace('{n}', retentionCount)}
            </div>
          </div>
          <ShieldCheck size={22} className="text-purple-400 opacity-80" />
        </div>
      </div>

      {/* Backups List */}
      <div className="space-y-3">
        {safeBackups.length === 0 ? (
          <div className="bg-dark-850 p-8 rounded-xl border border-dark-750 text-center text-xs text-slate-400">
            {t('noBackupsYet', 'No backups created for this server yet. Click "Create Backup" above to make your first snapshot!')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {safeBackups.map((b) => (
              <div 
                key={b.fileName}
                className="bg-dark-850 rounded-xl border border-dark-750 p-4 flex flex-col justify-between space-y-4 hover:border-dark-650 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="truncate">
                      <h3 className="font-bold text-sm text-slate-100 truncate" title={b.fileName}>
                        {b.fileName}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">{b.description || t('backups.snapshotBackup', 'Snapshot Backup')}</p>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                      b.type === 'FULL' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                      b.type === 'PRE_INSTALL' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {b.type === 'FULL' ? t('fullBackup', 'FULL') : b.type}
                    </span>
                  </div>

                  <div className="space-y-1 my-3 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5"><Clock size={13} /> {new Date(b.createdAt).toLocaleString()}</div>
                    <div className="flex items-center gap-1.5"><HardDrive size={13} /> {formatSize(b.sizeBytes)}</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-dark-750/70 flex items-center justify-between">
                  <button
                    onClick={() => setRestoreConfirmBackup(b)}
                    className="px-3 py-1.5 rounded-lg bg-dark-750 hover:bg-dark-700 text-amber-400 font-semibold text-xs flex items-center gap-1.5 border border-dark-650 active:scale-95 transition-all"
                  >
                    <RotateCcw size={13} /> {t('restoreBackup', 'Restore')}
                  </button>

                  <button
                    onClick={() => {
                      if (server) {
                        Api.openFolder(`${server.path}\\backups`);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                    title={t('openFolder', 'Open Backups Folder')}
                  >
                    <FolderOpen size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backup Automation & Retention Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-dark-750">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-brand-500" />
                <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider">
                  {t('backupSettings', 'Backup Settings & Automation')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-dark-800 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {settingsSavedMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs animate-in fade-in">
                <CheckCircle2 size={15} />
                <span>{t('saved', 'Backup preferences saved and applied!')}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Backup Schedule Interval */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t('backupInterval', 'Automatic Backup Frequency')}
                </label>
                <p className="text-[11px] text-slate-400 mb-2">
                  {t('backups.autoIntervalDesc', 'Specifies how often the server automatically triggers a background snapshot save.')}
                </p>
                <CustomSelect
                  value={backupInterval}
                  onChange={(val) => setBackupInterval(String(val))}
                  options={[
                    { value: '0', label: t('disabled', 'Disabled (Manual Backups Only)') },
                    { value: '15', label: t('backups.every15M', 'Every 15 Minutes') },
                    { value: '30', label: t('backups.every30M', 'Every 30 Minutes') },
                    { value: '60', label: t('backups.every1H', 'Every 1 Hour (Recommended)') },
                    { value: '120', label: t('backups.every2H', 'Every 2 Hours') },
                    { value: '240', label: t('backups.every4H', 'Every 4 Hours') },
                    { value: '360', label: t('backups.every6H', 'Every 6 Hours') },
                    { value: '720', label: t('backups.every12H', 'Every 12 Hours') },
                    { value: '1440', label: t('backups.every24H', 'Daily (Every 24 Hours)') },
                  ]}
                  fullWidth
                />
              </div>

              {/* Retention Range Limit */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t('retentionLimit', 'Backup Retention Limit (Auto-Prune Range)')}
                </label>
                <p className="text-[11px] text-slate-400 mb-2">
                  {t('backups.retentionDesc', 'When the number of stored backups exceeds this threshold, the oldest previous backups are automatically removed.')}
                </p>
                <CustomSelect
                  value={retentionCount}
                  onChange={(val) => setRetentionCount(String(val))}
                  options={[
                    { value: '3', label: t('backups.keep3', 'Keep Last 3 Backups') },
                    { value: '5', label: t('backups.keep5', 'Keep Last 5 Backups') },
                    { value: '10', label: t('backups.keep10', 'Keep Last 10 Backups (Recommended)') },
                    { value: '15', label: t('backups.keep15', 'Keep Last 15 Backups') },
                    { value: '20', label: t('backups.keep20', 'Keep Last 20 Backups') },
                    { value: '30', label: t('backups.keep30', 'Keep Last 30 Backups') },
                    { value: '50', label: t('backups.keep50', 'Keep Last 50 Backups') },
                    { value: '0', label: t('all', 'Unlimited (Never Auto-Delete)') },
                  ]}
                  fullWidth
                />
              </div>

              {/* Auto on Stop Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-dark-850 border border-dark-750">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    {t('autoOnShutdown', 'Snapshot on Server Stop')}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {t('backups.snapshotOnStopDesc', 'Automatically trigger a safety snapshot when stopping the server process.')}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoOnStop}
                  onChange={(e) => setAutoOnStop(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 cursor-pointer"
                />
              </div>

              {/* Prune Action Card */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-dark-850 border border-dark-750">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    {t('backups.pruneTitle', 'Prune Previous Backups')}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {t('backups.pruneDesc', 'Immediately purge older backups exceeding the current retention count ({n}).').replace('{n}', retentionCount === '0' ? t('disabled', 'Disabled') : t('backups.keepLastX', 'Keep Last {n}').replace('{n}', retentionCount))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePruneNow}
                  disabled={pruning || retentionCount === '0'}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1 active:scale-95 shrink-0"
                >
                  <Trash2 size={13} /> {pruning ? t('loading', 'Pruning...') : t('backups.pruneBtn', 'Prune Now')}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-750">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold"
              >
                {t('close', 'Close')}
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-brand-500/20 active:scale-95"
              >
                {settingsSaving ? t('loading', 'Saving...') : t('save', 'Save Settings')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateBackup} className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-dark-750">
              <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider">
                {t('createBackup', 'Create Server Backup')}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-dark-800 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t('backupType', 'Backup Scope')}
                </label>
                <CustomSelect
                  value={backupType}
                  onChange={(val) => setBackupType(String(val))}
                  options={[
                    { value: 'FULL', label: t('fullBackup', 'Entire Server (Worlds, Configs, Plugins, Packs)') },
                    { value: 'WORLD', label: t('worldOnly', 'World Only') },
                  ]}
                  fullWidth
                />
              </div>

              {backupType === 'WORLD' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('targetWorld', 'Select Target World')}
                  </label>
                  <CustomSelect
                    value={targetWorld}
                    onChange={(val) => setTargetWorld(String(val))}
                    options={(safeWorlds || []).map((w) => ({
                      value: w.name,
                      label: `${w.levelName || w.name} (${w.name})`,
                    }))}
                    fullWidth
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t('backupDescription', 'Description / Reason')}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('backups.descPlaceholder', 'e.g. Pre-upgrade to 1.21.60')}
                  className="w-full bg-dark-850 border border-dark-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-brand-500/20 active:scale-95"
              >
                {creating ? t('loading', 'Creating Backup...') : t('createBackup', 'Start Backup')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Restore Safeguard Modal */}
      {restoreConfirmBackup && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">{t('restoreConfirmTitle', 'Restore Server Backup?')}</h3>
                <p className="text-xs text-slate-400">{t('warning', 'Warning: Existing files may be overwritten')}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {t('restoreConfirmDesc', 'Restoring a backup will overwrite current server files with the snapshot taken on {date}. Make sure your server is stopped before proceeding.').replace('{date}', new Date(restoreConfirmBackup.createdAt).toLocaleDateString())}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRestoreConfirmBackup(null)}
                className="px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={restoring}
                className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 active:scale-95"
              >
                {restoring ? t('restoring', 'Restoring...') : t('confirmRestore', 'Confirm & Restore')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
