import React, { useEffect, useState } from 'react';
import { 
  Box, 
  ShieldCheck, 
  RotateCw
} from 'lucide-react';
import { Api } from '../services/api';
import { Mod, Server } from '../types';
import { useI18n } from '../i18n/translations';

interface DependenciesProps {
  server: Server | null;
}

export const Dependencies: React.FC<DependenciesProps> = ({ server }) => {
  const { t } = useI18n();
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (server) {
      loadDependencies();
    }
  }, [server]);

  const loadDependencies = async () => {
    if (!server) return;
    setLoading(true);
    try {
      const list = await Api.listMods(server.id);
      setMods(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">
            {t('dependenciesTitle', 'Dependency Hierarchy')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('dependenciesDesc', 'Tree relationship graph between LeviLamina mod framework, core libraries, and dependent plugins.')}
          </p>
        </div>

        <button
          onClick={loadDependencies}
          className="p-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700 cursor-pointer"
          title={t('refresh', 'Refresh')}
        >
          <RotateCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Visual Dependency Tree */}
      <div className="bg-dark-850 rounded-2xl border border-dark-750 p-6 space-y-6 shadow-lg">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-dark-900 border border-brand-500/30">
          <div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-500 font-bold">
            LL
          </div>
          <div>
            <div className="font-bold text-sm text-slate-100">
              {t('rootFramework', 'LeviLamina Mod Loader (Root Framework)')}
            </div>
            <div className="text-xs text-slate-400 font-mono">
              bedrock_server_mod.exe • {t('status', 'Status')}: {t('active', 'Active')}
            </div>
          </div>
        </div>

        {/* Tree Branches */}
        <div className="pl-6 border-l-2 border-dark-700 ml-5 space-y-4">
          {(mods || []).length === 0 ? (
            <div className="text-xs text-slate-500 italic py-2">
              {t('noSecondaryDependencies', 'No secondary mod dependencies registered.')}
            </div>
          ) : (
            (mods || []).map((m) => (
              <div key={m.name} className="relative pl-6">
                <div className="absolute left-0 top-3 w-4 h-0.5 bg-dark-700" />
                <div className="bg-dark-900 p-3.5 rounded-xl border border-dark-750 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Box size={16} className="text-purple-400" />
                    <div>
                      <span className="font-bold text-xs text-slate-200">{m.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-2">v{m.version}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    {(m.dependencies || []).length > 0 ? (
                      <span className="text-brand-accent">
                        {t('requires', 'Requires')}: {(m.dependencies || []).join(', ')}
                      </span>
                    ) : (
                      <span className="text-slate-500">{t('noSubDependencies', 'No sub-dependencies')}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Safety Notice */}
      <div className="p-4 rounded-xl bg-dark-850 border border-dark-750 text-xs text-slate-300 flex items-start gap-3">
        <ShieldCheck size={18} className="text-brand-500 mt-0.5 shrink-0" />
        <p className="leading-relaxed">
          <strong className="text-slate-100">{t('safeRemovalTitle', 'Safe Removal Protection:')}</strong>{' '}
          {t('safeRemovalDesc', 'If you attempt to remove or disable a package required by another plugin, LeviLamina Server Manager warns you and blocks accidental deletion until child dependencies are resolved.')}
        </p>
      </div>
    </div>
  );
};
