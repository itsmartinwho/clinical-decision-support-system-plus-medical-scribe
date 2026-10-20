'use client';

import React, { useState, useEffect } from 'react';
import { CaretDown as ChevronDown, Check, Stethoscope } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GuidelineUIService } from '@/services/guidelines/guidelineUIService';
import { SpecialtyCategory, Specialty } from '@/types/guidelines';
import { Badge } from '@/components/ui/badge';

interface SpecialtyDropdownProps {
  selectedSpecialty: Specialty;
  onSpecialtyChange: (specialty: Specialty) => void;
  disabled?: boolean;
  className?: string;
}

export default function SpecialtyDropdown({
  selectedSpecialty,
  onSpecialtyChange,
  disabled = false,
  className
}: SpecialtyDropdownProps) {
  const [specialtyCategories, setSpecialtyCategories] = useState<SpecialtyCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadSpecialties = async () => {
      try {
        setIsLoading(true);
        const uiService = new GuidelineUIService();
        const categories = await uiService.getSpecialtyCategories();
        setSpecialtyCategories(categories);
      } catch (error) {
        console.error('Error loading specialty categories:', error);
        // Set default categories as fallback
        setSpecialtyCategories([
          { id: 'All', displayName: 'All Specialties', icon: '🏥', description: 'All clinical guidelines', guidelineCount: 0, color: '#6B7280' },
          { id: 'Primary Care', displayName: 'Primary Care', icon: '👩‍⚕️', description: 'General practice and family medicine', guidelineCount: 0, color: '#059669' },
          { id: 'Cardiology', displayName: 'Cardiology', icon: '❤️', description: 'Heart and cardiovascular system', guidelineCount: 0, color: '#DC2626' },
          { id: 'Oncology', displayName: 'Oncology', icon: '🎗️', description: 'Cancer diagnosis and treatment', guidelineCount: 0, color: '#7C3AED' },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    loadSpecialties();
  }, []);

  const selectedCategory = specialtyCategories.find(cat => cat.id === selectedSpecialty);

  const handleSpecialtySelect = (specialty: Specialty) => {
    onSpecialtyChange(specialty);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Stethoscope className="h-4 w-4 text-muted-foreground" />
        <div className="h-8 w-32 bg-well rounded animate-pulse" />
      </div>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 h-8 px-3 bg-card border-border hover:bg-well",
            "transition-all duration-200",
            className
          )}
        >
          <Stethoscope className="h-4 w-4 text-ink-2" />
          <span className="text-sm font-medium truncate max-w-32">
            {selectedCategory?.displayName || 'Select Specialty'}
          </span>
          {selectedCategory && selectedCategory.guidelineCount > 0 && (
            <Badge variant="secondary" className="text-xs px-1 py-0 h-4 text-ink-2">
              {selectedCategory.guidelineCount}
            </Badge>
          )}
          <ChevronDown 
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )} 
          />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="start" 
        className="w-64 max-h-[60vh] p-0 bg-card border border-border shadow-lg"
      >
        <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
          <div className="space-y-1">
            {specialtyCategories.map((category) => (
            <DropdownMenuItem
              key={category.id}
              onClick={() => handleSpecialtySelect(category.id)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg cursor-pointer",
                "hover:bg-well/50 transition-colors duration-150",
                selectedSpecialty === category.id && "bg-info-soft border border-info/30"
              )}
            >
              {/* Specialty Icon */}
              <div 
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                style={{ 
                  backgroundColor: selectedSpecialty === category.id ? `${category.color}20` : '#F3F4F6',
                  color: selectedSpecialty === category.id ? category.color : '#6B7280'
                }}
              >
                {category.icon}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "font-medium text-sm truncate",
                    selectedSpecialty === category.id ? "text-ink" : "text-ink"
                  )}>
                    {category.displayName}
                  </span>
                  {category.guidelineCount > 0 && (
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "ml-2 text-xs",
                        selectedSpecialty === category.id && "bg-info-soft text-info"
                      )}
                    >
                      {category.guidelineCount}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {category.description}
                </p>
              </div>
              
              {/* Selection Indicator */}
              {selectedSpecialty === category.id && (
                <Check className="h-4 w-4 text-info flex-shrink-0" />
              )}
            </DropdownMenuItem>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 