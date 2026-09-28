/**
 * @file ToolCoinPage.tsx
 * @description Bedrock Marketplace catalog viewer and addon installer.
 *
 * Core Functionality:
 * - Queries backend marketplace catalog with full-text search and category filtering.
 * - Extracts authentic semantic versions (e.g. `v1.2.2`) via `formatItemVersion`.
 * - Handles asynchronous downloading with animated progress bars (0-100%).
 * - Direct installation to active Bedrock server worlds.
 */

import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Download, 
  CheckCircle2, 
  Package, 
  Globe, 
  Sparkles, 
  FolderOpen, 
  RefreshCw, 
  HardDrive, 
  Check, 
  AlertCircle,
  Tag,
  ArrowRight,
  ChevronDown,
  Layers,
  Palette,
  Gamepad2,
  ExternalLink,
  X
} from 'lucide-react';
import { Api } from '../services/api';
import { Server, ToolCoinCatalogItem, XboxAccount } from '../types';
import { useI18n } from '../i18n';
import { XboxLoginModal } from '../components/XboxLoginModal';

interface ToolCoinPageProps {
  server: Server | null;
  onNavigatePage?: (page: string, payload?: any) => void;
}

export const ToolCoinPage: React.FC<ToolCoinPageProps> = ({ server, onNavigatePage }) => {
  const { t } = useI18n();
  const [items, setItems] = useState<ToolCoinCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [xboxAccount, setXboxAccount] = useState<XboxAccount | null>(null);
  const [isXboxModalOpen, setIsXboxModalOpen] = useState(false);

  const formatItemVersion = (item: ToolCoinCatalogItem): string => {
    if (item.version && item.version !== '1.0') {
      return item.version;
    }
    const match = item.name.match(/\b[vV]?(\d+\.\d+(?:\.\d+)?)\b/);
    if (match) {
      return match[0].startsWith('v') || match[0].startsWith('V') ? match[0] : `v${match[0]}`;
    }
    return item.version || 'v1.0.0';
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [isSyncingDefinitions, setIsSyncingDefinitions] = useState(false);

  const handleSyncDefinitions = async () => {
    setIsSyncingDefinitions(true);
    try {
      const rep = await Api.refreshMarketplaceDefinitions();
      showToast(`Marketplace Definitions Synced: ${rep.totalKeysCount.toLocaleString()} decryption keys & catalog active!`);
      await loadCatalog(1, false);
    } catch (err: any) {
      showToast('Failed to sync marketplace definitions: ' + (err?.message || err), 'error');
    } finally {
      setIsSyncingDefinitions(false);
    }
  };

  const loadCurrentXbox = async () => {
    try {
      const acc = await Api.getXboxAccount();
      if (acc && acc.isLoggedIn) {
        setXboxAccount(acc);
      }
    } catch {
      // ignore
    }
  };

  const loadCatalog = async (pageNumber = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await Api.getToolCoinCatalogLive(searchQuery, category, pageNumber, 24);
      if (append) {
        setItems(prev => {
          const seen = new Set(prev.map(p => `${p.id || ''}::${(p.name || '').toLowerCase()}`));
          const uniqueNew = (res.items || []).filter(p => {
            const key = `${p.id || ''}::${(p.name || '').toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          return [...prev, ...uniqueNew];
        });
      } else {
        const seen = new Set<string>();
        const unique = (res.items || []).filter(p => {
          const key = `${p.id || ''}::${(p.name || '').toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setItems(unique);
      }
      setTotalCount(res.totalCount || 0);
      setPage(pageNumber);
    } catch (e: any) {
      console.error("Failed to load ToolCoin catalog:", e);
      showToast(t('actionFailed', 'Operation failed:') + " " + e.message, 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadCurrentXbox();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCatalog(1, false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, category]);

  const handleInstall = async (item: ToolCoinCatalogItem) => {
    setInstallingId(item.id);
    setDownloadProgress(prev => ({ ...prev, [item.id]: 12 }));

    const timer = setInterval(() => {
      setDownloadProgress(prev => {
        const current = prev[item.id] || 12;
        if (current >= 92) return prev;
        const step = Math.floor(Math.random() * 12) + 6;
        return { ...prev, [item.id]: Math.min(current + step, 92) };
      });
    }, 280);

    try {
      if (server) {
        await Api.installToolCoinCatalogItem(server.id, item.id);
        setDownloadProgress(prev => ({ ...prev, [item.id]: 100 }));
        showToast(`${t('installedSuccessfully', 'Downloaded & installed successfully:')} ${item.name}`);
        setItems(prev => prev.map(p => p.id === item.id ? { ...p, isInstalled: true } : p));
      } else {
        await Api.downloadMarketplaceItem(item.id);
        setDownloadProgress(prev => ({ ...prev, [item.id]: 100 }));
        showToast(`${t('downloadedSuccessfully', 'Downloaded successfully:')} ${item.name}`);
        setItems(prev => prev.map(p => p.id === item.id ? { ...p, isInstalled: true } : p));
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      showToast(`${t('installFailed', 'Failed to download/install:')} ${msg}`, 'error');
    } finally {
      clearInterval(timer);
      setTimeout(() => {
        setInstallingId(null);
        setDownloadProgress(prev => {
          const cp = { ...prev };
          delete cp[item.id];
          return cp;
        });
      }, 600);
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
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md shrink-0">
            <ShoppingBag size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-slate-100 uppercase tracking-tight">
                {t('toolCoinTabTitle', 'Bedrock Marketplace')}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {t('officialCatalog', 'Official Catalog')}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                {searchQuery ? t('verifiedMarketplaceSearch', '🔍 Verified Marketplace Search') : t('bedrockDlcsCount', '⚡ 10,000+ Bedrock DLCs')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('toolCoinTabSubtitle', 'Search and 1-click install Minecraft Bedrock marketplace add-ons directly into your server.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Xbox Live Connection Pill */}
          {xboxAccount?.isLoggedIn ? (
            <button
              type="button"
              onClick={() => setIsXboxModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
              title="Xbox Live account connected"
            >
              {xboxAccount.avatarUrl ? (
                <img src={xboxAccount.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-emerald-500/40" />
              ) : (
                <Gamepad2 size={15} className="text-emerald-400" />
              )}
              <span className="truncate max-w-[110px]">{xboxAccount.gamertag}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsXboxModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 hover:text-white border border-dark-750 hover:border-emerald-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
              title="Sign in with your Xbox / Microsoft account"
            >
              <Gamepad2 size={15} className="text-emerald-400" />
              <span>{t('signInWithXbox', 'Sign in with Xbox')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSyncDefinitions}
            disabled={isSyncingDefinitions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold border border-amber-500/30 transition-all active:scale-95 cursor-pointer shadow-sm disabled:opacity-50"
            title="Check for updates and sync decryption keys and catalog live from upstream"
          >
            <RefreshCw size={13} className={isSyncingDefinitions ? "animate-spin" : ""} />
            <span>{isSyncingDefinitions ? t('syncing', 'Syncing...') : t('checkUpdatesSync', 'Check Updates & Sync')}</span>
          </button>

          <button
            type="button"
            onClick={() => Api.openToolCoinDownloadsFolder()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold border border-dark-700 transition-all active:scale-95 cursor-pointer"
            title="Open Packs folder"
          >
            <FolderOpen size={14} className="text-slate-400" />
            <span>{t('downloadsFolder', 'Packs Folder')}</span>
          </button>

          <div className="px-3 py-1.5 rounded-xl bg-dark-850 border border-dark-750 flex items-center gap-2 text-xs">
            <HardDrive size={14} className="text-amber-400" />
            <span className="text-slate-400">{t('activeServer', 'Target:')}</span>
            <span className="font-bold text-white truncate max-w-[130px]">
              {server ? server.name : t('noServerSelected', 'None Selected')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => loadCatalog(1, false)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold border border-dark-700 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            title={t('refresh', 'Refresh')}
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-amber-400" : ""} />
            <span>{t('refresh', 'Refresh')}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-dark-850 rounded-2xl border border-dark-750 p-4 space-y-3 shadow-md animate-slide-down">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('searchToolCoinPacks', 'Search marketplace add-ons, worlds, or authors (e.g. Better on Bedrock, Backpacks)...')}
              className="w-full bg-dark-900 border border-dark-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            {[
              { id: 'all', label: t('all', 'All') },
              { id: 'addon', label: t('addons', 'Add-Ons') },
              { id: 'world', label: t('worlds', 'World Templates') },
              { id: 'texture', label: t('textures', 'Resource Packs') },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setCategory(f.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  category === f.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-dark-900 text-slate-400 hover:text-slate-200 border border-dark-750'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1 border-t border-dark-750/60">
          <div className="flex items-center gap-1.5">
            <span>{t('showingResults', 'Showing')}</span>
            <span className="text-amber-400 font-bold">{items.length}</span>
            {totalCount > 0 && (
              <>
                <span>{t('of', 'of')}</span>
                <span className="text-slate-300 font-bold">{totalCount.toLocaleString()}</span>
              </>
            )}
            <span>{t('marketplaceItems', 'marketplace items')}</span>
          </div>

          <span className="text-[10px] text-slate-500">
            {t('officialCdnMetadata', 'Official PlayFab CDN & Local Metadata')}
          </span>
        </div>
      </div>

      {/* Grid of Catalog Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-settle">
        {items.map((item, idx) => {
          const isTemplate = item.type === 'mctemplate' || item.category === 'world';
          const isTexture = item.category === 'texture';
          const isInstalling = installingId === item.id;

          return (
            <div
              key={`${item.id}-${idx}`}
              className="bg-dark-850 rounded-2xl border border-dark-750 overflow-hidden hover:border-amber-500/40 hover:bg-dark-800/60 transition-all flex flex-col justify-between group shadow-md animate-spring-pop"
              style={{ animationDelay: `${(idx % 12) * 35}ms` }}
            >
              <div>
                {/* Visual Banner Header */}
                <div className="relative w-full h-36 bg-dark-900 overflow-hidden border-b border-dark-750/70">
                  {item.thumbnailUrl ? (
                    <img 
                      src={item.thumbnailUrl} 
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                        const fallback = (e.currentTarget as HTMLElement).parentElement?.querySelector('.toolcoin-fallback-banner') as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}

                  <div className={`w-full h-full items-center justify-center toolcoin-fallback-banner ${
                    item.thumbnailUrl ? 'hidden' : 'flex'
                  } ${
                    isTemplate 
                      ? 'bg-gradient-to-br from-indigo-950 to-indigo-900 text-indigo-400' 
                      : isTexture
                      ? 'bg-gradient-to-br from-amber-950 to-amber-900 text-amber-400'
                      : 'bg-gradient-to-br from-emerald-950 to-emerald-900 text-emerald-400'
                  }`}>
                    {isTemplate ? <Globe size={40} className="opacity-40" /> : isTexture ? <Palette size={40} className="opacity-40" /> : <Package size={40} className="opacity-40" />}
                  </div>

                  {/* Badges on banner */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-md backdrop-blur-md ${
                      isTemplate 
                        ? 'bg-indigo-500/85 text-white border border-indigo-400/40' 
                        : isTexture
                        ? 'bg-amber-500/85 text-slate-950 border border-amber-400/40'
                        : 'bg-emerald-500/85 text-slate-950 border border-emerald-400/40'
                    }`}>
                      {isTemplate ? t('worldTemplate', 'World Template') : isTexture ? t('resourcePackLabel', 'Resource Pack') : t('addon', 'Add-On')}
                    </span>
                    {item.isInstalled && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/90 text-slate-950 shadow-md flex items-center gap-1">
                        <Check size={10} strokeWidth={3} /> {t('downloaded', 'Downloaded')}
                      </span>
                    )}
                  </div>

                  {item.sizeFormatted ? (
                    <span className="absolute bottom-2 right-2 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-slate-200 border border-white/10">
                      {item.sizeFormatted}
                    </span>
                  ) : null}
                </div>

                {/* Content Info */}
                <div className="p-4 space-y-2.5">
                  <div>
                    <h3 className="text-sm font-black text-slate-100 line-clamp-1 group-hover:text-amber-300 transition-colors" title={item.name}>
                      {item.name}
                    </h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="font-semibold text-slate-300 truncate max-w-[130px]">{item.author}</span>
                      <span>•</span>
                      <span className="font-mono text-amber-400/90">{formatItemVersion(item)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {item.tags.slice(0, 3).map((tag, tIdx) => (
                        <span key={tIdx} className="text-[10px] px-2 py-0.5 rounded-md bg-dark-900 border border-dark-750 text-slate-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Install Footer */}
              <div className="p-4 pt-0 flex items-center gap-2">
                {isInstalling ? (
                  <div className="flex-1 h-9 rounded-xl overflow-hidden bg-amber-950/80 border border-amber-500/40 relative flex items-center justify-center shadow-md">
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 transition-all duration-300 ease-out"
                      style={{ width: `${downloadProgress[item.id] || 15}%` }}
                    />
                    <div className="relative z-10 flex items-center justify-center gap-2 text-slate-950 font-black text-xs drop-shadow-sm select-none">
                      <Download size={13} className="animate-bounce text-slate-950" />
                      <span>{t('downloadingProgress', 'Downloading...')} {downloadProgress[item.id] || 15}%</span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleInstall(item)}
                    className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                      item.isInstalled
                        ? isTemplate
                          ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                        : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                    }`}
                  >
                    {item.isInstalled ? (
                      <>
                        <Check size={13} strokeWidth={3} />
                        <span>{isTemplate ? t('installPacksToServer', 'Install Addon to Server') : t('installToServer', 'Install to Server')}</span>
                      </>
                    ) : (
                      <>
                        <Download size={13} />
                        <span>{t('downloadAndInstall', 'Download & Install')}</span>
                      </>
                    )}
                  </button>
                )}

                {item.localPath && (
                  <button
                    type="button"
                    onClick={() => Api.openFolder(item.localPath!)}
                    className="p-2 rounded-xl bg-dark-900 hover:bg-dark-800 text-slate-400 hover:text-slate-200 border border-dark-750 transition-all active:scale-95 cursor-pointer"
                    title={t('revealFile', 'Reveal in Explorer')}
                  >
                    <FolderOpen size={14} />
                  </button>
                )}
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
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {loadingMore ? (
              <RefreshCw size={14} className="animate-spin text-amber-400" />
            ) : (
              <ChevronDown size={14} />
            )}
            <span>{loadingMore ? t('loading', 'Loading...') : t('loadMore', 'Load More Marketplace Items')}</span>
          </button>
        </div>
      )}

      {items.length === 0 && !loading && (
        <div className="bg-dark-850 rounded-2xl border border-dark-750 p-12 text-center space-y-3 animate-spring-pop">
          <ShoppingBag size={32} className="mx-auto text-slate-600" />
          <h3 className="text-sm font-bold text-slate-300">
            {t('noToolCoinResults', 'No Marketplace Packs Found')}
          </h3>
          <p className="text-xs text-slate-500">
            {t('tryDifferentQuery', 'Try clearing your search query or selecting a different category.')}
          </p>
        </div>
      )}

      {/* Xbox Login Modal */}
      <XboxLoginModal
        isOpen={isXboxModalOpen}
        onClose={() => setIsXboxModalOpen(false)}
        activeServerId={server?.id}
        onAccountUpdated={(acc) => setXboxAccount(acc)}
      />
    </div>
  );
};

export default ToolCoinPage;
