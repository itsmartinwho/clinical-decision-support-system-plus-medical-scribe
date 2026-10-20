'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getLikelihoodCategory, LikelihoodCategory } from '@/lib/likelihood';

interface LikelihoodIndicatorProps {
  probabilityDecimal: number;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  showProgressBar?: boolean;
  className?: string;
}

export default function LikelihoodIndicator({
  probabilityDecimal,
  size = 'md',
  showPercentage = true,
  showProgressBar = true,
  className = '',
}: LikelihoodIndicatorProps) {
  const category = getLikelihoodCategory(probabilityDecimal);

  const getLikelihoodColor = (category: LikelihoodCategory) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower === 'high' || categoryLower === 'certain') {
      return {
        badge: 'destructive' as const,
        bar: 'bg-critical',
        text: 'text-critical',
      };
    } else if (categoryLower === 'moderate') {
      return {
        badge: 'default' as const,
        bar: 'bg-flag',
        text: 'text-flag',
      };
    } else { // Low and Negligible
      return {
        badge: 'secondary' as const,
        bar: 'bg-ok',
        text: 'text-ok',
      };
    }
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return {
          container: 'space-y-1',
          badge: 'text-xs px-2 py-0.5',
          progress: 'h-1',
          text: 'text-xs',
        };
      case 'lg':
        return {
          container: 'space-y-3',
          badge: 'text-sm px-3 py-1',
          progress: 'h-3',
          text: 'text-sm',
        };
      default: // md
        return {
          container: 'space-y-2',
          badge: 'text-sm px-2.5 py-0.5',
          progress: 'h-2',
          text: 'text-sm',
        };
    }
  };

  const colors = getLikelihoodColor(category);
  const sizeClasses = getSizeClasses(size);

  return (
    <div className={cn(sizeClasses.container, className)}>
      {/* Badge with likelihood */}
      <div className="flex items-center justify-between">
        <Badge variant={colors.badge} className={sizeClasses.badge}>
          {category}
        </Badge>
        {showPercentage && (
          <span className={cn(sizeClasses.text, 'font-medium', colors.text)}>
            {probabilityDecimal.toFixed(0)}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      {showProgressBar && (
        <div className={cn('relative w-full rounded-full bg-primary/20 overflow-hidden', sizeClasses.progress)}>
          <div 
            className={cn('h-full transition-all rounded-full', colors.bar)}
            style={{ width: `${Math.min(100, Math.max(0, probabilityDecimal))}%` }}
          />
        </div>
      )}
    </div>
  );
} 