'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useModalManager } from '@/components/ui/modal-manager';
import { MinimizedModalData } from '@/types/modal';

interface MinimizedModalBarProps {
  className?: string;
}

/**
 * Component that displays minimized modals at the bottom of the screen
 */
export function MinimizedModalBar({ className }: MinimizedModalBarProps) {
  const { getMinimizedModals, restoreModal, subscribe } = useModalManager();
  const [minimizedModals, setMinimizedModals] = useState<MinimizedModalData[]>([]);

  // Subscribe to modal manager updates for immediate re-renders
  useEffect(() => {
    // Set initial state
    setMinimizedModals(getMinimizedModals());

    // Subscribe to updates - this ensures immediate re-renders when state changes
    const unsubscribe = subscribe(() => {
      setMinimizedModals(getMinimizedModals());
    });

    // Clean up subscription on unmount
    return unsubscribe;
  }, [subscribe, getMinimizedModals]);

  // Handle modal restore
  const handleRestoreModal = (modalId: string) => {
    restoreModal(modalId);
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent, modalId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRestoreModal(modalId);
    }
  };

  // Don't render anything if no minimized modals
  if (minimizedModals.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'minimized-modal-bar',
        'animate-in',
        className
      )}
      role="toolbar"
      aria-label="Minimized modals"
    >
      {minimizedModals.map((modal) => {
        const IconComponent = typeof modal.icon === 'function' ? modal.icon : null;
        
        return (
          <div
            key={modal.id}
            className="minimized-modal-item"
            onClick={() => handleRestoreModal(modal.id)}
            onKeyDown={(e) => handleKeyDown(e, modal.id)}
            role="button"
            tabIndex={0}
            aria-label={`Restore ${modal.title}`}
            title={`Click to restore ${modal.title}`}
          >
            {/* Modal Icon */}
            <div className="minimized-modal-icon">
              {IconComponent && (
                <IconComponent className="w-full h-full" />
              )}
              {typeof modal.icon === 'string' && (
                <span className="text-sm">{modal.icon}</span>
              )}
              {!modal.icon && (
                <div className="w-full h-full bg-card rounded-sm flex items-center justify-center">
                  <span className="text-xs font-semibold">
                    {modal.title.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Modal Title */}
            <span className="minimized-modal-title">
              {modal.title}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Hook to manage minimized modal bar visibility and state
 */
export function useMinimizedModalBar() {
  const { getMinimizedModals, restoreModal } = useModalManager();
  
  const getMinimizedCount = () => {
    return getMinimizedModals().length;
  };

  const restoreLastMinimized = () => {
    const modals = getMinimizedModals();
    if (modals.length > 0) {
      // Restore the most recently minimized (first in array)
      restoreModal(modals[0].id);
    }
  };

  const restoreAllMinimized = () => {
    const modals = getMinimizedModals();
    modals.forEach((modal) => {
      restoreModal(modal.id);
    });
  };

  return {
    getMinimizedCount,
    restoreLastMinimized,
    restoreAllMinimized,
    getMinimizedModals,
  };
} 