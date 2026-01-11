import { Env } from '../../types';
import { verifyToken } from '../utils/auth';

interface FavoritesData {
    songs: any[];
    updatedAt: number;
    version: number;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
    const user = await verifyToken(request);
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    const favoritesKey = `favorites:${user.sub}`;

    // GET - Retrieve favorites
    if (request.method === 'GET') {
        const data = await env.HISTORY_KV.get(favoritesKey);
        const defaultData: FavoritesData = { songs: [], updatedAt: 0, version: 0 };
        return new Response(data || JSON.stringify(defaultData), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    // POST - Add to favorites
    if (request.method === 'POST') {
        try {
            const song = await request.json();
            const rawData = await env.HISTORY_KV.get(favoritesKey);
            const data: FavoritesData = rawData
                ? JSON.parse(rawData)
                : { songs: [], version: 0, updatedAt: 0 };

            // Check for duplicates (same id and platform)
            const exists = data.songs.some(
                s => s.id === song.id && s.platform === song.platform
            );

            if (!exists) {
                data.songs.push(song);
                data.updatedAt = Date.now();
                data.version++;
                await env.HISTORY_KV.put(favoritesKey, JSON.stringify(data));
            }

            return new Response(JSON.stringify(data), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } catch (e) {
            return new Response('Error adding favorite', { status: 500 });
        }
    }

    // DELETE - Remove from favorites
    if (request.method === 'DELETE') {
        try {
            const url = new URL(request.url);
            const songId = url.searchParams.get('id');
            const platform = url.searchParams.get('platform');

            if (!songId || !platform) {
                return new Response('Missing id or platform parameter', { status: 400 });
            }

            const rawData = await env.HISTORY_KV.get(favoritesKey);
            const data: FavoritesData = rawData
                ? JSON.parse(rawData)
                : { songs: [], version: 0, updatedAt: 0 };

            data.songs = data.songs.filter(
                s => !(s.id === songId && s.platform === platform)
            );
            data.updatedAt = Date.now();
            data.version++;

            await env.HISTORY_KV.put(favoritesKey, JSON.stringify(data));
            return new Response(JSON.stringify(data), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } catch (e) {
            return new Response('Error removing favorite', { status: 500 });
        }
    }

    // PUT - Batch sync favorites (replace entire list)
    if (request.method === 'PUT') {
        try {
            const { songs } = await request.json();
            const data: FavoritesData = {
                songs: songs || [],
                updatedAt: Date.now(),
                version: 1
            };

            await env.HISTORY_KV.put(favoritesKey, JSON.stringify(data));
            return new Response(JSON.stringify(data), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } catch (e) {
            return new Response('Error syncing favorites', { status: 500 });
        }
    }

    return new Response('Method not allowed', { status: 405 });
};
