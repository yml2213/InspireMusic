import { useState, useRef, useEffect } from 'react';
import { Search, History, Trash2, X } from 'lucide-react';
import type { Song, Platform } from '../types';
import { SongList } from './SongList';
import { Select } from './ui/Select';
import useLocalStorage from '../hooks/useLocalStorage';

interface SearchViewProps {
  keyword: string;
  onKeywordChange: (val: string) => void;
  searchSource: 'aggregate' | Platform;
  onSearchSourceChange: (val: 'aggregate' | Platform) => void;
  onSearch: (keyword?: string) => void; // Updated signature
  results: Song[];
  loading: boolean;
  error?: string | null;
  currentSong: Song | null;
  isPlaying: boolean;
  onPlay: (song: Song) => void;
  onClear: () => void;
}

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
}) => {
  const [history, setHistory] = useLocalStorage<string[]>('search-history', []);
  const [confirmClear, setConfirmClear] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const handleSearch = (kw?: string) => {
    const term = kw || keyword;
    if (!term.trim()) return;

    // Update history
    setHistory((prev) => {
      const newHistory = [term, ...prev.filter((h) => h !== term)];
      return newHistory.slice(0, 20); // Keep max 20 items
    });

    onSearch(term);
  };

  const deleteHistoryItem = (e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    setHistory((prev) => prev.filter((h) => h !== item));
  };

  const handleClearHistory = () => {
    if (confirmClear) {
      setHistory([]);
      setConfirmClear(false);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    } else {
      setConfirmClear(true);
      clearTimerRef.current = setTimeout(() => {
        setConfirmClear(false);
      }, 3000);
    }
  };

  return (
    <div className="p-4 md:p-8">
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
              onChange={(val) => onSearchSourceChange(val as any)}
              options={[
                { value: 'aggregate', label: '聚合' },
                { value: 'netease', label: '网易云' },
                { value: 'kuwo', label: '酷我' },
                { value: 'qq', label: 'QQ' },
              ]}
              className="w-20 !bg-transparent !border-none !p-0"
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
            onChange={(val) => onSearchSourceChange(val as any)}
            options={[
              { value: 'aggregate', label: '聚合搜索' },
              { value: 'netease', label: '网易云音乐' },
              { value: 'kuwo', label: '酷我音乐' },
              { value: 'qq', label: 'QQ音乐' },
            ]}
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

      {results.length > 0 ? (
        <div className="bg-black/20 rounded-xl overflow-hidden">
          <SongList
            songs={results}
            currentSong={currentSong}
            isPlaying={isPlaying}
            onPlay={onPlay}
          />
        </div>
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
                  className={`transition-colors p-2 ${confirmClear ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                  title={confirmClear ? "确认清空" : "清空历史"}
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

      {/* Version & Copyright Info */}
      <div className="mt-80 mb-8 text-center">
        <p className="text-xs text-white/40">© InspireMusic v25.12.13.1  All rights reserved.</p>
        <div className="mt-5 text-white/40 text-xs space-y-1.5 font-medium">
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
    </div>
  );
};
