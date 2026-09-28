import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Search, 
  Download, 
  CheckCircle2, 
  Package, 
  Globe, 
  Sparkles, 
  RefreshCw, 
  HardDrive, 
  Check, 
  AlertCircle,
  TrendingUp,
  Clock,
  ArrowDownCircle,
  Layers,
  ChevronDown
} from 'lucide-react';
import { Api } from '../services/api';
import { Server, CurseForgeCatalogItem } from '../types';
import { useI18n } from '../i18n';

interface CurseForgePageProps {
  server: Server | null;
  onNavigatePage?: (page: string, payload?: any) => void;
}

export const CurseForgePage: React.FC<CurseForgePageProps> = ({ server, onNavigatePage }) => {
  const { t } = useI18n();
  const [items, setItems] = useState<CurseForgeCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [sortField, setSortField] = useState<number>(3); // 3 = LastUpdated (Newest), 2 = Popularity, 5 = Downloads
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [isSyncingCurseForge, setIsSyncingCurseForge] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleCheckUpdates = async () => {
    setIsSyncingCurseForge(true);
    try {
      const rep = await Api.refreshCurseForgeCatalog();
      showToast(`CurseForge Synced: ${rep.totalItemsCount} Bedrock addons verified live!`);
      await loadCatalog(1, false);
    } catch (err: any) {
      showToast('Failed to check CurseForge updates: ' + (err?.message || err), 'error');
    } finally {
      setIsSyncingCurseForge(false);
    }
  };

  const loadCatalog = async (pageNumber = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await Api.getCurseForgeCatalogLive(searchQuery, category, sortField, pageNumber, 24);
      if (append) {
        setItems(prev => [...prev, ...(res.items || [])]);
      } else {
        setItems(res.items || []);
      }
      setTotalCount(res.totalCount || 0);
      setPage(pageNumber);
    } catch (e: any) {
      console.error("Failed to load CurseForge live catalog:", e);
      showToast(t('actionFailed', 'Operation failed:') + " " + e.message, 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCatalog(1, false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, category, sortField]);

  const handleInstall = async (item: CurseForgeCatalogItem) => {
    if (!server) {
      showToast(t('noServerSelectedToast', 'Please select a server first in the sidebar or top bar!'), 'error');
      return;
    }

    setInstallingId(item.id);
    try {
      await Api.installCurseForgeItemLive(
        server.id, 
        item.modId || 0, 
        item.fileId || 0, 
        item.downloadUrl || "", 
        item.fileName || ""
      );
      showToast(`${t('installedSuccessfully', 'Installed successfully:')} ${item.name}`);
      // Mark as installed locally
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, isInstalled: true } : p));
    } catch (err: any) {
      showToast(`${t('installFailed', 'Failed to install:')} ${err.message}`, 'error');
    } finally {
      setInstallingId(null);
    }
  };

  const handleLoadMore = () => {
    if (loading || loadingMore) return;
    loadCatalog(page + 1, true);
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 w-full animate-page-enter">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 ${
          toast.type === 'success' 
            ? 'bg-dark-900 border-emerald-500/50 text-slate-100' 
            : 'bg-dark-900 border-rose-500/50 text-rose-200'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-400" />
          ) : (
            <AlertCircle size={18} className="text-rose-400" />
          )}
          <span className="text-xs font-semibold">{toast.msg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-down">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-md">
            <Flame size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-100 uppercase tracking-tight">
                {t('curseForgeTabTitle', 'CurseForge Bedrock')}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                {t('extension', 'Extension')}
              </span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {t('liveSync', 'Real-Time Sync')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('curseForgeTabSubtitle', 'Explore community add-ons, worlds, and textures with in-app 1-click installation.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-dark-850 border border-dark-750 flex items-center gap-2 text-xs">
            <HardDrive size={14} className="text-orange-400" />
            <span className="text-slate-400">{t('activeServer', 'Target:')}</span>
            <span className="font-bold text-white truncate max-w-[140px]">
              {server ? server.name : t('noServerSelected', 'None Selected')}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCheckUpdates}
            disabled={isSyncingCurseForge}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 text-xs font-bold border border-orange-500/30 transition-all active:scale-95 cursor-pointer shadow-sm disabled:opacity-50"
            title="Check for updates and sync latest CurseForge releases live"
          >
            <RefreshCw size={13} className={isSyncingCurseForge ? "animate-spin" : ""} />
            <span>{isSyncingCurseForge ? t('syncing', 'Syncing...') : t('checkUpdatesSync', 'Check Updates & Sync')}</span>
          </button>

          <button
            type="button"
            onClick={() => loadCatalog(1, false)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold border border-dark-700 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            title={t('refresh', 'Refresh')}
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-orange-400" : ""} />
            <span>{t('refresh', 'Refresh')}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-dark-850 rounded-2xl border border-dark-750 p-4 space-y-3 shadow-md animate-slide-down">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('searchCurseForgePacks', 'Search CurseForge Bedrock add-ons, texture packs, or worlds (e.g. Bare Bones, Actions & Stuff)...')}
              className="w-full bg-dark-900 border border-dark-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-orange-500"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 w-full md:w-auto shrink-0 bg-dark-900 p-1 rounded-xl border border-dark-750">
            <button
              type="button"
              onClick={() => setSortField(3)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                sortField === 3 
                  ? 'bg-orange-500 text-slate-950 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Real-time newly uploaded Bedrock add-ons"
            >
              <Clock size={13} />
              <span>{t('sortNewest', 'Newest Uploads')}</span>
            </button>
            <button
              type="button"
              onClick={() => setSortField(2)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                sortField === 2 
                  ? 'bg-orange-500 text-slate-950 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp size={13} />
              <span>{t('sortPopular', 'Most Popular')}</span>
            </button>
            <button
              type="button"
              onClick={() => setSortField(5)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                sortField === 5 
                  ? 'bg-orange-500 text-slate-950 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowDownCircle size={13} />
              <span>{t('sortDownloads', 'Downloads')}</span>
            </button>
          </div>
        </div>

        {/* Categories Bar & Results Count */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-dark-750/60">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: t('all', 'All') },
              { id: 'addon', label: t('addons', 'Add-Ons') },
              { id: 'texture', label: t('textures', 'Texture Packs') },
              { id: 'world', label: t('worlds', 'Worlds') },
              { id: 'script', label: t('scripts', 'Scripts') },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setCategory(f.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  category === f.id
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                    : 'bg-dark-900 text-slate-400 hover:text-slate-200 border border-dark-750'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            <span>{t('showingResults', 'Showing')}</span>
            <span className="text-orange-400 font-bold">{items.length}</span>
            {totalCount > 0 && (
              <>
                <span>{t('of', 'of')}</span>
                <span className="text-slate-300 font-bold">{totalCount}</span>
              </>
            )}
            <span>{t('bedrockUploads', 'community uploads')}</span>
          </div>
        </div>
      </div>

      {/* Grid of Catalog Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-settle">
        {items.map((item, idx) => {
          const isInstalling = installingId === item.id;
          const isTexture = item.category === 'texture';

          return (
            <div
              key={`${item.id}-${idx}`}
              className="bg-dark-850 rounded-2xl border border-dark-750 p-5 space-y-4 hover:border-orange-500/40 hover:bg-dark-800/60 transition-all flex flex-col justify-between group shadow-md animate-spring-pop"
              style={{ animationDelay: `${(idx % 12) * 35}ms` }}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.thumbnailUrl ? (
                      <img 
                        src={item.thumbnailUrl} 
                        alt={item.name}
                        className="w-12 h-12 rounded-xl object-cover border border-dark-700 shrink-0 bg-dark-900 shadow-sm"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                          const fallback = (e.currentTarget as HTMLElement).parentElement?.querySelector('.cf-fallback-icon') as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}

                    <div className={`w-12 h-12 rounded-xl items-center justify-center shrink-0 border shadow-sm cf-fallback-icon ${
                      item.thumbnailUrl ? 'hidden' : 'flex'
                    } ${
                      isTexture
                        ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                        : 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                    }`}>
                      {isTexture ? <Sparkles size={24} /> : <Package size={24} />}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-slate-100 truncate group-hover:text-orange-300 transition-colors" title={item.name}>
                        {item.name}
                      </h3>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-semibold text-slate-300 truncate max-w-[100px]">{item.author}</span>
                        <span>•</span>
                        <span className="font-mono text-orange-400/90 shrink-0">{item.version || "Latest"}</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-dark-900 border border-dark-750 text-slate-300 shrink-0">
                    {item.downloadCount}
                  </span>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {item.summary || item.name}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-dark-800">
                  <span className="flex items-center gap-1">
                    <Clock size={11} className="text-orange-400/80" />
                    <span>{item.updatedDate || "Recently updated"}</span>
                  </span>
                  <span className="font-mono font-semibold text-slate-300">
                    {item.sizeFormatted || "Ready"}
                  </span>
                </div>

                {item.tags && item.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {item.tags.map((tag, tIdx) => (
                      <span key={tIdx} className="text-[10px] px-2 py-0.5 rounded-md bg-dark-900/80 border border-dark-750 text-slate-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-dark-750 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleInstall(item)}
                  disabled={isInstalling}
                  className="flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-md bg-orange-500 hover:bg-orange-600 text-slate-950 shadow-orange-500/20 disabled:opacity-50"
                >
                  {isInstalling ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>{t('installing', 'Installing...')}</span>
                    </>
                  ) : item.isInstalled ? (
                    <>
                      <Check size={13} strokeWidth={3} />
                      <span>{t('reinstallPack', 'Reinstall Pack')}</span>
                    </>
                  ) : (
                    <>
                      <Download size={13} />
                      <span>{t('installToServer', 'Install to Server')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More Button */}
      {items.length > 0 && items.length < totalCount && (
        <div className="flex justify-center pt-4 pb-6">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-orange-400 border border-orange-500/30 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {loadingMore ? (
              <RefreshCw size={14} className="animate-spin text-orange-400" />
            ) : (
              <ChevronDown size={14} />
            )}
            <span>{loadingMore ? t('loading', 'Loading...') : t('loadMore', 'Load More Add-Ons')}</span>
          </button>
        </div>
      )}

      {items.length === 0 && !loading && (
        <div className="bg-dark-850 rounded-2xl border border-dark-750 p-12 text-center space-y-3 animate-spring-pop">
          <Flame size={32} className="mx-auto text-slate-600" />
          <h3 className="text-sm font-bold text-slate-300">
            {t('noCurseForgeResults', 'No Community Packs Found')}
          </h3>
          <p className="text-xs text-slate-500">
            {t('tryDifferentQuery', 'Try clearing your search query or selecting a different category.')}
          </p>
        </div>
      )}
    </div>
  );
};

export default CurseForgePage;
