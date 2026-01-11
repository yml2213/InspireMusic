import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { X, Mail, Lock, Loader2 } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const login = useAuthStore(state => state.login);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!res.ok) {
                throw new Error(await res.text());
            }

            const data = await res.json();

            if (isLogin) {
                login(data.token, data.user);
                onClose();
            } else {
                // Auto login after register? Or just switch to login?
                // Let's auto login if the API returns token (my register API currently doesn't, let's fix that mentally or switch to login mode)
                // My register API in implementation plan returns {id, email}.
                // So we switch to login or message "Registered!"
                setIsLogin(true);
                setError('注册成功！请登录。');
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">{isLogin ? '欢迎回来' : '创建账户'}</h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">邮箱</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-zinc-800 border-zinc-700 rounded-lg pl-10 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                placeholder="your@example.com"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">密码</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-zinc-800 border-zinc-700 rounded-lg pl-10 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold py-2 rounded-lg transition-colors flex justify-center items-center"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? '登录' : '注册')}
                    </button>
                </form>

                <div className="mt-4 text-center text-sm text-zinc-500">
                    {isLogin ? "还没有账户？" : "已有账户？"}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-cyan-500 hover:underline"
                    >
                        {isLogin ? '注册' : '登录'}
                    </button>
                </div>
            </div>
        </div>
    );
}
