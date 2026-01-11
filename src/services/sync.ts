import type { Song, LocalPlaylist } from '../types';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface FavoritesResponse {
    songs: Song[];
    updatedAt: number;
    version: number;
}

interface PlaylistsResponse {
    playlists: LocalPlaylist[];
    updatedAt: number;
    version: number;
}

/**
 * Cloud sync service for favorites and playlists
 */
export class SyncService {
    private baseUrl: string;

    constructor(baseUrl = '/api/user') {
        this.baseUrl = baseUrl;
    }

    private getHeaders(token: string) {
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    // ==================== Favorites ====================

    /**
     * Get favorites from cloud
     */
    async getFavorites(token: string): Promise<Song[]> {
        const response = await fetch(`${this.baseUrl}/favorites`, {
            headers: this.getHeaders(token)
        });

        if (!response.ok) {
            throw new Error('Failed to fetch favorites');
        }

        const data: FavoritesResponse = await response.json();
        return data.songs;
    }

    /**
     * Add a song to favorites
     */
    async addFavorite(token: string, song: Song): Promise<void> {
        const response = await fetch(`${this.baseUrl}/favorites`, {
            method: 'POST',
            headers: this.getHeaders(token),
            body: JSON.stringify(song)
        });

        if (!response.ok) {
            throw new Error('Failed to add favorite');
        }
    }

    /**
     * Remove a song from favorites
     */
    async removeFavorite(token: string, songId: string, platform: string): Promise<void> {
        const response = await fetch(
            `${this.baseUrl}/favorites?id=${songId}&platform=${platform}`,
            {
                method: 'DELETE',
                headers: this.getHeaders(token)
            }
        );

        if (!response.ok) {
            throw new Error('Failed to remove favorite');
        }
    }

    /**
     * Batch sync favorites (replace cloud data)
     */
    async syncFavorites(token: string, songs: Song[]): Promise<void> {
        const response = await fetch(`${this.baseUrl}/favorites`, {
            method: 'PUT',
            headers: this.getHeaders(token),
            body: JSON.stringify({ songs })
        });

        if (!response.ok) {
            throw new Error('Failed to sync favorites');
        }
    }

    // ==================== Playlists ====================

    /**
     * Get all playlists from cloud
     */
    async getPlaylists(token: string): Promise<LocalPlaylist[]> {
        const response = await fetch(`${this.baseUrl}/playlists`, {
            headers: this.getHeaders(token)
        });

        if (!response.ok) {
            throw new Error('Failed to fetch playlists');
        }

        const data: PlaylistsResponse = await response.json();
        return data.playlists;
    }

    /**
     * Create a new playlist
     */
    async createPlaylist(token: string, playlist: LocalPlaylist): Promise<void> {
        const response = await fetch(`${this.baseUrl}/playlists`, {
            method: 'POST',
            headers: this.getHeaders(token),
            body: JSON.stringify(playlist)
        });

        if (!response.ok) {
            throw new Error('Failed to create playlist');
        }
    }

    /**
     * Update an existing playlist
     */
    async updatePlaylist(token: string, playlist: Partial<LocalPlaylist> & { id: string }): Promise<void> {
        const response = await fetch(`${this.baseUrl}/playlists`, {
            method: 'PUT',
            headers: this.getHeaders(token),
            body: JSON.stringify(playlist)
        });

        if (!response.ok) {
            throw new Error('Failed to update playlist');
        }
    }

    /**
     * Delete a playlist
     */
    async deletePlaylist(token: string, playlistId: string): Promise<void> {
        const response = await fetch(
            `${this.baseUrl}/playlists?id=${playlistId}`,
            {
                method: 'DELETE',
                headers: this.getHeaders(token)
            }
        );

        if (!response.ok) {
            throw new Error('Failed to delete playlist');
        }
    }

    /**
     * Batch sync playlists (replace cloud data)
     */
    async syncPlaylists(token: string, playlists: LocalPlaylist[]): Promise<void> {
        const response = await fetch(`${this.baseUrl}/playlists`, {
            method: 'PUT',
            headers: this.getHeaders(token),
            body: JSON.stringify({ playlists })
        });

        if (!response.ok) {
            throw new Error('Failed to sync playlists');
        }
    }
}

// Export singleton instance
export const syncService = new SyncService();
