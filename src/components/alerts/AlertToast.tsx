'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UnifiedAlert, AlertSeverity } from '@/types/alerts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Warning as AlertTriangle, Info, WarningCircle as AlertCircle, X } from '@phosphor-icons/react';

interface AlertToastProps {
  alert: UnifiedAlert;
  duration?: number;
  onExpire?: () => void;
  onClose?: () => void; // Only close functionality needed
  onHover?: () => void;
  onLeave?: () => void;
}

export const AlertToast: React.FC<AlertToastProps> = ({
  alert,
  duration = 8000,
  onExpire,
  onClose,
  onHover,
  onLeave
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const pausedTimeRef = useRef<number>(0);

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return <AlertCircle className="h-5 w-5 text-critical" />;
      case AlertSeverity.WARNING:
        return <AlertTriangle className="h-5 w-5 text-flag" />;
      case AlertSeverity.INFO:
        return <Info className="h-5 w-5 text-info" />;
      default:
        return <Info className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 'border-l-critical';
      case AlertSeverity.WARNING:
        return 'border-l-flag-line';
      case AlertSeverity.INFO:
        return 'border-l-iris';
      default:
        return 'border-l-input';
    }
  };

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onClose?.();
    }, 300); // Allow time for exit animation
  }, [onClose]);

  const updateProgress = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current - pausedTimeRef.current;
    const remaining = Math.max(0, duration - elapsed);
    const progressPercent = (remaining / duration) * 100;
    
    setProgress(progressPercent);
    
    if (remaining <= 0) {
      onExpire?.();
      handleClose();
    }
  }, [duration, onExpire, handleClose]);

  // Auto-expire timer
  useEffect(() => {
    if (!isPaused && isVisible) {
      timerRef.current = setInterval(updateProgress, 50);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused, isVisible, updateProgress]);

  // Mouse handlers
  const handleMouseEnter = () => {
    setIsPaused(true);
    pausedTimeRef.current = Date.now() - startTimeRef.current - pausedTimeRef.current;
    onHover?.();
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    startTimeRef.current = Date.now() - pausedTimeRef.current;
    onLeave?.();
  };

  // Touch handlers for swipe-up-to-close
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startY;
    setCurrentY(Math.min(0, deltaY)); // Only allow upward swipe (negative values)
  };

  const handleTouchEnd = () => {
    if (currentY < -100) { // Swipe up threshold
      handleClose();
    } else {
      setCurrentY(0);
    }
    setIsDragging(false);
    setIsPaused(false);
  };

  const toastStyle = {
    transform: `translateY(${currentY}px)`,
    opacity: currentY < -50 ? 1 - (Math.abs(currentY) / 200) : 1,
    transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Card 
      className={`
        ${getSeverityColor(alert.severity)} 
        border-l-[3px] bg-card shadow-float cursor-pointer transition-all duration-300 w-[min(24rem,calc(100vw-2rem))]
        ${isVisible ? 'animate-in slide-in-from-right' : 'animate-out slide-out-to-right'}
      `}
      style={toastStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1">
            {getSeverityIcon(alert.severity)}
            <CardTitle className="font-sans text-sm font-semibold leading-snug line-clamp-2">
              {alert.title}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-well/50"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 pb-3">
        <p className="text-sm text-ink mb-2 line-clamp-3">
          {alert.message}
        </p>
        
        {alert.suggestion && (
          <p className="text-xs text-ink-2 italic">
            <strong>Suggestion:</strong> {alert.suggestion}
          </p>
        )}

        <div className="flex items-center justify-between mt-3">
          <Badge variant="outline" className="text-xs">
            {alert.severity}
          </Badge>
          
          {alert.confidenceScore && (
            <span className="text-xs text-muted-foreground">
              {Math.round(alert.confidenceScore * 100)}% confidence
            </span>
          )}
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-well rounded-full h-1 mt-3">
          <div 
            className="bg-iris/40 h-1 rounded-full transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default AlertToast; 