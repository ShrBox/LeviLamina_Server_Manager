import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  UserCheck, 
  UserX, 
  Plus, 
  Trash2, 
  RotateCw, 
  Crown, 
  Search, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  Radio,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { Api } from '../services/api';
import { Server, PlayersOverview, ServerPlayer, BanEntry } from '../types';
import { confirmAction } from '../components/ModalAlert';
import { useI18n } from '../i18n';

interface PlayersProps {
  server: Server | null;
}

export const Players: React.FC<PlayersProps> = ({ server }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'online' | 'ops' | 'whitelist' | 'bans'>('online');
  const [overview, setOverview] = useState<PlayersOverview>({
    onlinePlayers: [],
    operators: [],
    allowlist: [],
    bannedPlayers: [],
    allowListEnabled: false,
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showAddOpModal, setShowAddOpModal] = useState(false);
  const [showAddWhitelistModal, setShowAddWhitelistModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showKickModal, setShowKickModal] = useState(false);

  // Form inputs
  const [inputName, setInputName] = useState('');
  const [inputXuid, setInputXuid] = useState('');
  const [inputReason, setInputReason] = useState('');
  const [inputIgnoresLimit, setInputIgnoresLimit] = useState(false);
  const [targetPlayer, setTargetPlayer] = useState<ServerPlayer | null>(null);

  useEffect(() => {
    if (server) {
      loadOverview();
      const interval = setInterval(loadOverview, 4000);
      return () => clearInterval(interval);
    }
  }, [server]);

  const loadOverview = async () => {
    if (!server) return;
    try {
      const data = await Api.getPlayersOverview(server.id);
      if (data) {
        setOverview({
          onlinePlayers: Array.isArray(data.onlinePlayers) ? data.onlinePlayers : [],
          operators: Array.isArray(data.operators) ? data.operators : [],
          allowlist: Array.isArray(data.allowlist) ? data.allowlist : [],
          bannedPlayers: Array.isArray(data.bannedPlayers) ? data.bannedPlayers : [],
          allowListEnabled: !!data.allowListEnabled,
        });
      }
    } catch (err) {
      console.error("Failed to load player overview:", err);
    }
  };

  const handleToggleAllowlist = async () => {
    if (!server) return;
    try {
      const nextState = !overview.allowListEnabled;
      await Api.toggleAllowlist(server.id, nextState);
      setOverview(prev => ({ ...prev, allowListEnabled: nextState }));
    } catch (err: any) {
      alert((t('failed', 'Failed') + ": ") + err.message);
    }
  };

  const handleAddOp = async () => {
    if (!server || (!inputName.trim() && !inputXuid.trim())) return;
    try {
      const xuidToUse = inputXuid.trim() || inputName.trim();
      await Api.setPlayerPermission(server.id, xuidToUse, 'operator');
      if (inputName.trim()) {
        await Api.opPlayer(inputName.trim(), xuidToUse);
      }
      setShowAddOpModal(false);
      setInputName('');
      setInputXuid('');
      loadOverview();
    } catch (err: any) {
      alert((t('failed', 'Failed') + ": ") + err.message);
    }
  };

  const handleRemoveOp = async (xuid: string, name: string) => {
    if (!server) return;
    const confirmed = await confirmAction({
      title: t('removeOp', 'Revoke Operator Privileges?'),
      message: t('players.revokeConfirm', 'Are you sure you want to remove operator permissions from {name}?').replace('{name}', name || xuid),
      confirmText: t('removeOp', 'Revoke Operator'),
      cancelText: t('cancel', 'Cancel'),
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      await Api.removeOp(server.id, xuid);
      loadOverview();
    } catch (err: any) {
      alert((t('failed', 'Failed') + ": ") + err.message);
    }
  };

  const handleAddWhitelist = async () => {
    if (!server || !inputName.trim()) return;
    try {
      await Api.whitelistPlayer(server.id, inputName.trim(), inputXuid.trim(), inputIgnoresLimit);
      setShowAddWhitelistModal(false);
      setInputName('');
      setInputXuid('');
      setInputIgnoresLimit(false);
      loadOverview();
    } catch (err: any) {
      alert((t('failed', 'Failed') + ": ") + err.message);
    }
  };

  const handleRemoveWhitelist = async (xuidOrName: string) => {
    if (!server) return;
    try {
      await Api.unwhitelistPlayer(server.id, xuidOrName);
      loadOverview();
    } catch (err: any) {
      alert((t('failed', 'Failed') + ": ") + err.message);
    }
  };

  const handleExecuteBan = async () => {
    if (!server || !inputName.trim()) return;
    try {
      await Api.banPlayer(server.id, inputName.trim(), inputXuid.trim(), inputReason.trim() || t('players.defaultBanReason', 'Banned by Server Operator'));
      setShowBanModal(false);
      setInputName('');
      setInputXuid('');
      setInputReason('');
      setTargetPlayer(null);
      loadOverview();
    } catch (err: any) {
      alert((t('failed', 'Failed') + ": ") + err.message);
    }
  };

  const handleUnban = async (xuidOrName: string) => {
    if (!server) return;
    try {
      await Api.unbanPlayer(server.id, xuidOrName);
      loadOverview();
    } catch (err: any) {
      alert((t('failed', 'Failed') + ": ") + err.message);
    }
  };

  const handleExecuteKick = async () => {
    if (!server || !targetPlayer) return;
    try {
      await Api.kickPlayer(server.id, targetPlayer.name, inputReason.trim() || t('players.defaultKickReason', 'Kicked by administrator'));
      setShowKickModal(false);
      setInputReason('');
      setTargetPlayer(null);
      loadOverview();
    } catch (err: any) {
      alert((t('failed', 'Failed') + ": ") + err.message);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">
            {t('playerManagerTitle', 'Player & Permission Management')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('playerManagerSubtitle', 'Manage operators, whitelist access, ban lists, and view live active players.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setLoading(true);
              loadOverview().finally(() => setLoading(false));
            }}
            className="p-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700 transition-all"
            title={t('refresh', 'Refresh list')}
          >
            <RotateCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-dark-750 pb-2">
        {[
          { id: 'online', label: t('onlinePlayersTab', 'Online Players'), count: (overview?.onlinePlayers || []).length, icon: Radio },
          { id: 'ops', label: t('operatorsTab', 'Operators (Ops)'), count: (overview?.operators || []).length, icon: Crown },
          { id: 'whitelist', label: t('whitelistTab', 'Allowlist (Whitelist)'), count: (overview?.allowlist || []).length, icon: UserCheck },
          { id: 'bans', label: t('banListTab', 'Banned Players'), count: (overview?.bannedPlayers || []).length, icon: UserX },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-800 border border-transparent'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-emerald-400' : 'text-slate-500'} />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-dark-800 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div key={activeTab} className="animate-tab-enter">
        {/* Tab 1: Online Players */}
        {activeTab === 'online' && (
        <div className="space-y-4 stagger-settle">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t('players.connectedCount', 'Currently connected to this BDS instance ({n})').replace('{n}', String((overview?.onlinePlayers || []).length))}</span>
            {server?.status !== 'ONLINE' && (
              <span className="text-amber-400 flex items-center gap-1 font-medium">
                <AlertTriangle size={13} /> {t('players.serverOfflineWarning', 'Server is offline. Start the server to accept connections.')}
              </span>
            )}
          </div>

          {(overview?.onlinePlayers || []).length === 0 ? (
            <div className="bg-dark-850 p-12 rounded-2xl border border-dark-750 text-center space-y-2">
              <Users size={32} className="mx-auto text-slate-600 mb-2" />
              <div className="text-sm font-semibold text-slate-300">{t('noPlayersOnline', 'No Players Currently Online')}</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {t('players.connectPrompt', 'Connect your Minecraft Bedrock client to {addr} to see active players in real time.').replace('{addr}', `127.0.0.1:${server?.port || 19132}`)}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(overview?.onlinePlayers || []).map(player => (
                <div 
                  key={player.xuid || player.name}
                  className="bg-dark-850 rounded-2xl border border-dark-750 p-4 flex flex-col justify-between space-y-4 hover:border-dark-650 transition-all shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-xs text-emerald-400">
                          {player.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                            {player.name}
                            {player.permission === 'operator' && (
                              <span title={t('operator', 'Operator')}>
                                <Crown size={13} className="text-amber-400" />
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            XUID: {player.xuid || "Local"}
                          </div>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {t('online', 'ONLINE')}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="text-slate-500" />
                        {t('players.connected', 'Connected: ')}{player.connectedAt ? new Date(player.connectedAt).toLocaleTimeString() : t('players.justNow', 'Just now')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-dark-750 flex items-center justify-between gap-1">
                    <button
                      onClick={() => {
                        if (player.permission === 'operator') {
                          handleRemoveOp(player.xuid, player.name);
                        } else {
                          Api.opPlayer(player.name, player.xuid).then(loadOverview);
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 ${
                        player.permission === 'operator'
                          ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30'
                          : 'bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700'
                      }`}
                    >
                      <Crown size={12} />
                      {player.permission === 'operator' ? t('removeOp', 'Demote') : t('makeOp', 'Make Op')}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setTargetPlayer(player);
                          setShowKickModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-amber-400 border border-dark-700 text-xs font-semibold transition-all active:scale-95"
                      >
                        {t('kickPlayer', 'Kick')}
                      </button>

                      <button
                        onClick={() => {
                          setTargetPlayer(player);
                          setInputName(player.name);
                          setInputXuid(player.xuid);
                          setShowBanModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all active:scale-95"
                      >
                        {t('banPlayer', 'Ban')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Operators (Ops / Admins) */}
      {activeTab === 'ops' && (
        <div className="space-y-4 stagger-settle">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {t('players.opsDesc', 'Players configured with operator permissions in permissions.json can execute admin commands.')}
            </p>
            <button
              onClick={() => {
                setInputName('');
                setInputXuid('');
                setShowAddOpModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all shadow-md flex items-center gap-1.5 active:scale-95"
            >
              <Plus size={14} /> {t('addOperator', 'Add Operator')}
            </button>
          </div>

          {(overview?.operators || []).length === 0 ? (
            <div className="bg-dark-850 p-12 rounded-2xl border border-dark-750 text-center text-xs text-slate-400">
              {t('noOperators', 'No operators configured. Click Add Operator to grant admin privileges.')}
            </div>
          ) : (
            <div className="bg-dark-850 rounded-2xl border border-dark-750 divide-y divide-dark-750 overflow-hidden shadow-md">
              {(overview?.operators || []).map(op => (
                <div key={op.xuid} className="p-4 flex items-center justify-between hover:bg-dark-800/50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Crown size={15} />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-100">{op.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">XUID: {op.xuid}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {t('operator', 'OPERATOR')}
                    </span>
                    <button
                      onClick={() => handleRemoveOp(op.xuid, op.name)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-dark-800 transition-all"
                      title={t('removeOp', 'Revoke operator')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Allowlist (Whitelist) */}
      {activeTab === 'whitelist' && (
        <div className="space-y-4 stagger-settle">
          <div className="bg-dark-850 p-4 rounded-2xl border border-dark-750 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Shield size={16} className="text-emerald-400" />
                {t('allowlistEnforced', 'Allowlist Enforcement')}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('allowlistEnforcedDesc', 'When enabled, only players registered on the allowlist can join the server.')}
              </p>
            </div>

            <button
              onClick={handleToggleAllowlist}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 ${
                overview.allowListEnabled 
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' 
                  : 'bg-dark-800 text-slate-400 border border-dark-700'
              }`}
            >
              {overview.allowListEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              {overview.allowListEnabled ? t('enabled', 'Enforced (Active)') : t('disabled', 'Disabled (Open Server)')}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {t('players.whitelistedCount', 'Whitelisted Players ({n})').replace('{n}', String((overview?.allowlist || []).length))}
            </div>
            <button
              onClick={() => {
                setInputName('');
                setInputXuid('');
                setInputIgnoresLimit(false);
                setShowAddWhitelistModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all shadow-md flex items-center gap-1.5 active:scale-95"
            >
              <Plus size={14} /> {t('addWhitelist', 'Add Player')}
            </button>
          </div>

          {(overview?.allowlist || []).length === 0 ? (
            <div className="bg-dark-850 p-12 rounded-2xl border border-dark-750 text-center text-xs text-slate-400">
              {t('noWhitelist', 'No players on the whitelist. Click Add Player to register allowed Gamertags.')}
            </div>
          ) : (
            <div className="bg-dark-850 rounded-2xl border border-dark-750 divide-y divide-dark-750 overflow-hidden shadow-md">
              {(overview?.allowlist || []).map(w => (
                <div key={w.xuid || w.name} className="p-4 flex items-center justify-between hover:bg-dark-800/50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
                      {w.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-100">{w.name}</div>
                      {w.xuid && <div className="text-[11px] text-slate-500 font-mono">XUID: {w.xuid}</div>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {w.ignoresPlayerLimit && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {t('players.ignoresLimit', 'IGNORES LIMIT')}
                      </span>
                    )}
                    <button
                      onClick={() => handleRemoveWhitelist(w.xuid || w.name)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-dark-800 transition-all"
                      title={t('delete', 'Remove from whitelist')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Banned Players */}
      {activeTab === 'bans' && (
        <div className="space-y-4 stagger-settle">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {t('players.bansDesc', 'Banned players are automatically blocked from entering the server and kicked on connection.')}
            </p>
            <button
              onClick={() => {
                setInputName('');
                setInputXuid('');
                setInputReason('');
                setShowBanModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-slate-100 font-bold text-xs transition-all shadow-md flex items-center gap-1.5 active:scale-95"
            >
              <Plus size={14} /> {t('banPlayer', 'Ban Player')}
            </button>
          </div>

          {(overview?.bannedPlayers || []).length === 0 ? (
            <div className="bg-dark-850 p-12 rounded-2xl border border-dark-750 text-center text-xs text-slate-400">
              {t('noBanned', 'No players currently banned. Clean record!')}
            </div>
          ) : (
            <div className="bg-dark-850 rounded-2xl border border-dark-750 divide-y divide-dark-750 overflow-hidden shadow-md">
              {(overview?.bannedPlayers || []).map(ban => (
                <div key={ban.xuid || ban.name} className="p-4 flex items-center justify-between hover:bg-dark-800/50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                      <UserX size={15} />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        {ban.name}
                        <span className="text-xs font-normal text-rose-400/80 italic">"{ban.reason}"</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {t('date', 'Banned on')}: {new Date(ban.bannedAt).toLocaleString()} • {ban.bannedBy || 'Admin'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUnban(ban.xuid || ban.name)}
                    className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 hover:text-emerald-400 border border-dark-700 text-xs font-semibold transition-all active:scale-95"
                  >
                    {t('unbanPlayer', 'Pardon / Unban')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>

      {/* Modal: Add Operator */}
      {showAddOpModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Crown size={16} className="text-amber-400" /> {t('addOperator', 'Add Operator (Admin)')}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">{t('playerName', 'Player Gamertag')}</label>
                <input
                  type="text"
                  value={inputName}
                  onChange={e => setInputName(e.target.value)}
                  placeholder="e.g. Steve"
                  className="w-full bg-dark-950 border border-dark-750 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t('playerXuid', 'XUID (Optional if Gamertag is given)')}</label>
                <input
                  type="text"
                  value={inputXuid}
                  onChange={e => setInputXuid(e.target.value)}
                  placeholder="e.g. 2535412345678901"
                  className="w-full bg-dark-950 border border-dark-750 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddOpModal(false)}
                className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold active:scale-95"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                onClick={handleAddOp}
                className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs shadow-md active:scale-95"
              >
                {t('makeOp', 'Grant Operator')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Whitelist */}
      {showAddWhitelistModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <UserCheck size={16} className="text-emerald-400" /> {t('addWhitelist', 'Add to Allowlist')}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">{t('playerName', 'Player Gamertag *')}</label>
                <input
                  type="text"
                  value={inputName}
                  onChange={e => setInputName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full bg-dark-950 border border-dark-750 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t('playerXuid', 'XUID (Optional)')}</label>
                <input
                  type="text"
                  value={inputXuid}
                  onChange={e => setInputXuid(e.target.value)}
                  placeholder={t('players.optionalXuid', 'Optional Xbox User ID')}
                  className="w-full bg-dark-950 border border-dark-750 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="ignoresLimit"
                  checked={inputIgnoresLimit}
                  onChange={e => setInputIgnoresLimit(e.target.checked)}
                  className="rounded bg-dark-950 border-dark-700 text-brand-500 focus:ring-0"
                />
                <label htmlFor="ignoresLimit" className="text-slate-300">
                  {t('players.canJoinFull', 'Can join even when server is full (Ignores Player Limit)')}
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddWhitelistModal(false)}
                className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold active:scale-95"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                onClick={handleAddWhitelist}
                className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs shadow-md active:scale-95"
              >
                {t('addWhitelist', 'Add to Whitelist')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ban Player */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-2 text-rose-400">
              <UserX size={16} /> {t('banPlayer', 'Ban Player from Server')}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">{t('playerName', 'Player Gamertag *')}</label>
                <input
                  type="text"
                  value={inputName}
                  onChange={e => setInputName(e.target.value)}
                  placeholder={t('players.gamertagToBan', 'Gamertag to ban')}
                  className="w-full bg-dark-950 border border-dark-750 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t('banReason', 'Reason for Ban')}</label>
                <input
                  type="text"
                  value={inputReason}
                  onChange={e => setInputReason(e.target.value)}
                  placeholder={t('players.banReasonPlaceholder', 'e.g. Griefing spawn area, cheating')}
                  className="w-full bg-dark-950 border border-dark-750 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBanModal(false)}
                className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold active:scale-95"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                onClick={handleExecuteBan}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-slate-100 font-bold text-xs shadow-md active:scale-95"
              >
                {t('confirm', 'Confirm Ban')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Kick Player */}
      {showKickModal && targetPlayer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-2 text-amber-400">
              <UserX size={16} /> {t('players.kickPlayerTitle', 'Kick Player: {name}').replace('{name}', targetPlayer.name)}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">{t('kickReason', 'Reason (Sent to player)')}</label>
                <input
                  type="text"
                  value={inputReason}
                  onChange={e => setInputReason(e.target.value)}
                  placeholder={t('players.kickReasonPlaceholder', 'e.g. AFK, please reconnect later')}
                  className="w-full bg-dark-950 border border-dark-750 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowKickModal(false)}
                className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold active:scale-95"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                onClick={handleExecuteKick}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md active:scale-95"
              >
                {t('kickPlayer', 'Kick Now')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
