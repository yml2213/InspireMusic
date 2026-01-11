import { useEffect, useRef, useState } from 'react';
import {
  aggregateSearch,
  buildFileUrl,
  getLyrics,
  getPlaylist,
  getToplistSongs,
  getToplists,
  searchSongs,
} from './api';
import { useAppStore } from './store/useAppStore';
import { useAuthStore } from './store/authStore';
import { AuthModal } from './components/AuthModal';
import { SyncIndicator } from './components/SyncIndicator';
import { useMediaSession } from './hooks/useMediaSession';
import { useTrayTitle } from './hooks/useTrayTitle';
import type {
  Platform,
  Quality,
  Song,
  SongInfo,
  ToplistSummary,
  LocalPlaylist,
  ParsedLyricLine,
} from './types';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { PlayerBar } from './components/PlayerBar';
import { LyricsView } from './components/LyricsView';
import { SearchView } from './components/SearchView';
import { ToplistsView } from './components/ToplistsView';
import { PlaylistDetailView } from './components/PlaylistDetailView';
import { QueueView } from './components/QueueView';
import { LibraryView } from './components/LibraryView';
import { Modal } from './components/ui/Modal';
import { ToastContainer } from './components/ui/Toast';
import type { ToastMessage } from './components/ui/Toast';
import { Select } from './components/ui/Select';
import { ListMusic, Heart, Check } from 'lucide-react';

import { getGradientFromId } from './utils/colors';
import { parseLyrics } from './utils/lyrics';
import { motion, AnimatePresence } from 'framer-motion';
import { FAVORITES_ID, FAVORITES_NAME, buildFavoritesPlaylist, toLocalPlaylist } from './utils/playlists';
import { PLATFORM_OPTIONS_LONG } from './utils/platform';

const applyQualityToUrl = (rawUrl: string, quality: Quality): string => {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set('br', quality);
    return url.toString();
  } catch {
    return rawUrl;
  }
};

