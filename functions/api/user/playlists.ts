import { Env } from '../../types';
import { verifyToken } from '../utils/auth';

interface PlaylistsData {
    playlists: any[];
    updatedAt: number;
    version: number;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
    const user = await verifyToken(request);
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    const playlistsKey = `playlists:${user.sub}`;

    // GET - Retrieve all playlists
    if (request.method === 'GET') {
        const data = await env.HISTORY_KV.get(playlistsKey);
        const defaultData: PlaylistsData = { playlists: [], updatedAt: 0, version: 0 };
        return new Response(data || JSON.stringify(defaultData), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    // POST - Create new playlist
    if (request.method === 'POST') {
        try {
            const playlist = await request.json();
            const rawData = await env.HISTORY_KV.get(playlistsKey);
            const data: PlaylistsData = rawData
                ? JSON.parse(rawData)
                : { playlists: [], version: 0, updatedAt: 0 };

            // Add to beginning of array
            data.playlists.unshift(playlist);
            data.updatedAt = Date.now();
            data.version++;

            await env.HISTORY_KV.put(playlistsKey, JSON.stringify(data));
            return new Response(JSON.stringify(data), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } catch (e) {
            return new Response('Error creating playlist', { status: 500 });
        }
    }

    // PUT - Update existing playlist or batch sync
    if (request.method === 'PUT') {
        try {
            const body = await request.json();

            // Batch sync mode: replace entire playlists array
            if (body.playlists && Array.isArray(body.playlists)) {
                const data: PlaylistsData = {
                    playlists: body.playlists,
                    updatedAt: Date.now(),
                    version: 1
                };
                await env.HISTORY_KV.put(playlistsKey, JSON.stringify(data));
                return new Response(JSON.stringify(data), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }

            // Single playlist update mode
            if (body.id) {
                const rawData = await env.HISTORY_KV.get(playlistsKey);
                const data: PlaylistsData = rawData
                    ? JSON.parse(rawData)
                    : { playlists: [], version: 0, updatedAt: 0 };

                data.playlists = data.playlists.map(p =>
                    p.id === body.id ? { ...p, ...body } : p
                );
                data.updatedAt = Date.now();
                data.version++;

                await env.HISTORY_KV.put(playlistsKey, JSON.stringify(data));
                return new Response(JSON.stringify(data), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }

            return new Response('Invalid update request', { status: 400 });
        } catch (e) {
            return new Response('Error updating playlist', { status: 500 });
        }
    }

    // DELETE - Remove playlist
    if (request.method === 'DELETE') {
        try {
            const url = new URL(request.url);
            const playlistId = url.searchParams.get('id');

            if (!playlistId) {
                return new Response('Missing id parameter', { status: 400 });
            }

            const rawData = await env.HISTORY_KV.get(playlistsKey);
            const data: PlaylistsData = rawData
                ? JSON.parse(rawData)
                : { playlists: [], version: 0, updatedAt: 0 };

            data.playlists = data.playlists.filter(p => p.id !== playlistId);
            data.updatedAt = Date.now();
            data.version++;

            await env.HISTORY_KV.put(playlistsKey, JSON.stringify(data));
            return new Response(JSON.stringify(data), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } catch (e) {
            return new Response('Error deleting playlist', { status: 500 });
        }
    }

    return new Response('Method not allowed', { status: 405 });
};
