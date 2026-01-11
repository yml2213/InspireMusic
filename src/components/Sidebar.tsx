import React, { useState, useRef } from 'react';
import { Heart, User } from 'lucide-react';
import { clsx } from 'clsx';
import type { LocalPlaylist } from '../types';
import { CoverImage } from './ui/CoverImage';
import { FAVORITES_ID, getPlaylistCover } from '../utils/playlists';
import { NAV_TABS, type NavTabId } from './navigation/navTabs';
import { UserMenu } from './UserMenu';

interface SidebarProps {
  activeTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
  playlists: LocalPlaylist[];
  activePlaylistId: string;
  onPlaylistSelect: (id: string) => void;
  onCreatePlaylist: () => void;
  onDeletePlaylist: (id: string) => void;
  onOpenAuth: () => void;
  user: { email: string } | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  playlists,
  activePlaylistId,
  onPlaylistSelect,
  onOpenAuth,
  user,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userButtonRef = useRef<HTMLButtonElement>(null);

  const handleUserAreaClick = () => {
    if (user) {
      // If logged in, toggle user menu
      setIsUserMenuOpen(!isUserMenuOpen);
    } else {
      // If not logged in, open auth modal
      onOpenAuth();
    }
  };

  return (
    <div className="w-64 bg-black h-full flex flex-col p-4 gap-6 text-gray-400">
      <div className="flex flex-col gap-2">
        <div className="px-4 py-2 mb-2 text-white font-bold text-xl flex items-center gap-3">
          <img src="/logo.svg" alt="Logo" className="w-10 h-10" />
          <span className="tracking-tight">InspireMusic</span>
        </div>
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={clsx(
                "flex items-center gap-4 px-4 py-3 rounded-md transition-colors font-medium",
                activeTab === tab.id ? "text-white bg-surface" : "hover:text-white hover:bg-surface/50"
              )}
            >
              <Icon size={24} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col gap-2 overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              className={clsx(
                "group flex items-center justify-between px-4 py-2 rounded-md cursor-pointer transition-colors text-sm",
                activePlaylistId === pl.id ? "text-white bg-surface" : "hover:text-white hover:bg-surface/50"
              )}
              onClick={() => onPlaylistSelect(pl.id)}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {pl.id === FAVORITES_ID ? (
                  <div className="min-w-[32px] h-8 w-8 rounded flex items-center justify-center bg-gradient-to-br from-pink-500 to-purple-600 shrink-0">
                    <Heart size={16} fill="white" className="text-white" />
                  </div>
                ) : (
                  <CoverImage
                    src={getPlaylistCover(pl)}
                    alt={pl.name}
                    className="min-w-[32px] h-8 w-8 rounded object-cover bg-gray-800 shrink-0"
                    iconSize={16}
                  />
                )}
                <span className="truncate">{pl.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-auto pt-4 border-t border-zinc-800">
        <button
          ref={userButtonRef}
          onClick={handleUserAreaClick}
          className="flex items-center gap-3 px-4 py-2 w-full hover:text-white hover:bg-surface/50 rounded-md transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
            <User size={16} />
          </div>
          <div className="flex-1 text-left truncate">
            {user ? user.email : '登录 / 注册'}
          </div>
        </button>

        <UserMenu
          isOpen={isUserMenuOpen}
          onClose={() => setIsUserMenuOpen(false)}
          anchorEl={userButtonRef.current}
        />
      </div>
    </div>
  );
};
