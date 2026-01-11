import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/authStore';
import { Cloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Sync status indicator component
 * Shows cloud sync status in the corner of the screen
 */
export function SyncIndicator() {
    const syncStatus = useAppStore(state => state.syncStatus);
    const syncError = useAppStore(state => state.syncError);
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (syncStatus === 'syncing' || syncStatus === 'success' || syncStatus === 'error') {
            setShow(true);
        } else {
            const timer = setTimeout(() => setShow(false), 500);
            return () => clearTimeout(timer);
        }
    }, [syncStatus]);

    // Don't show if not authenticated
    if (!isAuthenticated) return null;

    const getIcon = () => {
        switch (syncStatus) {
            case 'syncing':
                return <Loader2 className="animate-spin" size={16} />;
            case 'success':
                return <CheckCircle2 size={16} />;
            case 'error':
                return <AlertCircle size={16} />;
            case 'idle':
            default:
                return <Cloud size={16} />;
        }
    };

    const getText = () => {
        switch (syncStatus) {
            case 'syncing':
                return '同步中...';
            case 'success':
                return '同步成功';
            case 'error':
                return syncError || '同步失败';
            case 'idle':
            default:
                return '已同步';
        }
    };

    const getColor = () => {
        switch (syncStatus) {
            case 'syncing':
                return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
            case 'success':
                return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'error':
                return 'text-red-400 bg-red-500/10 border-red-500/20';
            case 'idle':
            default:
                return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
        }
    };

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="fixed top-4 right-4 z-50"
                >
                    <div
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border backdrop-blur-sm ${getColor()}`}
                    >
                        {getIcon()}
                        <span className="text-sm font-medium">{getText()}</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
