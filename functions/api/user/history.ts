import { Env } from '../../types';
import { verifyToken } from '../utils/auth';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
    const user = await verifyToken(request);
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    const historyKey = `history:${user.sub}`;

    if (request.method === 'GET') {
        const history = await env.HISTORY_KV.get(historyKey);
        return new Response(history || '[]', {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (request.method === 'POST') {
        try {
            const item = await request.json();
            let history: any[] = JSON.parse((await env.HISTORY_KV.get(historyKey)) || '[]');

            // Add new item to beginning, limit to 100 items
            history.unshift({ ...item, playedAt: Date.now() });
            if (history.length > 100) history = history.slice(0, 100);

            await env.HISTORY_KV.put(historyKey, JSON.stringify(history));
            return new Response(JSON.stringify(history), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) {
            return new Response('Error saving history', { status: 500 });
        }
    }

    if (request.method === 'DELETE') {
        await env.HISTORY_KV.delete(historyKey);
        return new Response('History cleared', { status: 200 });
    }

    return new Response('Method not allowed', { status: 405 });
};
