import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Song, SongInfo, Quality, LocalPlaylist, ParsedLyricLine } from '../types';
import { syncService, type SyncStatus } from '../services/sync';
import { useAuthStore } from './authStore';

export interface PlayerState {
    // Current playback
    currentSong: Song | null;
    currentInfo: SongInfo | null;
    queue: Song[];
    queueIndex: number;

    // Playback state
    isPlaying: boolean;
    progress: number;
    duration: number;
    volume: number;
    playMode: 'list' | 'shuffle' | 'single';

    // Lyrics
    lyrics: string;
    parsedLyrics: ParsedLyricLine[];
    activeLyricIndex: number;
    lyricsLoading: boolean;

    // Quality
    quality: Quality;

    // Errors
    infoError: string | null;

    // Sleep timer
    sleepEndTime: number | null;

    // Saved progress for resume
    savedProgress: number;
}

export interface PlayerActions {
    // Setters
    setCurrentSong: (song: Song | null) => void;
    setCurrentInfo: (info: SongInfo | null) => void;
    setQueue: (queue: Song[]) => void;
    setQueueIndex: (index: number) => void;
    setIsPlaying: (playing: boolean) => void;
    setProgress: (progress: number) => void;
    setDuration: (duration: number) => void;
    setVolume: (volume: number) => void;
    setPlayMode: (mode: 'list' | 'shuffle' | 'single') => void;
    setLyrics: (lyrics: string) => void;
    setParsedLyrics: (lyrics: ParsedLyricLine[]) => void;
    setActiveLyricIndex: (index: number) => void;
    setLyricsLoading: (loading: boolean) => void;
    setQuality: (quality: Quality) => void;
    setInfoError: (error: string | null) => void;
    setSleepEndTime: (time: number | null) => void;

    // Actions
    clearQueue: () => void;
    removeFromQueue: (index: number) => void;
    saveProgress: (progress: number) => void;
}

export interface DataState {
    favorites: Song[];
    playlists: LocalPlaylist[];
    syncStatus: SyncStatus;
    syncError: string | null;
}

export interface DataActions {
    setFavorites: (favorites: Song[]) => void;
    setPlaylists: (playlists: LocalPlaylist[]) => void;
    setSyncStatus: (status: SyncStatus) => void;
    setSyncError: (error: string | null) => void;
    toggleFavorite: (song: Song) => void;
    addPlaylist: (playlist: LocalPlaylist) => void;
    updatePlaylist: (id: string, updates: Partial<LocalPlaylist>) => void;
    deletePlaylist: (id: string) => void;
    toggleSongInPlaylist: (playlistId: string, song: Song) => void;
    loadCloudData: (token: string) => Promise<void>;
}

type AppStore = PlayerState & PlayerActions & DataState & DataActions;