function App() {
  // UI State
  const [activeTab, setActiveTab] = useState<'search' | 'toplists' | 'library' | 'playlist'>('search');
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [requestCloseLyrics, setRequestCloseLyrics] = useState(false); // 用于触发退出动画
  const [requestCloseQueue, setRequestCloseQueue] = useState(false); // 用于触发退出动画
  const [viewingPlaylist, setViewingPlaylist] = useState<LocalPlaylist | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlistToDelete, setPlaylistToDelete] = useState<string | null>(null);
  const [isRenamePlaylistModalOpen, setIsRenamePlaylistModalOpen] = useState(false);
  const [playlistToRename, setPlaylistToRename] = useState<LocalPlaylist | null>(null);
  const [renamePlaylistName, setRenamePlaylistName] = useState('');
  const [isAddToPlaylistModalOpen, setIsAddToPlaylistModalOpen] = useState(false);
  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<Song | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, token } = useAuthStore();
  const lastRecordedSongIdRef = useRef<string | null>(null);

  const addToast = (type: ToastMessage['type'], message: string) => {
    const id = Date.now().toString();
    setToasts(prev => {
      const newToasts = [...prev, { id, type, message }];
      if (newToasts.length > 3) {
        return newToasts.slice(newToasts.length - 3);
      }
      return newToasts;
    });
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  const [keyword, setKeyword] = useState('');
  const [searchSource, setSearchSource] = useState<'aggregate' | Platform>('aggregate');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState<number | undefined>(undefined);
  const [searchLockedFromPage, setSearchLockedFromPage] = useState<number | undefined>(undefined);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = async ({ page, term, resetLocked }: { page: number; term: string; resetLocked?: boolean }) => {
    const normalized = term.trim();
    if (!normalized) return;

    const requestLimit = searchSource === 'aggregate' ? 10 : 30;

    if (resetLocked) {
      setSearchLockedFromPage(undefined);
      setSearchTotal(undefined);
      setSearchPage(1);
    }

    setSearching(true);
    setError(null);

    try {
      const data = searchSource === 'aggregate'
        ? await aggregateSearch(normalized, requestLimit, page)
        : await searchSongs(searchSource, normalized, requestLimit, page);

      if (!data.results.length) {
        setSearchLockedFromPage((prev) => {
          const lockPage = page === 1 ? 2 : page;
          return prev !== undefined ? Math.min(prev, lockPage) : lockPage;
        });
        if (resetLocked) {
          setSearchResults([]);
          setSearchTotal(data.total ?? 0);
        }
        return;
      }

      setSearchResults(data.results);
      setSearchTotal(data.total ?? data.results.length);
      setSearchPage(page);

      const currentCount = data.total ?? data.results.length;
      if (searchSource !== 'aggregate' && currentCount < requestLimit) {
        setSearchLockedFromPage((prev) => {
          const lockPage = page + 1;
          return prev !== undefined ? Math.min(prev, lockPage) : lockPage;
        });
      }
    } catch {
      setError('搜索失败');
      if (!resetLocked && page > searchPage) {
        setSearchLockedFromPage((prev) => {
          const lockPage = page;
          return prev !== undefined ? Math.min(prev, lockPage) : lockPage;
        });
      }
    } finally {
      setSearching(false);
    }
  };

  // Player State - 从 Zustand store 获取持久化状态
  const {
    currentSong,
    setCurrentSong,
    queue,
    setQueue,
    queueIndex,
    setQueueIndex,
    volume,
    setVolume,
    playMode,
    setPlayMode,
    quality,
    setQuality,
    favorites,
    playlists,
    savedProgress,
    saveProgress: setSavedProgress,
    addPlaylist,
    updatePlaylist,
    deletePlaylist: storeDeletePlaylist,
    toggleSongInPlaylist: storeToggleSongInPlaylist,
  } = useAppStore();

  const [currentInfo, setCurrentInfo] = useState<SongInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState('');
  const [parsedLyrics, setParsedLyrics] = useState<ParsedLyricLine[]>([]);
  const [activeLyricIndex, setActiveLyricIndex] = useState<number>(-1);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);



  // Sleep Timer State
  const [sleepEndTime, setSleepEndTime] = useState<number | null>(null);

  // Playlist Import State
  const [playlistSource, setPlaylistSource] = useState<Platform>('netease');
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);

  // Toplist State
  const [toplistSource, setToplistSource] = useState<Platform>('netease');
  const [toplists, setToplists] = useState<ToplistSummary[]>([]);
  const [loadingToplists, setLoadingToplists] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playModeRef = useRef(playMode);
  // Ref to control auto-play behavior. 
  // Initialize to false so that restoring state doesn't auto-play.
  const shouldAutoPlayRef = useRef(false);
  const queueRef = useRef<Song[]>([]);
  const queueIndexRef = useRef(-1);



  // Keep the playlist detail view in sync with underlying data changes.
  useEffect(() => {
    if (!viewingPlaylist) return;

    if (viewingPlaylist.id === FAVORITES_ID) {
      setViewingPlaylist((prev) => (prev ? { ...prev, name: FAVORITES_NAME, songs: favorites } : prev));
      return;
    }

    const pl = playlists.find(p => p.id === viewingPlaylist.id);
    if (pl) {
      setViewingPlaylist(pl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: only sync when viewingPlaylist.id changes, not the full object
  }, [favorites, playlists, viewingPlaylist?.id]);

  // --- Audio & Player Logic ---

  // Use requestAnimationFrame for smoother lyric sync
  const animationFrameRef = useRef<number | null>(null);
  const lastProgressRef = useRef(0);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.volume = volume;

    const syncProgress = () => {
      const currentTime = audio.currentTime || 0;
      if (Math.abs(currentTime - lastProgressRef.current) > 0.05) {
        lastProgressRef.current = currentTime;
        setProgress(currentTime);
      }
    };

    // High-frequency progress update for accurate lyric sync
    const updateProgress = () => {
      if (audio && !audio.paused) {
        // Only update state if progress changed significantly (avoid unnecessary re-renders)
        syncProgress();
      }
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    };

    const handleDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handleEnded = () => {
      if (playModeRef.current === 'single') {
        audio.currentTime = 0;
        audio.play();
      } else {
        // Auto-advance for list and shuffle modes
        nextSong();
      }
    };
    const handlePlay = () => {
      setIsPlaying(true);
      // Start animation frame loop when playing
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    };
    const handlePause = () => {
      setIsPlaying(false);
      // Stop animation frame loop when paused
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
    const handleError = () => {
      setIsPlaying(false);
    };
    const handleSeeked = () => {
      // Update progress immediately on seek
      setProgress(audio.currentTime || 0);
      lastProgressRef.current = audio.currentTime || 0;
    };
    const handleTimeUpdate = () => {
      // Fallback for background playback where rAF may be throttled
      syncProgress();
    };

    audio.addEventListener('loadedmetadata', handleDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('seeked', handleSeeked);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      audio.removeEventListener('loadedmetadata', handleDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('seeked', handleSeeked);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: audio element setup should only run once on mount
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    playModeRef.current = playMode;
    if (audioRef.current) audioRef.current.loop = false;
  }, [playMode]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);

  // Ref for resume progress handling
  const hasRestoredProgressRef = useRef(false);
  const currentSongIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentSong || !audioRef.current) return;
    const audio = audioRef.current;
    const src = currentSong.url
      ? applyQualityToUrl(currentSong.url, quality)
      : buildFileUrl(currentSong.platform, currentSong.id, 'url', quality);

    // Detect if this is a different song
    const songId = `${currentSong.platform}-${currentSong.id}`;
    const isSameSong = currentSongIdRef.current === songId;
    currentSongIdRef.current = songId;

    // Reset timeline when switching tracks so media notifications don't keep old progress
    if (!isSameSong) {
      setProgress(0);
      setDuration(0);
      lastProgressRef.current = 0;
    }

    audio.src = src;

    // Restore progress when same song loads (page refresh scenario)
    const handleCanPlay = () => {
      if (!hasRestoredProgressRef.current && savedProgress > 0 && isSameSong) {
        audio.currentTime = savedProgress;
        setProgress(savedProgress);
        hasRestoredProgressRef.current = true;
      }
    };

    audio.addEventListener('canplay', handleCanPlay, { once: true });

    if (shouldAutoPlayRef.current) {
      audio.play().catch(() => setIsPlaying(false));
    }

    loadSongDetails(currentSong);

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: savedProgress only needed on initial load
  }, [currentSong, quality]);

  // --- Sleep Timer Logic ---
  useEffect(() => {
    if (!sleepEndTime) return;

    const checkTimer = () => {
      if (Date.now() >= sleepEndTime) {
        setIsPlaying(false);
        if (audioRef.current) audioRef.current.pause();
        setSleepEndTime(null);
        addToast('info', '定时关闭已生效');
      }
    };

    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [sleepEndTime]);

  // --- Progress Save Logic (save every 5 seconds while playing) ---
  useEffect(() => {
    if (!isPlaying || !currentSong) return;

    const saveInterval = setInterval(() => {
      if (audioRef.current && audioRef.current.currentTime > 0) {
        setSavedProgress(Math.floor(audioRef.current.currentTime));
      }
    }, 5000);

    // Save immediately on pause
    return () => {
      if (audioRef.current && audioRef.current.currentTime > 0) {
        setSavedProgress(Math.floor(audioRef.current.currentTime));
      }
      clearInterval(saveInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: setSavedProgress is stable from useLocalStorage
  }, [isPlaying, currentSong]);

  // --- History Recording Logic ---
  useEffect(() => {
    if (isPlaying && currentSong && user && token) {
      const songId = `${currentSong.platform}-${currentSong.id}`;
      // Prevent duplicate recording for the same song session unless it changed
      if (lastRecordedSongIdRef.current !== songId) {
        lastRecordedSongIdRef.current = songId;

        // Record history
        fetch('/api/user/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(currentSong)
        }).catch(console.error);
      }
    }
  }, [isPlaying, currentSong, user, token]);

  // --- Lyrics Logic ---

  // Use a ref to store parsed lyrics for immediate access
  const parsedLyricsRef = useRef<ParsedLyricLine[]>([]);

  useEffect(() => {
    if (!lyrics) {
      parsedLyricsRef.current = [];
      setParsedLyrics([]);
      setActiveLyricIndex(-1);
      return;
    }
    const parsed = parseLyrics(lyrics);
    parsedLyricsRef.current = parsed;
    setParsedLyrics(parsed);

    // Find the correct initial index based on current progress
    let initialIdx = 0;
    for (let i = 0; i < parsed.length; i++) {
      if (progress >= parsed[i].time) {
        initialIdx = i;
      } else {
        break;
      }
    }
    setActiveLyricIndex(parsed.length ? initialIdx : -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: progress only checked on initial parse, not on every progress update
  }, [lyrics]);

  useEffect(() => {
    if (!parsedLyrics.length) return;

    // Find the current lyric line based on playback progress
    // Find the last line whose time is <= current progress
    let currentIdx = 0;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (progress >= parsedLyrics[i].time) {
        currentIdx = i;
      } else {
        break;
      }
    }

    // Update immediately when index changes
    if (currentIdx !== activeLyricIndex) {
      setActiveLyricIndex(currentIdx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: activeLyricIndex is the value being set, not a dependency
  }, [progress, parsedLyrics]);

  const loadSongDetails = async (song: Song) => {
    setLyrics('');
    setInfoError(null);
    setLyricsLoading(true);

    const info: SongInfo = {
      name: song.name,
      artist: song.artist || '',
      album: song.album || '',
      url: song.url || buildFileUrl(song.platform, song.id, 'url'),
      pic: song.pic || buildFileUrl(song.platform, song.id, 'pic'),
      lrc: song.lrc || buildFileUrl(song.platform, song.id, 'lrc'),
    };
    setCurrentInfo(info);

    try {
      const lyricText = await getLyrics(song.platform, song.id, info.lrc);
      setLyrics(lyricText);
    } catch {
      setInfoError('无法加载详情');
    } finally {
      setLyricsLoading(false);
    }
  };

  // --- Playback Controls ---

  const startPlayback = (songs: Song[], index = 0) => {
    if (!songs.length) return;
    const boundedIndex = Math.max(0, Math.min(index, songs.length - 1));
    setQueue(songs);
    setQueueIndex(boundedIndex);
    shouldAutoPlayRef.current = true;
    setCurrentSong(songs[boundedIndex]);
  };

  const playSong = (song: Song) => {
    const idx = queue.findIndex(s => s.id === song.id && s.platform === song.platform);
    if (idx >= 0) {
      setQueueIndex(idx);
      shouldAutoPlayRef.current = true;
      setCurrentSong(queue[idx]);
    } else {
      const newQueue = [...queue, song];
      setQueue(newQueue);
      setQueueIndex(newQueue.length - 1);
      shouldAutoPlayRef.current = true;
      setCurrentSong(song);
    }
  };

  const nextSong = () => {
    if (!queueRef.current.length) return;
    let nextIdx = queueIndexRef.current;
    const currentQueue = queueRef.current;

    if (playModeRef.current === 'shuffle') {
      // Simple shuffle: pick random index different from current
      let randomIdx = Math.floor(Math.random() * currentQueue.length);
      while (currentQueue.length > 1 && randomIdx === nextIdx) {
        randomIdx = Math.floor(Math.random() * currentQueue.length);
      }
      nextIdx = randomIdx;
    } else {
      // List loop
      nextIdx = (nextIdx + 1) % currentQueue.length;
    }

    // We need to update state based on the calculated index
    // Since this might be called from an event listener closure, we use the ref values for calculation
    // but we must update the React state to trigger re-renders and effects
    // but we must update the React state to trigger re-renders and effects
    setQueueIndex(nextIdx);
    shouldAutoPlayRef.current = true;
    setCurrentSong(currentQueue[nextIdx]);
  };

  const prevSong = () => {
    if (!queue.length) return;
    let prevIdx = queueIndex;
    if (playMode === 'shuffle') {
      prevIdx = Math.floor(Math.random() * queue.length);
    } else {
      prevIdx = (queueIndex - 1 + queue.length) % queue.length;
    }
    setQueueIndex(prevIdx);
    shouldAutoPlayRef.current = true;
    setCurrentSong(queue[prevIdx]);
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else {
        shouldAutoPlayRef.current = true;
        audioRef.current.play();
      }
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  // --- Playlist Management ---

  const createPlaylist = () => {
    setNewPlaylistName('');
    setIsCreatePlaylistModalOpen(true);
  };

  const handleCreatePlaylistConfirm = () => {
    if (newPlaylistName.trim()) {
      const newList: LocalPlaylist = { id: `pl-${Date.now()}`, name: newPlaylistName.trim(), songs: [] };
      addPlaylist(newList);
      addToast('success', '歌单创建成功');
      setIsCreatePlaylistModalOpen(false);
    }
  };

  const handleRenamePlaylist = () => {
    if (playlistToRename && renamePlaylistName.trim()) {
      updatePlaylist(playlistToRename.id, { name: renamePlaylistName.trim() });
      if (viewingPlaylist?.id === playlistToRename.id) {
        setViewingPlaylist(prev => prev ? { ...prev, name: renamePlaylistName.trim() } : null);
      }
      addToast('success', '歌单重命名成功');
      setIsRenamePlaylistModalOpen(false);
      setPlaylistToRename(null);
    }
  };

  const toggleSongInPlaylist = (playlistId: string, song: Song) => {
    storeToggleSongInPlaylist(playlistId, song);
  };

  const deletePlaylist = (id: string) => {
    setPlaylistToDelete(id);
  };

  const handleDeletePlaylistConfirm = () => {
    if (playlistToDelete) {
      storeDeletePlaylist(playlistToDelete);
      if (viewingPlaylist?.id === playlistToDelete) setActiveTab('library');
      addToast('success', '歌单已删除');
      setPlaylistToDelete(null);
    }
  };

  const importPlaylist = async (id: string) => {
    if (!id.trim()) return;
    setLoadingPlaylist(true);
    try {
      const data = await getPlaylist(playlistSource, id.trim());
      const imported = toLocalPlaylist(data, {
        id: `import-${playlistSource}-${Date.now()}`,
        name: data.info?.name || '导入歌单',
        source: playlistSource,
        origin: data.info?.author,
        pic: data.info?.pic,
        desc: data.info?.desc,
      });
      addPlaylist(imported);
      addToast('success', `成功导入歌单：${imported.name}`);
    } catch {
      addToast('error', '导入失败，请检查ID或链接');
    } finally {
      setLoadingPlaylist(false);
    }
  };

  // --- Toplist Logic ---

  useEffect(() => {
    if (activeTab === 'toplists') {
      fetchToplists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: fetchToplists is defined outside and stable
  }, [activeTab, toplistSource]);

  const fetchToplists = async () => {
    setLoadingToplists(true);
    try {
      const list = await getToplists(toplistSource);
      setToplists(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingToplists(false);
    }
  };

  // Media Session API integration for browser/OS media notifications
  useMediaSession({
    title: currentSong?.name || '',
    artist: currentSong?.artist || '',
    album: currentSong?.album,
    artwork: currentInfo?.pic,
    duration,
    position: progress,
    isPlaying,
    onPlay: togglePlayPause,
    onPause: togglePlayPause,
    onNextTrack: nextSong,
    onPrevTrack: prevSong,
    onSeek: handleSeek,
  });

  // Update system tray title with current song (Tauri only)
  useTrayTitle(currentSong?.name, currentSong?.artist);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSeek(Math.max(0, progress - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSeek(Math.min(duration, progress + 5));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.1));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: setVolume and togglePlayPause are stable
  }, [progress, duration, volume, isPlaying]);

  return (
    <Layout
      sidebar={
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          playlists={[
            buildFavoritesPlaylist(favorites),
            ...playlists,
          ]}
          activePlaylistId={viewingPlaylist?.id || ''}
          onPlaylistSelect={(id) => {
            if (id === FAVORITES_ID) {
              setViewingPlaylist(buildFavoritesPlaylist(favorites));
              setActiveTab('playlist');
              return;
            }
            const pl = playlists.find(p => p.id === id);
            if (pl) {
              setViewingPlaylist(pl);
              setActiveTab('playlist');
            }
          }}
          onCreatePlaylist={createPlaylist}
          onDeletePlaylist={deletePlaylist}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          user={user}
        />
      }
      bottomNav={
        <BottomNav
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            // 移动端切换页面时自动收起歌词和播放队列（带动画）
            if (showQueue) {
              setRequestCloseQueue(true);
            }
            if (showLyrics) {
              setRequestCloseLyrics(true);
            }
          }}
        />
      }
      player={
        <PlayerBar
          currentSong={currentSong}
          coverUrl={currentInfo?.pic}
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
          volume={volume}
          playMode={playMode}
          isFavorite={!!currentSong && favorites.some(f => f.id === currentSong.id && f.platform === currentSong.platform)}
          onPlayPause={togglePlayPause}
          onNext={nextSong}
          onPrev={prevSong}
          onSeek={handleSeek}
          onVolumeChange={setVolume}
          onToggleFavorite={() => {
            if (currentSong) {
              setSongToAddToPlaylist(currentSong);
              setIsAddToPlaylistModalOpen(true);
            }
          }}
          onToggleMode={() => {
            const modes: ('list' | 'shuffle' | 'single')[] = ['list', 'shuffle', 'single'];
            const next = modes[(modes.indexOf(playMode) + 1) % modes.length];
            setPlayMode(next);
          }}
          onTogglePlaylist={() => {
            // 点击播放队列时自动收起歌词（带动画）
            if (showLyrics) {
              setRequestCloseLyrics(true);
            }
            if (showQueue) {
              // 关闭队列
              setRequestCloseQueue(true);
            } else {
              // 打开队列
              setShowQueue(true);
            }
          }}
          onToggleLyrics={() => {
            // 展开歌词时自动收起播放队列（带动画）
            if (showQueue) {
              setRequestCloseQueue(true);
            }
            if (showLyrics) {
              // 关闭歌词
              setRequestCloseLyrics(true);
            } else {
              // 打开歌词
              setShowLyrics(true);
            }
          }}
        />
      }
      lyricsOverlay={
        showLyrics && (
          <LyricsView
            lyrics={parsedLyrics}
            activeLyricIndex={activeLyricIndex}
            currentSong={currentSong}
            coverUrl={currentInfo?.pic}
            loading={lyricsLoading}
            error={infoError}
            requestClose={requestCloseLyrics}
            onClose={() => {
              setShowLyrics(false);
              setRequestCloseLyrics(false);
            }}
            onSeek={handleSeek}
          />
        )
      }
    >
      <AnimatePresence mode="wait">
        {activeTab === 'search' && (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <SearchView
              keyword={keyword}
              onKeywordChange={setKeyword}
              searchSource={searchSource}
              onSearchSourceChange={setSearchSource}
              onSearch={async (kw?: string) => {
                const term = kw ?? keyword;
                if (kw) setKeyword(kw);
                await performSearch({ page: 1, term, resetLocked: true });
              }}
              page={searchPage}
              limit={30}
              total={searchTotal}
              lockedFromPage={searchLockedFromPage}
              onPageChange={async (page) => {
                const term = keyword;
                if (!term.trim()) return;
                if (page === searchPage) return;
                if (searchLockedFromPage !== undefined && page >= searchLockedFromPage) return;
                await performSearch({ page, term });
              }}
              results={searchResults}
              loading={searching}
              error={error}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={playSong}
              onClear={() => {
                setKeyword('');
                setSearchResults([]);
                setError(null);
                setSearching(false);
                setSearchPage(1);
                setSearchTotal(undefined);
                setSearchLockedFromPage(undefined);
              }}
            />
          </motion.div>
        )}

        {activeTab === 'toplists' && (
          <motion.div
            key="toplists"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-white">排行榜</h2>
                <Select
                  value={toplistSource}
                  onChange={(val) => setToplistSource(val as Platform)}
                  options={PLATFORM_OPTIONS_LONG}
                  className="w-32"
                />
              </div>
              <div className="relative min-h-[200px]">
                {loadingToplists && (
                  <div className={`absolute inset-0 flex items-center justify-center z-10 backdrop-blur-sm rounded-lg transition-all duration-300 ${toplists.length === 0 ? 'bg-surface' : 'bg-black/50'}`}>
                    <div className="text-primary font-bold animate-pulse">加载中...</div>
                  </div>
                )}
                <div className={loadingToplists ? 'opacity-50 transition-opacity duration-300' : 'transition-opacity duration-300'}>
                  <ToplistsView
                    toplists={toplists}
                    onSelect={async (id) => {
                      try {
                        const data = await getToplistSongs(toplistSource, id);
                        const summary = toplists.find(t => t.id === id);
                        const tempPlaylist = toLocalPlaylist(
                          { list: data.list, source: data.source },
                          {
                            id: `toplist-${id}`,
                            name: summary?.name || '排行榜',
                            source: toplistSource,
                            origin: summary?.updateFrequency,
                            pic: summary?.pic,
                            url: summary?.url,
                          },
                        );
                        setViewingPlaylist(tempPlaylist);
                        setActiveTab('playlist');
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'library' && (
          <motion.div
            key="library"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <LibraryView
              playlists={playlists}
              favorites={favorites}
              playlistSource={playlistSource}
              onPlaylistSourceChange={setPlaylistSource}
              onImportPlaylist={importPlaylist}
              loadingPlaylist={loadingPlaylist}
              onCreatePlaylist={createPlaylist}
              onSelectPlaylist={(pl) => {
                setViewingPlaylist(pl);
                setActiveTab('playlist');
              }}
              onPlayFavorites={() => startPlayback(favorites)}
              onPlayPlaylist={(pl) => startPlayback(pl.songs)}
              quality={quality}
              onQualityChange={setQuality}
              sleepEndTime={sleepEndTime}
              onSetSleepTimer={(minutes) => setSleepEndTime(Date.now() + minutes * 60 * 1000)}
              onCancelSleepTimer={() => setSleepEndTime(null)}
            />
          </motion.div>
        )}

        {activeTab === 'playlist' && viewingPlaylist && (
          <motion.div
            key={`playlist-${viewingPlaylist.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <PlaylistDetailView
              playlist={viewingPlaylist}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={playSong}
              onPlayAll={() => startPlayback(viewingPlaylist.songs)}
              onRename={playlists.some(p => p.id === viewingPlaylist.id) ? () => {
                setPlaylistToRename(viewingPlaylist);
                setRenamePlaylistName(viewingPlaylist.name);
                setIsRenamePlaylistModalOpen(true);
              } : undefined}
              onDelete={playlists.some(p => p.id === viewingPlaylist.id) ? () => setPlaylistToDelete(viewingPlaylist.id) : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {showQueue && (
        <QueueView
          queue={queue}
          currentIndex={queueIndex}
          requestClose={requestCloseQueue}
          onPlay={(index) => {
            shouldAutoPlayRef.current = true;
            setQueueIndex(index);
            const targetSong = queue[index];
            // 如果是同一首歌，需要强制触发播放
            if (currentSong && targetSong.id === currentSong.id && targetSong.platform === currentSong.platform) {
              // 强制播放当前已加载的歌曲
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => setIsPlaying(false));
              }
            } else {
              setCurrentSong(targetSong);
            }
          }}
          onRemove={(index) => {
            const newQueue = queue.filter((_, i) => i !== index);
            setQueue(newQueue);
            if (index < queueIndex) {
              setQueueIndex(queueIndex - 1);
            } else if (index === queueIndex) {
              if (newQueue.length === 0) {
                setCurrentSong(null);
                setIsPlaying(false);
              } else {
                const nextIdx = Math.min(index, newQueue.length - 1);
                setQueueIndex(nextIdx);
                setCurrentSong(newQueue[nextIdx]);
              }
            }
          }}
          onClose={() => {
            setShowQueue(false);
            setRequestCloseQueue(false);
          }}
          onClear={() => {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
            setQueue([]);
            setCurrentSong(null);
            setIsPlaying(false);
          }}
        />)}

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <Modal
        isOpen={isRenamePlaylistModalOpen}
        onClose={() => setIsRenamePlaylistModalOpen(false)}
        title="重命名歌单"
        footer={
          <>
            <button
              onClick={() => setIsRenamePlaylistModalOpen(false)}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleRenamePlaylist}
              className="px-4 py-2 bg-primary text-black font-bold rounded-md hover:opacity-90 transition-opacity"
            >
              保存
            </button>
          </>
        }
      >
        <input
          type="text"
          value={renamePlaylistName}
          onChange={(e) => setRenamePlaylistName(e.target.value)}
          placeholder="请输入新的歌单名称"
          className="w-full bg-black/20 border border-gray-700 rounded-md px-4 py-2 text-white outline-none focus:border-primary transition-colors"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleRenamePlaylist()}
        />
      </Modal>

      <Modal
        isOpen={isAddToPlaylistModalOpen}
        onClose={() => setIsAddToPlaylistModalOpen(false)}
        title="添加到歌单"
        footer={
          <button
            onClick={() => setIsAddToPlaylistModalOpen(false)}
            className="px-4 py-2 bg-primary text-black font-bold rounded-md hover:opacity-90 transition-opacity"
          >
            完成
          </button>
        }
      >
        <div className="flex flex-col gap-2 max-h-[35vh] overflow-y-auto custom-scrollbar">
          <div
            onClick={() => songToAddToPlaylist && toggleSongInPlaylist(FAVORITES_ID, songToAddToPlaylist)}
            className="flex items-center justify-between p-3 rounded-md hover:bg-white/10 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded flex items-center justify-center">
                <Heart size={20} fill="white" className="text-white" />
              </div>
              <span className="font-medium text-white">{FAVORITES_NAME}</span>
            </div>
            {songToAddToPlaylist && favorites.some(s => s.id === songToAddToPlaylist.id && s.platform === songToAddToPlaylist.platform) && (
              <Check size={20} className="text-primary" />
            )}
          </div>

          {playlists.map(pl => (
            <div
              key={pl.id}
              onClick={() => songToAddToPlaylist && toggleSongInPlaylist(pl.id, songToAddToPlaylist)}
              className="flex items-center justify-between p-3 rounded-md hover:bg-white/10 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded flex items-center justify-center ${getGradientFromId(pl.id)}`}>
                  <ListMusic size={20} className="text-white/70" />
                </div>
                <span className="font-medium text-white">{pl.name}</span>
              </div>
              {songToAddToPlaylist && pl.songs.some(s => s.id === songToAddToPlaylist.id && s.platform === songToAddToPlaylist.platform) && (
                <Check size={20} className="text-primary" />
              )}
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={isCreatePlaylistModalOpen}
        onClose={() => setIsCreatePlaylistModalOpen(false)}
        title="新建歌单"
        footer={
          <>
            <button
              onClick={() => setIsCreatePlaylistModalOpen(false)}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreatePlaylistConfirm}
              className="px-4 py-2 bg-primary text-black font-bold rounded-md hover:opacity-90 transition-opacity"
            >
              创建
            </button>
          </>
        }
      >
        <input
          type="text"
          value={newPlaylistName}
          onChange={(e) => setNewPlaylistName(e.target.value)}
          placeholder="请输入歌单名称"
          className="w-full bg-black/20 border border-gray-700 rounded-md px-4 py-2 text-white outline-none focus:border-primary transition-colors"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylistConfirm()}
        />
      </Modal>

      <Modal
        isOpen={!!playlistToDelete}
        onClose={() => setPlaylistToDelete(null)}
        title="删除歌单"
        footer={
          <>
            <button
              onClick={() => setPlaylistToDelete(null)}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleDeletePlaylistConfirm}
              className="px-4 py-2 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 transition-colors"
            >
              删除
            </button>
          </>
        }
      >
        <p className="text-gray-300">确定要删除这个歌单吗？此操作无法撤销。</p>
      </Modal>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <SyncIndicator />
    </Layout>
  );
}

export default App;
