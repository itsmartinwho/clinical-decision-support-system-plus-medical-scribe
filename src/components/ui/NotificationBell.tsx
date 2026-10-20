'use client';
import React from 'react';
import { Bell } from '@phosphor-icons/react';

export default function NotificationBell({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <div 
      className="relative cursor-pointer alert-button-bg rounded-full w-8 h-8 flex items-center justify-center" 
      onClick={onClick}
    >
      <Bell className="h-5 w-5 text-ink-2" />
      {count > 0 && (
        <div className="absolute top-0 right-0 w-5 h-5">
          <div 
            className="absolute inset-0 bg-critical text-white text-xs rounded-full flex items-center justify-center z-10"
          >
            {count > 99 ? '99+' : count}
          </div>
          <span 
            className="absolute inset-0 rounded-full ring-2 ring-neon/40 animate-badge-pulse"
            aria-hidden 
          />
        </div>
      )}
    </div>
  );
} 