export const useAppStore = create<AppStore>()(
    persist(
        (set, get) => ({
            // Player State
            currentSong: null,
            currentInfo: null,
            queue: [],
            queueIndex: -1,
            isPlaying: false,
            progress: 0,
            duration: 0,
            volume: 0.8,
            playMode: 'list',
            lyrics: '',
            parsedLyrics: [],
            activeLyricIndex: -1,
            lyricsLoading: false,
            quality: '320k',
            infoError: null,
            sleepEndTime: null,
            savedProgress: 0,

            // Data State
            favorites: [],
            playlists: [],
            syncStatus: 'idle',
            syncError: null,

            // Player Actions
            setCurrentSong: (song) => set({ currentSong: song }),
            setCurrentInfo: (info) => set({ currentInfo: info }),
            setQueue: (queue) => set({ queue }),
            setQueueIndex: (index) => set({ queueIndex: index }),
            setIsPlaying: (playing) => set({ isPlaying: playing }),
            setProgress: (progress) => set({ progress }),
            setDuration: (duration) => set({ duration }),
            setVolume: (volume) => set({ volume }),
            setPlayMode: (mode) => set({ playMode: mode }),
            setLyrics: (lyrics) => set({ lyrics }),
            setParsedLyrics: (lyrics) => set({ parsedLyrics: lyrics }),
            setActiveLyricIndex: (index) => set({ activeLyricIndex: index }),
            setLyricsLoading: (loading) => set({ lyricsLoading: loading }),
            setQuality: (quality) => set({ quality }),
            setInfoError: (error) => set({ infoError: error }),
            setSleepEndTime: (time) => set({ sleepEndTime: time }),

            clearQueue: () => set({ queue: [], queueIndex: -1, currentSong: null }),
            removeFromQueue: (index) => {
                const { queue, queueIndex } = get();
                const newQueue = queue.filter((_, i) => i !== index);
                let newIndex = queueIndex;
                if (index < queueIndex) {
                    newIndex = queueIndex - 1;
                } else if (index === queueIndex) {
                    newIndex = Math.min(queueIndex, newQueue.length - 1);
                }
                set({
                    queue: newQueue,
                    queueIndex: newIndex,
                    currentSong: newQueue[newIndex] || null
                });
            },

            saveProgress: (progress) => set({ savedProgress: progress }),

            // Data Actions
            setFavorites: (favorites) => set({ favorites }),
            setPlaylists: (playlists) => set({ playlists }),
            setSyncStatus: (syncStatus) => set({ syncStatus }),
            setSyncError: (syncError) => set({ syncError }),

            toggleFavorite: async (song) => {
                const { favorites } = get();
                const exists = favorites.some(f => f.id === song.id && f.platform === song.platform);

                // Update local state immediately
                if (exists) {
                    set({ favorites: favorites.filter(f => !(f.id === song.id && f.platform === song.platform)) });
                } else {
                    set({ favorites: [...favorites, song] });
                }

                // Sync to cloud if logged in
                const token = useAuthStore.getState().token;
                if (token) {
                    set({ syncStatus: 'syncing', syncError: null });
                    try {
                        if (exists) {
                            await syncService.removeFavorite(token, song.id, song.platform);
                        } else {
                            await syncService.addFavorite(token, song);
                        }
                        set({ syncStatus: 'success' });
                        // Reset status after 2 seconds
                        setTimeout(() => set({ syncStatus: 'idle' }), 2000);
                    } catch (error) {
                        set({
                            syncStatus: 'error',
                            syncError: error instanceof Error ? error.message : 'Sync failed'
                        });
                        // Revert local change on error
                        if (exists) {
                            set({ favorites: [...get().favorites, song] });
                        } else {
                            set({ favorites: get().favorites.filter(f => !(f.id === song.id && f.platform === song.platform)) });
                        }
                    }
                }
            },

            addPlaylist: async (playlist) => {
                // Update local state immediately
                set(state => ({
                    playlists: [playlist, ...state.playlists]
                }));

                // Sync to cloud if logged in
                const token = useAuthStore.getState().token;
                if (token) {
                    set({ syncStatus: 'syncing', syncError: null });
                    try {
                        await syncService.createPlaylist(token, playlist);
                        set({ syncStatus: 'success' });
                        setTimeout(() => set({ syncStatus: 'idle' }), 2000);
                    } catch (error) {
                        set({
                            syncStatus: 'error',
                            syncError: error instanceof Error ? error.message : 'Sync failed'
                        });
                        // Revert local change on error
                        set(state => ({
                            playlists: state.playlists.filter(p => p.id !== playlist.id)
                        }));
                    }
                }
            },

            updatePlaylist: async (id, updates) => {
                // Update local state immediately
                set(state => ({
                    playlists: state.playlists.map(p => p.id === id ? { ...p, ...updates } : p)
                }));

                // Sync to cloud if logged in
                const token = useAuthStore.getState().token;
                if (token) {
                    set({ syncStatus: 'syncing', syncError: null });
                    try {
                        await syncService.updatePlaylist(token, { id, ...updates });
                        set({ syncStatus: 'success' });
                        setTimeout(() => set({ syncStatus: 'idle' }), 2000);
                    } catch (error) {
                        set({
                            syncStatus: 'error',
                            syncError: error instanceof Error ? error.message : 'Sync failed'
                        });
                        // Note: Not reverting here as it's complex to track previous state
                    }
                }
            },

            deletePlaylist: async (id) => {
                const { playlists } = get();
                const deletedPlaylist = playlists.find(p => p.id === id);

                // Update local state immediately
                set(state => ({
                    playlists: state.playlists.filter(p => p.id !== id)
                }));

                // Sync to cloud if logged in
                const token = useAuthStore.getState().token;
                if (token) {
                    set({ syncStatus: 'syncing', syncError: null });
                    try {
                        await syncService.deletePlaylist(token, id);
                        set({ syncStatus: 'success' });
                        setTimeout(() => set({ syncStatus: 'idle' }), 2000);
                    } catch (error) {
                        set({
                            syncStatus: 'error',
                            syncError: error instanceof Error ? error.message : 'Sync failed'
                        });
                        // Revert local change on error
                        if (deletedPlaylist) {
                            set(state => ({
                                playlists: [...state.playlists, deletedPlaylist]
                            }));
                        }
                    }
                }
            },

            toggleSongInPlaylist: async (playlistId, song) => {
                const { playlists } = get();

                if (playlistId === 'favorites') {
                    // Redirect to toggleFavorite method
                    await get().toggleFavorite(song);
                    return;
                }

                // Update local state immediately
                const prevPlaylists = [...playlists];
                set({
                    playlists: playlists.map(pl => {
                        if (pl.id !== playlistId) return pl;
                        const exists = pl.songs.some(s => s.id === song.id && s.platform === song.platform);
                        if (exists) {
                            return { ...pl, songs: pl.songs.filter(s => !(s.id === song.id && s.platform === song.platform)) };
                        } else {
                            return { ...pl, songs: [...pl.songs, song] };
                        }
                    })
                });

                // Sync to cloud if logged in
                const token = useAuthStore.getState().token;
                if (token) {
                    set({ syncStatus: 'syncing', syncError: null });
                    try {
                        const updatedPlaylist = get().playlists.find(p => p.id === playlistId);
                        if (updatedPlaylist) {
                            await syncService.updatePlaylist(token, updatedPlaylist);
                        }
                        set({ syncStatus: 'success' });
                        setTimeout(() => set({ syncStatus: 'idle' }), 2000);
                    } catch (error) {
                        set({
                            syncStatus: 'error',
                            syncError: error instanceof Error ? error.message : 'Sync failed'
                        });
                        // Revert on error
                        set({ playlists: prevPlaylists });
                    }
                }
            },

            loadCloudData: async (token: string) => {
                set({ syncStatus: 'syncing', syncError: null });
                try {
                    // Fetch favorites and playlists in parallel
                    const [cloudFavorites, cloudPlaylists] = await Promise.all([
                        syncService.getFavorites(token),
                        syncService.getPlaylists(token)
                    ]);

                    // Cloud-first strategy: replace local data with cloud data
                    set({
                        favorites: cloudFavorites,
                        playlists: cloudPlaylists,
                        syncStatus: 'success',
                        syncError: null
                    });

                    setTimeout(() => set({ syncStatus: 'idle' }), 2000);
                } catch (error) {
                    set({
                        syncStatus: 'error',
                        syncError: error instanceof Error ? error.message : 'Failed to load cloud data'
                    });
                }
            },
        }),
        {
            name: 'inspire-music-store',
            partialize: (state) => ({
                // Only persist these fields
                currentSong: state.currentSong,
                queue: state.queue,
                queueIndex: state.queueIndex,
                volume: state.volume,
                playMode: state.playMode,
                quality: state.quality,
                favorites: state.favorites,
                playlists: state.playlists,
                savedProgress: state.savedProgress,
            }),
        }
    )
);
