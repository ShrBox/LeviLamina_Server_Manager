import React, { useState, useEffect, useRef } from 'react';
import { Download, Search, Trash2, ShieldCheck, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n/translations';
import { Api } from '../services/api';

export const Logs: React.FC = () => {
  const { t } = useI18n();
  const [filter, setFilter] = useState('');
  const [appLogs, setAppLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const logs = await Api.getActivityLogs();
      if (logs && logs.length > 0) {
        setAppLogs(logs);
      }
    } catch (e) {
      console.error('Failed to load activity logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    // Listen for live activity events from Go backend
    let unhook: (() => void) | undefined;
    if (typeof window !== 'undefined' && window.runtime?.EventsOn) {
      unhook = window.runtime.EventsOn('app:activity', (line: string) => {
        setAppLogs(prev => [...prev, line]);
      });
    }

    return () => {
      if (unhook) unhook();
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [appLogs]);

  const handleClear = async () => {
    try {
      await Api.clearActivityLogs();
      const fresh = await Api.getActivityLogs();
      setAppLogs(fresh);
    } catch (e) {
      console.error('Failed to clear activity logs', e);
    }
  };

  const filtered = appLogs.filter(l => !filter || l.toLowerCase().includes(filter.toLowerCase()));

  const parseLogLine = (line: string) => {
    // Expected format: "[11:16:53 PM] [CATEGORY] message"
    const match = line.match(/^(\[[^\]]+\])\s*(\[[^\]]+\])?\s*(.*)$/);
    if (!match) return { time: '', cat: '', msg: line };

    const time = match[1] || '';
    const cat = match[2] ? match[2].replace(/[[\]]/g, '') : '';
    const msg = match[3] || '';

    return { time, cat, msg };
  };

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat.toUpperCase()) {
      case 'SERVER':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'SYSTEM':
        return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      case 'MARKETPLACE':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'BACKUP':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'ADDON':
      case 'MOD':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'SECURITY':
      case 'PREFLIGHT':
        return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
      case 'ERROR':
      case 'CRASH':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
    }
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-4 animate-page-enter">
      <div className="flex items-center justify-between pb-3 border-b border-dark-750/80">
        <div>
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck size={22} className="text-brand-500" />
            {t('activityLogsTitle', 'Application Activity Logs')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('activityLogsDesc', 'Internal audit trail of server management operations, package manager executions, and security checks.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('searchActivity', 'Search activity...')}
              className="bg-dark-900 border border-dark-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500 w-48"
            />
          </div>

          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            title={t('refresh', 'Refresh')}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="p-2 rounded-lg bg-dark-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 border border-dark-700 transition-all active:scale-95 cursor-pointer"
            title={t('clearLogs', 'Clear Activity Logs')}
          >
            <Trash2 size={14} />
          </button>

          <button
            type="button"
            onClick={() => {
              const blob = new Blob([appLogs.join('\n')], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `app_activity_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            className="p-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700 transition-all active:scale-95 cursor-pointer"
            title={t('exportActivityLog', 'Export Activity Log')}
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-dark-950 rounded-2xl border border-dark-800 p-4 font-mono text-xs overflow-y-auto space-y-2 shadow-inner">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
            {filter ? t('noMatchingLogs', 'No activity logs matching your filter.') : t('noLogsRecorded', 'No activity recorded yet.')}
          </div>
        ) : (
          filtered.map((log, idx) => {
            const { time, cat, msg } = parseLogLine(log);
            return (
              <div key={idx} className="flex items-start gap-2.5 text-slate-300 leading-relaxed hover:bg-dark-900/40 p-1 rounded-md transition-colors">
                <span className="text-slate-500 shrink-0 select-none text-[11px]">{time}</span>
                {cat && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${getCategoryBadgeClass(cat)}`}>
                    {cat}
                  </span>
                )}
                <span className="break-all text-slate-200">{msg}</span>
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default Logs;
