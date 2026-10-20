'use client';

import React from 'react';
import { ArrowSquareOut, BookOpen, Medal, Shield, Dna, Pill } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface GuidelineReference {
  id: string;
  title: string;
  source: 'USPSTF' | 'NICE' | 'NCI_PDQ' | 'RxNorm';
  url?: string;
  summary?: string;
  grade?: string;
  specialty?: string;
}

interface GuidelineReferencesProps {
  references: GuidelineReference[];
  className?: string;
  onReferenceClick?: (reference: GuidelineReference) => void;
}

const sourceConfig = {
  USPSTF: {
    name: 'USPSTF',
    color: '#2563EB', // Blue
    bgColor: '#EFF6FF',
    textColor: '#1E40AF',
    icon: Medal,
    description: 'US Preventive Services Task Force'
  },
  NICE: {
    name: 'NICE',
    color: '#7C3AED', // Purple
    bgColor: '#F3E8FF',
    textColor: '#6B21A8',
    icon: Shield,
    description: 'National Institute for Health and Care Excellence'
  },
  NCI_PDQ: {
    name: 'NCI',
    color: '#059669', // Green
    bgColor: '#ECFDF5',
    textColor: '#047857',
    icon: Dna,
    description: 'National Cancer Institute'
  },
  RxNorm: {
    name: 'RxNorm',
    color: '#EA580C', // Orange
    bgColor: '#FFF7ED',
    textColor: '#C2410C',
    icon: Pill,
    description: 'RxNorm Drug Database'
  }
};

export default function GuidelineReferences({ references, className, onReferenceClick }: GuidelineReferencesProps) {
  if (!references || references.length === 0) {
    return null;
  }

  const handleReferenceClick = (reference: GuidelineReference) => {
    if (onReferenceClick) {
      // Use custom click handler (for modal opening)
      onReferenceClick(reference);
    } else if (reference.url) {
      // Fallback to opening external URL
      window.open(reference.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={cn("mt-4 p-4 bg-well/70 rounded-lg border border-border/50", className)}>
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="h-4 w-4 text-ink-2" />
        <h4 className="text-sm font-semibold text-ink">Clinical Guidelines Referenced</h4>
      </div>
      
      <div className="space-y-3">
        {references.map((reference) => {
          const config = sourceConfig[reference.source];
          const IconComponent = config.icon;
          
          return (
            <div
              key={reference.id}
              className={cn(
                "group flex items-start gap-3 p-3 rounded-lg border transition-all duration-200",
                "hover:shadow-sm",
                reference.url ? "cursor-pointer hover:border-border" : "cursor-default"
              )}
              style={{ 
                backgroundColor: config.bgColor,
                borderColor: `${config.color}30`
              }}
              onClick={() => handleReferenceClick(reference)}
            >
              {/* Source Icon */}
              <div
                className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                style={{ 
                  backgroundColor: `${config.color}20`,
                  color: config.color
                }}
              >
                <IconComponent className="h-4 w-4" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h5 
                    className={cn(
                      "font-medium text-sm leading-tight",
                      reference.url && "group-hover:underline"
                    )}
                    style={{ color: config.textColor }}
                  >
                    {reference.title}
                  </h5>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Source Badge */}
                    <Badge
                      variant="secondary"
                      className="text-xs font-medium"
                      style={{
                        backgroundColor: `${config.color}15`,
                        color: config.textColor,
                        borderColor: `${config.color}30`
                      }}
                    >
                      {config.name}
                    </Badge>
                    
                    {/* Grade Badge */}
                    {reference.grade && (
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{
                          borderColor: config.color,
                          color: config.textColor
                        }}
                      >
                        Grade {reference.grade}
                      </Badge>
                    )}
                    
                    {/* External Link Icon */}
                    {reference.url && (
                      <ArrowSquareOut 
                        className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" 
                        style={{ color: config.color }}
                      />
                    )}
                  </div>
                </div>
                
                {/* Summary */}
                {reference.summary && (
                  <p className="text-xs text-ink-2 line-clamp-2 leading-relaxed">
                    {reference.summary}
                  </p>
                )}
                
                {/* Specialty Tag */}
                {reference.specialty && (
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs bg-well text-ink-2">
                      {reference.specialty}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Footer with count */}
      <div className="mt-3 pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          {references.length} guideline{references.length !== 1 ? 's' : ''} referenced
        </p>
      </div>
    </div>
  );
}

// Export utility function to parse references from text
export function parseGuidelineReferences(text: string): GuidelineReference[] {
  // This would be implemented to parse references from advisor response text
  // For now, return empty array - will be populated by backend
  return [];
}

// Export utility function to format reference for display
export function formatReferenceText(reference: GuidelineReference): string {
  const config = sourceConfig[reference.source];
  let formatted = `${config.name}: ${reference.title}`;
  
  if (reference.grade) {
    formatted += ` (Grade ${reference.grade})`;
  }
  
  return formatted;
} 