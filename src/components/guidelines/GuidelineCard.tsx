'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, BookOpen, Clock } from '@phosphor-icons/react';
import { GuidelineCard as GuidelineCardType, SourceTheme, GuidelineUIState } from '@/types/guidelines';
import { cn } from '@/lib/utils';

interface GuidelineCardProps {
  guideline: GuidelineCardType;
  sourceTheme?: SourceTheme;
  isBookmarked: boolean;
  viewMode: GuidelineUIState['currentView'];
  onClick: () => void;
  onBookmarkToggle: () => void;
}

export default function GuidelineCard({
  guideline,
  sourceTheme,
  isBookmarked,
  viewMode,
  onClick,
  onBookmarkToggle
}: GuidelineCardProps) {
  
  // Source icons
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'USPSTF': return '🇺🇸';
      case 'NICE': return '🇬🇧';
      case 'NCI_PDQ': return '🎗️';
      case 'RxNorm': return '💊';
      default: return '📄';
    }
  };

  // Source colors
  const getSourceColors = (source: string) => {
    switch (source) {
      case 'USPSTF': 
        return {
          bg: 'bg-info-soft',
          border: 'border-info/30',
          badge: 'bg-info',
          text: 'text-info'
        };
      case 'NICE': 
        return {
          bg: 'bg-info-soft',
          border: 'border-info/30', 
          badge: 'bg-info',
          text: 'text-info'
        };
      case 'NCI_PDQ': 
        return {
          bg: 'bg-ok-soft',
          border: 'border-ok-line',
          badge: 'bg-ok', 
          text: 'text-ok'
        };
      case 'RxNorm': 
        return {
          bg: 'bg-flag-soft',
          border: 'border-flag-line',
          badge: 'bg-flag',
          text: 'text-flag'
        };
      default: 
        return {
          bg: 'bg-well/50',
          border: 'border-border',
          badge: 'bg-ink',
          text: 'text-ink'
        };
    }
  };

  const colors = getSourceColors(guideline.source);

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-xl border-2 transition-all duration-300 cursor-pointer",
        "hover:shadow-lg hover:scale-[1.01] transform-gpu p-6",
        colors.bg,
        colors.border,
        "bg-card "
      )}
      onClick={onClick}
    >
      {/* Header with source info */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          <div className="text-2xl">
            {getSourceIcon(guideline.source)}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-ink mb-2 leading-tight">
              {guideline.title}
            </h4>
            <Badge className={cn("text-white text-xs", colors.badge)}>
              {guideline.source}
            </Badge>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onBookmarkToggle();
          }}
          className="h-8 w-8 p-0"
        >
          <Star 
            className={cn(
              "h-4 w-4",
              isBookmarked ? "fill-flag-line text-flag" : "text-muted-foreground"
            )}
          />
        </Button>
      </div>

      {/* Content preview */}
      <p className="text-sm text-ink-2 mb-4 leading-relaxed">
        {guideline.preview}
      </p>

      {/* Footer with metadata */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center space-x-1">
          <Clock className="h-3 w-3" />
          <span>Updated {new Date(guideline.lastUpdated).toLocaleDateString()}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          {guideline.metadata?.url && (
            <a
              href={guideline.metadata.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-info hover:text-info hover:underline"
            >
              Original Source
            </a>
          )}
          <div className="flex items-center space-x-1">
            <BookOpen className="h-3 w-3" />
            <span>View Guideline</span>
          </div>
        </div>
      </div>

      {/* Status indicators */}
      {(guideline.isRecentlyUpdated || guideline.isRecentlyViewed) && (
        <div className="absolute top-3 right-14 flex space-x-1">
          {guideline.isRecentlyUpdated && (
            <div className="w-2 h-2 bg-ok rounded-full"></div>
          )}
          {guideline.isRecentlyViewed && (
            <div className="w-2 h-2 bg-info rounded-full"></div>
          )}
        </div>
      )}
    </div>
  );
} 