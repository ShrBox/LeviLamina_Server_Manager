import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  HelpCircle, 
  RotateCw,
  ShieldCheck
} from 'lucide-react';
import { Api } from '../services/api';
import { CompatibilityReport, CompatibilityStatus, Server } from '../types';
import { useI18n } from '../i18n/translations';

interface CompatibilityProps {
  server: Server | null;
}

export const Compatibility: React.FC<CompatibilityProps> = ({ server }) => {
  const { t } = useI18n();
  const [report, setReport] = useState<CompatibilityReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (server) {
      loadReport();
    }
  }, [server]);

  const loadReport = async () => {
    if (!server) return;
    setLoading(true);
    try {
      const res = await Api.checkCompatibility(server.id);
      setReport(res);
    } catch (err) {
      console.error("Failed to check compatibility:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: CompatibilityStatus) => {
    switch (status) {
      case 'COMPATIBLE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
            <CheckCircle2 size={12} /> {t('compatible', 'COMPATIBLE')}
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
            <AlertTriangle size={12} /> {t('warning', 'WARNING')}
          </span>
        );
      case 'INCOMPATIBLE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-sm">
            <XCircle size={12} /> {t('incompatible', 'INCOMPATIBLE')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 shadow-sm">
            <HelpCircle size={12} /> {t('unknown', 'UNKNOWN')}
          </span>
        );
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 stagger-settle custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="animate-slide-left">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">
                {t('compatibilityTitle', 'Ecosystem Compatibility Engine')}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('compatibilityDesc', 'Real-time validation between Minecraft BDS, LeviLamina framework, installed plugins, and Bedrock Add-Ons.')}
              </p>
            </div>
          </div>
        </div>

        <div className="animate-slide-right">
          <button
            onClick={loadReport}
            disabled={loading}
            className="p-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700 transition-all cursor-pointer shadow-md hover:border-brand-500/40 active:scale-95"
            title={t('reRunCompatibility', 'Re-run compatibility analysis')}
          >
            <RotateCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger-settle">
        <div className="launcher-card p-4 rounded-xl border border-white/[0.06] glass-panel-hover animate-settle">
          <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider block">
            {t('compatible', 'Compatible')}
          </span>
          <span className="text-2xl font-black text-slate-100 mt-0.5 block">{report?.compatibleCount ?? 0}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {t('compatibleCountDesc', 'Components ready')}
          </span>
        </div>

        <div className="launcher-card p-4 rounded-xl border border-white/[0.06] glass-panel-hover animate-settle" style={{ animationDelay: '50ms' }}>
          <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider block">
            {t('warnings', 'Warnings')}
          </span>
          <span className="text-2xl font-black text-slate-100 mt-0.5 block">{report?.warningCount ?? 0}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {t('warningsCountDesc', 'Potential issues')}
          </span>
        </div>

        <div className="launcher-card p-4 rounded-xl border border-white/[0.06] glass-panel-hover animate-settle" style={{ animationDelay: '100ms' }}>
          <span className="text-[10px] font-extrabold text-rose-400 uppercase tracking-wider block">
            {t('incompatible', 'Incompatible')}
          </span>
          <span className="text-2xl font-black text-slate-100 mt-0.5 block">{report?.incompatibleCount ?? 0}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {t('incompatibleCountDesc', 'Conflicts detected')}
          </span>
        </div>

        <div className="launcher-card p-4 rounded-xl border border-white/[0.06] glass-panel-hover animate-settle" style={{ animationDelay: '150ms' }}>
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
            {t('unknown', 'Unknown')}
          </span>
          <span className="text-2xl font-black text-slate-100 mt-0.5 block">{report?.unknownCount ?? 0}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {t('unknownCountDesc', 'Unspecified metadata')}
          </span>
        </div>
      </div>

      {/* Itemized List */}
      <div className="launcher-card rounded-2xl border border-white/[0.08] overflow-hidden shadow-xl animate-card-pop">
        <div className="p-4 border-b border-white/[0.06] bg-dark-950/60 flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
          <span>{t('componentAndStatus', 'Component & Status')}</span>
          <span>{t('requirements', 'Requirements')}</span>
        </div>

        <div className="divide-y divide-white/[0.04] stagger-settle">
          {!report || report.items.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              {t('noComponentsToAnalyze', 'No components to analyze on this server.')}
            </div>
          ) : (
            report.items.map((item, idx) => (
              <div 
                key={idx} 
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors animate-settle"
                style={{ animationDelay: `${Math.min(idx * 40, 400)}ms` }}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-100">{item.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-dark-750 text-slate-400 border border-dark-700">
                      {item.type}
                    </span>
                    {getStatusBadge(item.status)}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                    {item.details}
                  </p>
                </div>

                <div className="text-right text-xs font-mono shrink-0">
                  <div className="text-slate-400 text-[11px]">
                    {t('required', 'Required')}: <span className="text-slate-200">{item.requiredVersion || t('anyVersion', 'Any')}</span>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    {t('current', 'Current')}: <span className="text-slate-200">{item.currentVersion || 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
