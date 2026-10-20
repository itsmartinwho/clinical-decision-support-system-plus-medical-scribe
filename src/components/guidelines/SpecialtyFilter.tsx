'use client';

import React from 'react';
import { SpecialtyCategory, Specialty } from '@/types/guidelines';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SpecialtyFilterProps {
  categories: SpecialtyCategory[];
  selectedSpecialties: Specialty[];
  onSpecialtyChange: (specialties: Specialty[]) => void;
  isLoading?: boolean;
}

export default function SpecialtyFilter({
  categories,
  selectedSpecialties,
  onSpecialtyChange,
  isLoading = false
}: SpecialtyFilterProps) {
  
  const handleSpecialtyToggle = (specialty: Specialty) => {
    if (selectedSpecialties.includes(specialty)) {
      onSpecialtyChange(selectedSpecialties.filter(s => s !== specialty));
    } else {
      onSpecialtyChange([...selectedSpecialties, specialty]);
    }
  };

  const handleSelectAll = () => {
    if (selectedSpecialties.length === categories.length) {
      onSpecialtyChange([]);
    } else {
      onSpecialtyChange(categories.map(cat => cat.id));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-ink">Medical Specialties</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-card rounded-xl border border-border animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ink">Medical Specialties</h3>
        <button
          onClick={handleSelectAll}
          className="text-sm text-info hover:text-info font-medium"
        >
          {selectedSpecialties.length === categories.length ? 'Clear All' : 'Select All'}
        </button>
      </div>
      
      <div className="space-y-2">
        {categories.map((category) => {
          const isSelected = selectedSpecialties.includes(category.id);
          
          return (
            <div
              key={category.id}
              onClick={() => handleSpecialtyToggle(category.id)}
              className={cn(
                "group relative cursor-pointer transition-all duration-200",
                "bg-card rounded-lg border border-border p-3",
                "hover:bg-well hover:shadow-sm hover:border-input",
                isSelected && "bg-card border-info/30 shadow-sm ring-1 ring-ring"
              )}
            >
              <div className="flex items-center space-x-3">
                {/* Compact Icon */}
                <div 
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg",
                    "transition-colors duration-200",
                    isSelected 
                      ? "bg-info-soft text-info" 
                      : "bg-well text-ink-2 group-hover:bg-well"
                  )}
                  style={{ 
                    backgroundColor: isSelected ? `${category.color}20` : undefined,
                    color: isSelected ? category.color : undefined
                  }}
                >
                  {category.icon}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className={cn(
                      "font-medium text-sm",
                      isSelected ? "text-ink" : "text-ink"
                    )}>
                      {category.displayName}
                    </h4>
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "text-xs",
                        isSelected && "bg-info-soft text-info"
                      )}
                    >
                      {category.guidelineCount}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {category.description}
                  </p>
                </div>
                
                {/* Selection Indicator */}
                {isSelected && (
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-info rounded-full" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Selected Count */}
      {selectedSpecialties.length > 0 && (
        <div className="text-sm text-ink-2 bg-info-soft rounded-lg p-3 border border-info/30">
          <span className="font-medium">{selectedSpecialties.length}</span> 
          {selectedSpecialties.length === 1 ? ' specialty' : ' specialties'} selected
        </div>
      )}
    </div>
  );
} 