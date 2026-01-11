import { useRef, useEffect } from 'react';
import { User, LogOut, Upload, Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/useAppStore';

interface UserMenuProps {
    isOpen: boolean;
    onClose: () => void;
    anchorEl: HTMLElement | null;
}

export function UserMenu({ isOpen, onClose, anchorEl }: UserMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const { user, logout } = useAuthStore();
    const { favorites, playlists, loadCloudData, setSyncStatus, setSyncError } = useAppStore();
    const token = useAuthStore(state => state.token);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                anchorEl &&
                !anchorEl.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, anchorEl]);

    const handleLogout = () => {
        logout();
        onClose();
    };

    const handleUploadToCloud = async () => {
        if (!token) return;

        setSyncStatus('syncing');
        setSyncError(null);

        try {
            const { syncService } = await import('../services/sync');

            // Upload favorites and playlists to cloud (overwrite cloud data)
            await Promise.all([
                syncService.syncFavorites(token, favorites),
                syncService.syncPlaylists(token, playlists)
            ]);

            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (error) {
            console.error('Upload failed:', error);
            setSyncStatus('error');
            setSyncError(error instanceof Error ? error.message : '上传失败');
        }
    };

    const handleDownloadFromCloud = async () => {
        if (!token) return;

        // Load cloud data (will overwrite local data)
        // The loadCloudData method already handles sync status internally
        await loadCloudData(token);
    };

    if (!isOpen || !user) return null;

    // Calculate position based on anchor element
    const rect = anchorEl?.getBoundingClientRect();
    const menuStyle: React.CSSProperties = rect
        ? {
              position: 'fixed',
              left: `${rect.left}px`,
              bottom: `${window.innerHeight - rect.top + 8}px`,
          }
        : {};

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.15 }}
                    style={menuStyle}
                    className="z-50 w-64 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden"
                >
                    {/* Header with user info */}
                    <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-800/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                    <User size={20} className="text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">
                                        {user.email}
                                    </p>
                                    <p className="text-xs text-zinc-400">已登录</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-zinc-400 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Menu items */}
                    <div className="py-2">
                        <button
                            onClick={handleUploadToCloud}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                        >
                            <Upload size={16} />
                            <span>上传本地数据到云端</span>
                        </button>

                        <button
                            onClick={handleDownloadFromCloud}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                        >
                            <Download size={16} />
                            <span>从云端下载数据</span>
                        </button>

                        <div className="my-1 border-t border-zinc-800" />

                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                        >
                            <LogOut size={16} />
                            <span>退出登录</span>
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
