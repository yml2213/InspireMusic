import { useState } from 'react';
import { Search, History, Trash2, X } from 'lucide-react';
import type { Song, Platform } from '../types';
import { Select } from './ui/Select';
import { SEARCH_SOURCE_OPTIONS_DESKTOP, SEARCH_SOURCE_OPTIONS_MOBILE } from '../utils/platform';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { SongListPanel } from './ui/SongListPanel';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { PageLayout } from './ui/PageLayout';

interface SearchViewProps {
  keyword: string;
  onKeywordChange: (val: string) => void;
  searchSource: 'aggregate' | Platform;
  onSearchSourceChange: (val: 'aggregate' | Platform) => void;
  onSearch: (keyword?: string) => void;
  results: Song[];
  loading: boolean;
  error?: string | null;
  currentSong: Song | null;
  isPlaying: boolean;
  onPlay: (song: Song) => void;
  onClear: () => void;
  page: number;
  limit: number;
  total?: number;
  onPageChange: (page: number) => void;
  lockedFromPage?: number;
}

// 搜索历史最大数量
const MAX_HISTORY_ITEMS = 50;

// Helper to read search history from localStorage
const getStoredHistory = (): string[] => {
  try {
    const item = localStorage.getItem('search-history');
    return item ? JSON.parse(item) : [];
  } catch {
    return [];
  }
};

// Helper to save search history to localStorage
const saveHistory = (history: string[]): void => {
  try {
    localStorage.setItem('search-history', JSON.stringify(history));
  } catch {
    // Ignore write errors
  }
};

export const SearchView: React.FC<SearchViewProps> = ({
  keyword,
  onKeywordChange,
  searchSource,
  onSearchSourceChange,
  onSearch,
  results,
  loading,
  error,
  currentSong,
  isPlaying,
  onPlay,
  onClear,
  page,
  limit,
  total,
  onPageChange,
  lockedFromPage,
}) => {
  const [history, setHistory] = useState<string[]>(getStoredHistory);
  const updateHistory = (updater: (prev: string[]) => string[]) => {
    setHistory(prev => {
      const newHistory = updater(prev);
      saveHistory(newHistory);
      return newHistory;
    });
  };

  const confirmClearHistory = useConfirmDialog({
    onConfirm: () => updateHistory(() => []),
  });

  const handleSearch = (kw?: string) => {
    const term = kw || keyword;
    if (!term.trim()) return;

    // Update history - 限制最多保存 MAX_HISTORY_ITEMS 条记录
    updateHistory((prev) => {
      const newHistory = [term, ...prev.filter((h) => h !== term)];
      return newHistory.slice(0, MAX_HISTORY_ITEMS);
    });

    onSearch(term);
  };

  const deleteHistoryItem = (e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    updateHistory((prev) => prev.filter((h) => h !== item));
  };

  const handleClearHistory = () => confirmClearHistory.show();

  const showResultsPanel = keyword.trim() && (loading || total !== undefined || results.length > 0);

  return (
    <PageLayout className="pt-4 md:pt-8">
      <div className="md:hidden flex items-center gap-3 mb-6 px-2">
        <img src="/logo.svg" alt="Logo" className="w-8 h-8" />
        <span className="text-white font-bold text-lg tracking-tight">InspireMusic</span>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 mb-4 md:mb-8">
        <div className="relative flex-1 w-full md:max-w-xl flex items-center bg-white/10 rounded-full border border-transparent focus-within:border-primary transition-all">
          <Search className="absolute left-4 text-gray-400" size={20} />
          <input
            type="text"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索歌曲..."
            className="flex-1 bg-transparent py-3 pl-12 pr-2 text-white placeholder-gray-400 outline-none min-w-0"
          />
          {keyword && (
            <button
              onClick={onClear}
              className="text-gray-400 hover:text-white transition-colors p-2 md:mr-2"
            >
              <X size={16} />
            </button>
          )}
          <div className="md:hidden h-6 w-[1px] bg-white/20 mx-2"></div>
          <div className="md:hidden">
            <Select
              value={searchSource}
              onChange={(val) => onSearchSourceChange(val as 'aggregate' | Platform)}
              options={SEARCH_SOURCE_OPTIONS_MOBILE}
              className="w-25 !bg-transparent !border-none !p-0"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading}
            className="md:hidden p-3 text-primary font-bold disabled:opacity-50"
          >
            搜索
          </button>
        </div>

        <div className="hidden md:block">
          <Select
            value={searchSource}
            onChange={(val) => onSearchSourceChange(val as 'aggregate' | Platform)}
            options={SEARCH_SOURCE_OPTIONS_DESKTOP}
            className="w-40"
          />
        </div>
        <button
          onClick={() => handleSearch()}
          disabled={loading}
          className="hidden md:block bg-primary text-black font-bold rounded-full px-8 py-3 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '搜索中...' : '搜索'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {showResultsPanel ? (
        <SongListPanel
          songs={results}
          currentSong={currentSong}
          isPlaying={isPlaying}
          onPlay={onPlay}
          indexOffset={(page - 1) * limit}
          footer={(
            <div className="flex items-center justify-center gap-2">
              {(() => {
                const pages = Array.from({ length: 5 }, (_, i) => i + 1);

                return pages.map((p) => {
                  const isLocked = lockedFromPage !== undefined && p >= lockedFromPage;
                  const disabled = loading || isLocked;
                  const active = p === page;

                  return (
                    <button
                      key={p}
                      onClick={() => onPageChange(p)}
                      disabled={disabled}
                      className={[
                        "min-w-10 px-3 py-2 rounded-md text-sm font-bold transition-all border",
                        active ? "bg-primary text-black border-primary" : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10",
                        disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-95",
                      ].join(' ')}
                    >
                      {p}
                    </button>
                  );
                });
              })()}
            </div>
          )}
        />
      ) : (
        <>
          {history.length > 0 && !keyword.trim() ? (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <History size={18} className="text-primary" />
                  搜索历史
                </h3>
                <button
                  onClick={handleClearHistory}
                  className="transition-colors p-2 text-gray-400 hover:text-red-500"
                  title="清空历史"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {history.map((item, index) => (
                  <div
                    key={index}
                    className="group bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-4 py-2 rounded-full cursor-pointer transition-all flex items-center gap-2"
                    onClick={() => handleSearch(item)}
                  >
                    <span>{item}</span>
                    <button
                      onClick={(e) => deleteHistoryItem(e, item)}
                      className="text-gray-500 hover:text-red-500 p-0.5 hover:bg-white/20 rounded-full transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 mt-20">
              <Search size={48} className="mx-auto mb-4 opacity-20" />
              <p>输入关键词开始搜索</p>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmClearHistory.open}
        title="清空搜索历史？"
        message="将移除本地保存的搜索记录。"
        danger
        confirmLabel="清空"
        onConfirm={confirmClearHistory.handleConfirm}
        onCancel={confirmClearHistory.handleCancel}
      />

      {/* Version & Copyright Info */}
      <div className="mt-15 mb-8 text-center">
        <p className="text-xs text-white/40">Version v1.3.3 © 2025 WHSTU</p>
        <div className="mt-2 text-white/40 text-xs space-y-1.5 font-medium">
          <p>
            Powered by <a
              href="https://api.tunefree.fun/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors underline decoration-white/20 underline-offset-2"
            >
              TuneHub API
            </a>
          </p>
        </div>
      </div>
    </PageLayout>
  );
};
