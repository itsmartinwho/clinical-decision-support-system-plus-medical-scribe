import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MagnifyingGlass,
  User,
  BookOpen,
  Stethoscope,
  Plus,
  Star
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export interface SearchResultItem {
  id: string;
  title: string;
  description?: string;
  preview?: string;
  category: 'patients' | 'guidelines' | 'encounters';
  metadata?: {
    source?: string;
    specialty?: string;
    grade?: string;
    updatedAt?: string;
    patientId?: string;
    photo?: string;
  };
  url: string;
}

export interface CategorizedResults {
  patients: SearchResultItem[];
  guidelines: SearchResultItem[];
  encounters: SearchResultItem[];
}

interface SearchResultsProps {
  results: CategorizedResults;
  query: string;
  onResultClick: (item: SearchResultItem) => void;
  onApplyToPatient?: (guideline: SearchResultItem) => void;
  isLoading?: boolean;
  className?: string;
}

const categoryIcons = {
  patients: User,
  guidelines: BookOpen,
  encounters: Stethoscope
};

const categoryLabels = {
  patients: 'Patients',
  guidelines: 'Guidelines',
  encounters: 'Encounters'
};

const sourceColors = {
  'USPSTF': 'bg-info-soft text-info border-info/30',
  'NICE': 'bg-info-soft text-info border-info/30',
  'NCI': 'bg-ok-soft text-ok border-ok-line',
  'RxNorm': 'bg-flag-soft text-flag border-flag-line',
  'CDC': 'bg-info-soft text-info border-info/30',
  'default': 'bg-well text-ink border-border'
};

function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text || '';
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark key={index} className="bg-flag-soft text-flag px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function SearchResults({
  results,
  query,
  onResultClick,
  onApplyToPatient,
  isLoading = false,
  className
}: SearchResultsProps) {
  const totalResults = results.patients.length + results.guidelines.length + results.encounters.length;

  if (isLoading) {
    return (
      <div className={cn("p-4 text-center", className)}>
        <div className="flex items-center justify-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-info/30 border-t-transparent" />
          <span className="text-sm text-ink-2">Searching...</span>
        </div>
      </div>
    );
  }

  if (totalResults === 0) {
    return (
      <div className={cn("p-6 text-center", className)}>
        <MagnifyingGlass className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-ink-2 font-medium">No results found</p>
        <p className="text-sm text-muted-foreground">Try adjusting your search terms</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Categories */}
      {Object.entries(results).map(([categoryKey, items]) => {
        if (items.length === 0) return null;
        
        const category = categoryKey as keyof CategorizedResults;
        const CategoryIcon = categoryIcons[category];
        
        return (
          <div key={category} className="px-4">
            {/* Category Header */}
            <div className="flex items-center gap-2 mb-3">
              <CategoryIcon className="h-4 w-4 text-ink-2" />
              <h3 className="font-semibold text-ink text-sm">
                {categoryLabels[category]}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {items.length}
              </Badge>
            </div>

            {/* Category Results */}
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group relative border border-border rounded-lg p-3 hover:border-info/30 hover:shadow-sm transition-all duration-200 cursor-pointer"
                  onClick={() => onResultClick(item)}
                >
                  <div className="flex items-start gap-3">
                    {/* Item Icon/Avatar */}
                    <div className="flex-shrink-0 mt-0.5">
                      {category === 'patients' && item.metadata?.photo ? (
                        <Image
                          src={item.metadata.photo}
                          alt={item.title}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      ) : (
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          category === 'patients' ? "bg-info-soft text-info" :
                          category === 'guidelines' ? "bg-ok-soft text-ok" :
                          "bg-info-soft text-info"
                        )}>
                          <CategoryIcon className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-ink text-sm truncate">
                            {highlightText(item.title, query)}
                          </h4>
                          
                          {item.description && (
                            <p className="text-xs text-ink-2 mt-0.5 line-clamp-1">
                              {highlightText(item.description, query)}
                            </p>
                          )}
                          
                          {item.preview && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {highlightText(item.preview, query)}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {/* Apply to Patient button for guidelines */}
                          {category === 'guidelines' && onApplyToPatient && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onApplyToPatient(item);
                              }}
                              className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Apply
                            </Button>
                          )}
                          
                          {/* Bookmark for guidelines */}
                          {category === 'guidelines' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Implement bookmark functionality
                              }}
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Star className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Metadata badges */}
                      <div className="flex items-center gap-2 mt-2">
                        {item.metadata?.source && category === 'guidelines' && (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs px-1.5 py-0.5",
                              sourceColors[item.metadata.source as keyof typeof sourceColors] || sourceColors.default
                            )}
                          >
                            {item.metadata.source}
                          </Badge>
                        )}
                        
                        {item.metadata?.specialty && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-well/50 text-ink">
                            {item.metadata.specialty}
                          </Badge>
                        )}
                        
                        {item.metadata?.grade && category === 'guidelines' && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-flag-soft text-flag border-flag-line">
                            Grade {item.metadata.grade}
                          </Badge>
                        )}
                        
                        {item.metadata?.updatedAt && (
                          <span className="text-xs text-muted-foreground">
                            Updated {item.metadata.updatedAt}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
} 