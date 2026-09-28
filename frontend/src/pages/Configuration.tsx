import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Save, 
  RotateCw, 
  Globe, 
  CheckCircle2, 
  Cpu
} from 'lucide-react';
import { Api } from '../services/api';
import { Server } from '../types';
import { CustomSelect } from '../components/CustomSelect';
import { useI18n } from '../i18n';

interface ConfigurationProps {
  server: Server | null;
}

export const Configuration: React.FC<ConfigurationProps> = ({ server }) => {
  const { t } = useI18n();
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('focus_memory')) {
      sessionStorage.removeItem('focus_memory');
      setTimeout(() => {
        const el = document.getElementById('memory-allocation-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          el.classList.add('ring-2', 'ring-purple-500/60');
          setTimeout(() => el.classList.remove('ring-2', 'ring-purple-500/60'), 2500);
        }
      }, 200);
    }
  }, []);

  useEffect(() => {
    if (server) {
      loadProperties();
    }
  }, [server]);

  const loadProperties = async () => {
    if (!server) return;
    setLoading(true);
    try {
      const props = await Api.getServerProperties(server.id);
      setProperties(props);
    } catch (err) {
      console.error("Failed to load server properties:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setProperties(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!server) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await Api.saveServerProperties(server.id, properties);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert("Failed to save properties: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!server) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center text-slate-400">
          <p className="text-sm">{t('pleaseSelectServer', 'Please select a server to manage configurations.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 stagger-settle">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="animate-slide-left">
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">
            {t('configTitle', 'Server Configuration')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('configSubtitle', 'Safe visual editor for server.properties. Comments and unrecognized keys are cleanly preserved.')}
          </p>
        </div>

        <div className="flex items-center gap-2 animate-slide-right">
          <button
            onClick={loadProperties}
            disabled={loading}
            className="p-2 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700 transition-all active:scale-95"
            title={t('reloadFromFile', 'Reload from file')}
          >
            <RotateCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-brand-500/20 active:scale-95 disabled:opacity-50"
          >
            {saving ? <RotateCw size={14} className="animate-spin" /> : <Save size={14} />}
            {t('saveProperties', 'Save Properties')}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs animate-in fade-in">
          <CheckCircle2 size={15} />
          <span>{t('propertiesCommitted', 'Properties successfully committed to server.properties')}</span>
        </div>
      )}

      {/* Main Settings Grid */}
      <div className="space-y-6 stagger-settle">
        {/* General Settings */}
        <div className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Globe size={15} className="text-brand-500" /> {t('generalSettings', 'General Server Settings')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">{t('serverMotd', 'Server Name (MOTD)')}</label>
              <input
                type="text"
                value={properties['server-name'] || ''}
                onChange={(e) => handleChange('server-name', e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">{t('activeLevelName', 'Active Level Name (World Folder)')}</label>
              <input
                type="text"
                value={properties['level-name'] || ''}
                onChange={(e) => handleChange('level-name', e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">{t('defaultGamemode', 'Default Game Mode')}</label>
              <CustomSelect
                value={properties['gamemode'] || 'survival'}
                onChange={(val) => handleChange('gamemode', String(val))}
                options={[
                  { value: 'survival', label: t('survival', 'Survival') },
                  { value: 'creative', label: t('creative', 'Creative') },
                  { value: 'adventure', label: t('adventure', 'Adventure') },
                ]}
                fullWidth
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">{t('difficultyLabel', 'Difficulty')}</label>
              <CustomSelect
                value={properties['difficulty'] || 'easy'}
                onChange={(val) => handleChange('difficulty', String(val))}
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

        {/* Memory Allocation */}
        <div id="memory-allocation-section" className="bg-dark-850 p-5 rounded-2xl border border-dark-750 space-y-4 transition-all duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Cpu size={16} className="text-brand-400" /> {t('dedicatedRam', 'Dedicated Memory (RAM) Allocation')}
            </h2>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-900 border border-dark-700 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
              <span className="text-xs font-mono font-black text-brand-400">
                {((parseInt(properties['max-memory-mb'] || '4096', 10) || 4096) / 1024).toFixed(1)} GB
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                ({properties['max-memory-mb'] || '4096'} MB)
              </span>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(properties['max-memory-mb'] || '4096', 10) || 4096;
                  handleChange('max-memory-mb', String(Math.max(1024, current - 1024)));
                }}
                className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 font-bold text-xs border border-dark-700 transition-all active:scale-95"
              >
                - 1 GB
              </button>

              <div className="relative flex items-center">
                <input
                  type="number"
                  step="512"
                  min="1024"
                  max="32768"
                  value={properties['max-memory-mb'] || '4096'}
                  onChange={(e) => handleChange('max-memory-mb', e.target.value)}
                  className="w-36 bg-dark-900 border border-dark-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 font-mono text-center font-bold text-sm focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-all"
                />
                <span className="absolute right-3 text-[10px] font-mono font-bold text-slate-500 pointer-events-none">MB</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const current = parseInt(properties['max-memory-mb'] || '4096', 10) || 4096;
                  handleChange('max-memory-mb', String(Math.min(32768, current + 1024)));
                }}
                className="px-4 py-2 rounded-xl bg-brand-500/15 hover:bg-brand-500/25 text-brand-400 font-bold text-xs border border-brand-500/30 transition-all active:scale-95"
              >
                + 1 GB
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-slate-400 text-xs font-medium mr-1">{t('quickPresets', 'Quick Presets')}:</span>
              {[
                { label: '2 GB', mb: '2048' },
                { label: '4 GB', mb: '4096' },
                { label: '8 GB', mb: '8192' },
                { label: '16 GB', mb: '16384' },
              ].map(preset => {
                const isSelected = (properties['max-memory-mb'] || '4096') === preset.mb;
                return (
                  <button
                    key={preset.mb}
                    type="button"
                    onClick={() => handleChange('max-memory-mb', preset.mb)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/25 scale-[1.02]'
                        : 'bg-dark-800 text-slate-300 hover:bg-dark-750 hover:text-white border border-dark-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400">
              {t('ramDesc', 'Allocated ceiling for BDS and LeviLamina working set memory. Prevents out-of-memory crashes during intensive chunk loading.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
