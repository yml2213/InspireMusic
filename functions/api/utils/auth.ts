// JWT secret - MUST match login.ts
const JWT_SECRET = 'temp_secret_key_change_me';

/**
 * Verifies JWT token and returns decoded payload
 * @param request - Incoming HTTP request
 * @returns Decoded JWT payload or null if invalid
 */
export async function verifyToken(request: Request): Promise<any | null> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];

    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [headerB64, bodyB64, signatureB64] = parts;
        const enc = new TextEncoder();
        const algorithm = { name: 'HMAC', hash: 'SHA-256' };

        const key = await crypto.subtle.importKey(
            'raw',
            enc.encode(JWT_SECRET),
            algorithm,
            false,
            ['verify']
        );

        const signature = Uint8Array.from(
            atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
            c => c.charCodeAt(0)
        );

        const isValid = await crypto.subtle.verify(
            algorithm,
            key,
            signature,
            enc.encode(`${headerB64}.${bodyB64}`)
        );

        if (!isValid) return null;

        const payload = JSON.parse(atob(bodyB64.replace(/-/g, '+').replace(/_/g, '/')));

        // Check expiration
        if (payload.exp < Date.now() / 1000) return null;

        return payload;
    } catch (e) {
        return null;
    }
}
