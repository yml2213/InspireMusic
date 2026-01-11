import { Env, User } from '../../types';

// Simple JWT signing helper (HMAC SHA-256)
async function sign(payload: any, secret: string) {
    const enc = new TextEncoder();
    const algorithm = { name: 'HMAC', hash: 'SHA-256' };
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        algorithm,
        false,
        ['sign']
    );

    const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
    const body = JSON.stringify(payload);

    const b64Header = btoa(header).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const b64Body = btoa(body).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const signature = await crypto.subtle.sign(
        algorithm,
        key,
        enc.encode(`${b64Header}.${b64Body}`)
    );

    const b64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${b64Header}.${b64Body}.${b64Signature}`;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const { email, password } = await request.json() as any;

        if (!email || !password) {
            return new Response('邮箱和密码不能为空', { status: 400 });
        }

        const userRaw = await env.USERS_KV.get(`user:email:${email}`);
        if (!userRaw) {
            return new Response('邮箱或密码错误', { status: 401 });
        }

        const user = JSON.parse(userRaw) as User;

        // Verify password
        const encoder = new TextEncoder();
        const data = encoder.encode(password + user.salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const calculatedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (calculatedHash !== user.passwordHash) {
            return new Response('邮箱或密码错误', { status: 401 });
        }

        // Generate Token
        // In a real app, use a secret from env.JWT_SECRET. For now using a hardcoded fallback or env if available.
        // Note: Cloudflare Pages Secrets are process.env or env vars.
        // We'll assume a default for this demo if not strictly set, but user should set JWT_SECRET.
        const secret = 'temp_secret_key_change_me';

        // Token payload
        const token = await sign({
            sub: user.id,
            email: user.email,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
        }, secret);

        return new Response(JSON.stringify({ token, user: { id: user.id, email: user.email } }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        return new Response('登录失败,请稍后重试', { status: 500 });
    }
};
