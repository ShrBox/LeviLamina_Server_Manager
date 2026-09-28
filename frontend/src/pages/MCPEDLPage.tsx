import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Search, 
  Download, 
  CheckCircle2, 
  Package, 
  Globe, 
  Layers, 
  FileCode, 
  RefreshCw, 
  HardDrive, 
  Check, 
  AlertCircle,
  TrendingUp,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Star,
  FolderDown,
  X,
  Filter
} from 'lucide-react';
import { Api } from '../services/api';
import { Server, MCPEDLCatalogItem, MCPEDLDownloadFile } from '../types';
import { useI18n } from '../i18n';
import { InstallButton } from '../components/InstallButton';

interface MCPEDLPageProps {
  server: Server | null;
  onNavigatePage?: (page: string, payload?: any) => void;
}

export const MCPEDLPage: React.FC<MCPEDLPageProps> = ({ server, onNavigatePage }) => {
  const { t } = useI18n();
  const [items, setItems] = useState<MCPEDLCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('latest');
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Modal for multiple files in an addon
  const [selectedItemForFiles, setSelectedItemForFiles] = useState<MCPEDLCatalogItem | null>(null);
  const [modalFiles, setModalFiles] = useState<MCPEDLDownloadFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [installingFileUrl, setInstallingFileUrl] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadCatalog = async (pageNumber = 1, append = false, queryToUse = searchQuery) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await Api.getMCPEDLCatalogLive(queryToUse, category, sortField, pageNumber, 24);
      const incoming = res.items || [];
      
      if (append) {
        setItems(prev => {
          const existingKeys = new Set(prev.map(p => (p.slug || p.id).toLowerCase()));
          const uniqueNew = incoming.filter(p => !existingKeys.has((p.slug || p.id).toLowerCase()));
          if (uniqueNew.length === 0) {
            setHasMore(false);
            return prev;
          }
          return [...prev, ...uniqueNew];
        });
      } else {
        const seen = new Set<string>();
        const unique = incoming.filter(p => {
          const k = (p.slug || p.id).toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setItems(unique);
        setHasMore(incoming.length >= 8);
      }

      setTotalCount(res.totalCount || 0);
      setPage(pageNumber);
      setActiveSearchTerm(queryToUse);
    } catch (e: any) {
      console.error("Failed to load MCPEDL catalog:", e);
      showToast(t('actionFailed', 'Operation failed:') + " " + e.message, 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Debounced search when user types
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCatalog(1, false, searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, category, sortField]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await Api.syncMCPEDLCatalog();
      const incoming = res.items || [];
      const seen = new Set<string>();
      const unique = incoming.filter(p => {
        const k = (p.slug || p.id).toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      setItems(unique);
      setTotalCount(res.totalCount || unique.length);
      setPage(1);
      setHasMore(unique.length >= 8);
      setSearchQuery('');
      setActiveSearchTerm('');
      showToast(t('mcpedlSyncSuccess', 'MCPEDL catalog synchronized successfully with latest upstream releases!'));
    } catch (e: any) {
      showToast(t('actionFailed', 'Sync failed:') + " " + e.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleInstall = async (item: MCPEDLCatalogItem, specificFile?: MCPEDLDownloadFile) => {
    if (!server) {
      showToast(t('noServerSelectedToast', 'Please select a server first in the sidebar or top bar!'), 'error');
      return;
    }

    const actionKey = specificFile ? specificFile.downloadUrl : item.id;
    if (specificFile) {
      setInstallingFileUrl(actionKey);
    } else {
      setInstallingId(actionKey);
    }

    try {
      await Api.installMCPEDLItemLive(
        server.id,
        item.slug,
        specificFile ? specificFile.downloadUrl : item.downloadUrl,
        specificFile ? specificFile.fileName : ""
      );

      showToast(`${t('installedSuccessfully', 'Installed successfully:')} ${specificFile ? specificFile.name : item.name}`);
      setItems(prev => prev.map(p => p.id === item.id || p.slug === item.slug ? { ...p, isInstalled: true } : p));
    } catch (err: any) {
      showToast(`${t('installFailed', 'Failed to install:')} ${err.message}`, 'error');
    } finally {
      setInstallingId(null);
      setInstallingFileUrl(null);
    }
  };

  const handleOpenFilesModal = async (item: MCPEDLCatalogItem) => {
    setSelectedItemForFiles(item);
    setLoadingFiles(true);
    setModalFiles([]);
    try {
      const files = await Api.getMCPEDLItemFiles(item.slug);
      setModalFiles(files);
    } catch (e: any) {
      showToast("Failed to fetch files: " + e.message, "error");
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleInstallAllModalFiles = async () => {
    if (!selectedItemForFiles || !server) return;
    for (const f of modalFiles) {
      await handleInstall(selectedItemForFiles, f);
    }
  };

  const handleLoadMore = () => {
    if (loading || loadingMore || !hasMore) return;
    loadCatalog(page + 1, true, searchQuery);
  };

  const categoryChips = [
    { id: 'all', label: t('all', 'All Add-Ons'), icon: Compass },
    { id: 'addons', label: t('addons', 'Add-Ons'), icon: Package },
    { id: 'texture-packs', label: t('texturePacks', 'Texture Packs'), icon: Layers },
    { id: 'maps', label: t('worlds', 'Maps & Worlds'), icon: Globe },
    { id: 'scripts', label: t('scripts', 'Scripts'), icon: FileCode },
  ];

  const quickSearchTags = [
    { label: 'Furniture', query: 'furniture' },
    { label: 'Backpacks', query: 'backpack' },
    { label: 'Weapons & Armor', query: 'weapon' },
    { label: 'Guns & Firearms', query: 'guns' },
    { label: 'Zombies Survival', query: 'zombie' },
    { label: 'Pokédrock', query: 'pokemon' },
    { label: 'Shaders', query: 'shader' },
    { label: 'Cars & Vehicles', query: 'vehicle' },
    { label: 'SkyBlock', query: 'skyblock' },
  ];

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
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
            <Compass size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-100 uppercase tracking-tight">
                {t('mcpedlTabTitle', 'MCPEDL Add-Ons Portal')}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {t('extension', 'Extension')}
              </span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {t('liveSync', 'Real-Time Sync')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('mcpedlTabSubtitle', 'Discover, browse, and 1-click install community-created Minecraft Bedrock add-ons directly into your server.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-xl bg-dark-850 border border-dark-750 flex items-center gap-2 text-xs">
            <HardDrive size={14} className="text-emerald-400" />
            <span className="text-slate-400">{t('activeServer', 'Target:')}</span>
            <span className="font-bold text-white truncate max-w-[140px]">
              {server ? server.name : t('noServerSelected', 'None Selected')}
            </span>
          </div>

          {/* Sync Button */}
          <button
            type="button"
            onClick={handleSync}
            disabled={loading || syncing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-300 text-xs font-black border border-emerald-500/40 transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/10 disabled:opacity-50"
            title="Purge cache and synchronize MCPEDL catalog live with upstream releases"
          >
            <RefreshCw size={14} className={syncing || loading ? "animate-spin text-emerald-400" : ""} />
            <span>{syncing ? t('syncing', 'Syncing...') : t('checkUpdatesSync', 'Check Updates & Sync')}</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Enhanced Search Engine, Quick Chips, Category Tabs */}
      <div className="space-y-3 sticky top-0 z-20 bg-dark-950/90 backdrop-blur-md pt-2 pb-2">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Enhanced Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" size={17} />
            <input
              type="text"
              placeholder={t('searchMCPEDLPlaceholder', 'Search MCPEDL for furniture, backpacks, guns, zombies, pokémon, shaders...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  loadCatalog(1, false, searchQuery);
                }
              }}
              className="w-full pl-10 pr-20 py-2.5 bg-dark-850 border border-dark-750 focus:border-emerald-500/70 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    loadCatalog(1, false, '');
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-dark-750 transition-colors"
                  title={t('clear', 'Clear')}
                >
                  <X size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => loadCatalog(1, false, searchQuery)}
                disabled={loading}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[11px] border border-emerald-500/30 transition-all cursor-pointer"
              >
                {t('search', 'Search')}
              </button>
            </div>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
              <TrendingUp size={13} className="text-emerald-400" />
              <span>{t('sortBy', 'Sort by:')}</span>
            </span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="bg-dark-850 border border-dark-750 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none cursor-pointer focus:border-emerald-500/50"
            >
              <option value="latest">{t('sortLatest', 'Latest Uploads')}</option>
              <option value="popular">{t('sortPopularAllTime', 'Most Popular (All Time)')}</option>
              <option value="popular-week">{t('sortPopularWeek', 'Trending (This Week)')}</option>
              <option value="popular-month">{t('sortPopularMonth', 'Top Rated (This Month)')}</option>
            </select>
          </div>
        </div>

        {/* Quick Search Tag Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0 pl-1">
            <Sparkles size={12} className="text-emerald-400" />
            <span>Popular:</span>
          </span>
          {quickSearchTags.map((tag) => {
            const isActive = searchQuery.toLowerCase() === tag.query;
            return (
              <button
                key={tag.query}
                type="button"
                onClick={() => {
                  if (isActive) {
                    setSearchQuery('');
                  } else {
                    setSearchQuery(tag.query);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'bg-dark-850 hover:bg-dark-800 text-slate-400 hover:text-slate-200 border border-dark-750'
                }`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>

        {/* Category Pills & Results Indicator */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categoryChips.map((cat) => {
              const Icon = cat.icon;
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'bg-dark-850 hover:bg-dark-800 text-slate-400 hover:text-slate-200 border border-dark-750'
                  }`}
                >
                  <Icon size={14} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {activeSearchTerm && (
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
              <Search size={12} />
              <span>
                {totalCount > 0 ? totalCount : items.length} {((totalCount > 0 ? totalCount : items.length) === 1) ? 'result' : 'results'} for &ldquo;{activeSearchTerm}&rdquo;
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Catalog Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <RefreshCw size={32} className="animate-spin text-emerald-400" />
          <p className="text-xs text-slate-400 font-medium">
            {t('loadingMCPEDL', 'Fetching live packages from MCPEDL community...')}
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-dark-850 border border-dark-750 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center text-slate-500 mx-auto">
            <Compass size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-300">
            {t('noPacksFound', 'No packages matched your query')}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t('noPacksFoundDesc', 'Try clearing your search keyword or switching categories to explore more Bedrock addons.')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 stagger-settle">
          {items.map((item, idx) => {
            const isBusy = installingId === item.id || installingId === item.slug;
            return (
              <div
                key={(item.slug || item.id) + '-' + idx}
                className="bg-dark-850 rounded-2xl border border-dark-750/80 hover:border-emerald-500/40 p-4 flex flex-col justify-between transition-all group shadow-md hover:shadow-xl hover:shadow-emerald-500/5 relative overflow-hidden animate-spring-pop"
                style={{ animationDelay: `${idx * 25}ms` }}
              >
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-emerald-500/5 blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />

                <div className="space-y-3">
                  {/* Thumbnail */}
                  <div className="w-full h-36 rounded-xl bg-dark-900 border border-dark-750 overflow-hidden relative group/img">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 bg-gradient-to-br from-dark-850 to-dark-900">
                        <Package size={36} />
                      </div>
                    )}

                    {/* Overlay Badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-dark-950/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30">
                        {item.category || 'Add-On'}
                      </span>
                    </div>

                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      {/* Rating */}
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-dark-950/80 backdrop-blur-md text-amber-400 border border-amber-500/30">
                        <Star size={10} className="fill-amber-400" />
                        <span>{item.rating || '4.5'}</span>
                      </span>
                    </div>

                    <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-dark-950/80 backdrop-blur-md text-slate-300 border border-dark-700">
                      <Download size={10} />
                      <span>{item.downloadCount || '10k'}</span>
                    </div>
                  </div>

                  {/* Title & Author */}
                  <div>
                    <h3 className="font-extrabold text-sm text-white group-hover:text-emerald-400 transition-colors line-clamp-1" title={item.name}>
                      {item.name}
                    </h3>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                      <span>{t('byAuthor', 'by')} <strong className="text-slate-300">{item.author}</strong></span>
                      <span className="text-[10px] text-slate-500">{item.updatedDate}</span>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {item.summary}
                  </p>
                </div>

                {/* Card Footer Actions: Unified Install Button with Download Loading Bar */}
                <div className="pt-3 mt-3 border-t border-dark-750 flex items-center gap-2">
                  <div className="flex-1">
                    <InstallButton
                      isInstalling={isBusy}
                      isInstalled={item.isInstalled}
                      onInstall={() => handleInstall(item)}
                      variant="emerald"
                      className="w-full"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenFilesModal(item)}
                    className="p-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-400 hover:text-slate-200 border border-dark-700 transition-all active:scale-95 cursor-pointer shrink-0"
                    title={t('viewFiles', 'View Available Files')}
                  >
                    <FolderDown size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Load More */}
      {items.length > 0 && !loading && (
        <div className="flex justify-center pt-4 pb-6">
          {hasMore ? (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-300 font-bold text-xs border border-dark-750 transition-all active:scale-95 cursor-pointer disabled:opacity-50 shadow-md"
            >
              {loadingMore ? (
                <RefreshCw size={14} className="animate-spin text-emerald-400" />
              ) : (
                <ChevronDown size={14} />
              )}
              <span>{loadingMore ? t('loading', 'Loading...') : t('loadMorePacks', 'Load More Add-Ons')}</span>
            </button>
          ) : (
            <div className="text-xs font-bold text-slate-500 bg-dark-900 border border-dark-800 px-4 py-2 rounded-xl">
              {t('allAddonsLoaded', 'All available add-ons loaded')}
            </div>
          )}
        </div>
      )}

      {/* Modal: View & Select Specific Files */}
      {selectedItemForFiles && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-dark-850 border border-dark-750 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FolderDown size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white line-clamp-1">
                    {selectedItemForFiles.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {t('availablePackageFiles', 'Available pack files for direct installation')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItemForFiles(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {loadingFiles ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2">
                <RefreshCw size={24} className="animate-spin text-emerald-400" />
                <span className="text-xs text-slate-400 font-medium">
                  {t('fetchingFiles', 'Fetching download links...')}
                </span>
              </div>
            ) : modalFiles.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-dark-900 rounded-xl border border-dark-750">
                {t('noDirectFilesFound', 'No distinct sub-files found. You can 1-click install the primary archive.')}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {modalFiles.map((file, fIdx) => {
                  const isFileBusy = installingFileUrl === file.downloadUrl;
                  return (
                    <div
                      key={file.downloadUrl + '-' + fIdx}
                      className="p-3 rounded-xl bg-dark-900 border border-dark-750 flex items-center justify-between gap-3 hover:border-emerald-500/30 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileCode size={16} className="text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-200 truncate">
                            {file.name}
                          </p>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">
                            {file.type} • {file.sizeFormatted}
                          </span>
                        </div>
                      </div>

                      <div className="w-28 shrink-0">
                        <InstallButton
                          isInstalling={isFileBusy}
                          onInstall={() => handleInstall(selectedItemForFiles, file)}
                          variant="emerald"
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-3 border-t border-dark-750 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedItemForFiles(null)}
                className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
              >
                {t('close', 'Close')}
              </button>

              {modalFiles.length > 1 && (
                <button
                  type="button"
                  onClick={handleInstallAllModalFiles}
                  className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={13} />
                  <span>{t('installAllPacks', 'Install All Files')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPEDLPage;
