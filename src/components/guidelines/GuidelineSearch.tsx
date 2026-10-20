'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MagnifyingGlass, 
  SortAscending, 
  Star, 
  X,
  CaretDown,
  Clock,
  BookOpen,
  Funnel
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { GuidelineFilter } from '@/types/guidelines';

interface GuidelineSearchProps {
  searchQuery: string;
  onSearch: (query: string) => void;
  sortBy: GuidelineFilter['sortBy'];
  onSortChange: (sortBy: GuidelineFilter['sortBy']) => void;
  showBookmarksOnly: boolean;
  onBookmarksOnlyChange: (showBookmarksOnly: boolean) => void;
}

const searchSuggestions = [
  'depression screening',
  'hypertension management',
  'diabetes type 2',
  'cancer screening',
  'cardiovascular risk',
  'mental health',
  'preventive care',
  'drug interactions',
  'breast cancer treatment',
  'colorectal cancer',
  'prostate cancer',
  'atrial fibrillation',
  'blood pressure',
  'cholesterol',
  'obesity management'
];

const recentSearches = [
  'depression',
  'hypertension',
  'cancer screening'
];

export default function GuidelineSearch({
  searchQuery,
  onSearch,
  sortBy,
  onSortChange,
  showBookmarksOnly,
  onBookmarksOnlyChange
}: GuidelineSearchProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [tempSearchQuery, setTempSearchQuery] = useState(searchQuery);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [dropdownPortalStyle, setDropdownPortalStyle] = useState<React.CSSProperties | null>(null);
  const [sortPortalStyle, setSortPortalStyle] = useState<React.CSSProperties | null>(null);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on current input
  useEffect(() => {
    if (tempSearchQuery.length > 0) {
      const filtered = searchSuggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(tempSearchQuery.toLowerCase())
      ).slice(0, 6);
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions([]);
    }
  }, [tempSearchQuery]);

  // Calculate dropdown portal position
  useEffect(() => {
    if (isSearchFocused && searchRef.current) {
      const rect = searchRef.current.getBoundingClientRect();
      const dropdownWidth = rect.width;
      
      setDropdownPortalStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: rect.left,
        width: dropdownWidth,
        zIndex: 9999, // Use a very high z-index to ensure it's above everything
      });
    }
  }, [isSearchFocused]);

  // Calculate sort dropdown portal position
  useEffect(() => {
    if (isSortDropdownOpen && sortRef.current) {
      const rect = sortRef.current.getBoundingClientRect();
      
      setSortPortalStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: rect.left,
        minWidth: '192px', // min-w-48 equivalent
        zIndex: 9999,
      });
    }
  }, [isSortDropdownOpen]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (query: string) => {
    onSearch(query);
    setIsSearchFocused(false);
    setTempSearchQuery(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchSubmit(tempSearchQuery);
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
      inputRef.current?.blur();
    }
  };

  const clearSearch = () => {
    setTempSearchQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  const sortOptions = [
    { value: 'relevance' as const, label: 'Most Relevant', icon: MagnifyingGlass },
    { value: 'recency' as const, label: 'Most Recent', icon: Clock },
    { value: 'authority' as const, label: 'Authority Source', icon: BookOpen },
    { value: 'alphabetical' as const, label: 'Alphabetical', icon: SortAscending }
  ];

  const currentSortOption = sortOptions.find(option => option.value === sortBy) || sortOptions[0];

  return (
    <div className="space-y-3">
      {/* Compact Main Row */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          
          {/* Search Input - Takes most space */}
          <div className="flex-1 relative" ref={searchRef}>
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search guidelines, conditions, treatments..."
                value={tempSearchQuery}
                onChange={(e) => setTempSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={handleKeyDown}
                className={cn(
                  "w-full pl-12 pr-12 py-2.5 rounded-lg border border-border",
                  "focus:ring-2 focus:ring-ring focus:border-info/30 outline-none",
                  "bg-card placeholder-border text-ink",
                  "transition-all duration-200 text-sm"
                )}
              />
              {tempSearchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-ink-2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Search Suggestions Dropdown - Rendered via Portal */}
            {isSearchFocused && dropdownPortalStyle && createPortal(
              <div className="bg-card rounded-lg border border-border shadow-lg max-h-80 overflow-y-auto" style={dropdownPortalStyle}>
                {/* Search Tips - Only show when no search query */}
                {tempSearchQuery === '' && (
                  <div className="p-3 border-b border-border bg-info-soft/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-info flex items-center gap-2">
                        <BookOpen className="h-3 w-3" />
                        Search Tips
                      </p>
                      <button
                        onClick={() => setIsSearchFocused(false)}
                        className="text-muted-foreground hover:text-ink-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <ul className="text-xs text-info space-y-1">
                                                  <li>• Try conditions like &quot;depression&quot; or &quot;diabetes&quot;</li>
                            <li>• Search for procedures like &quot;screening&quot; or &quot;treatment&quot;</li>
                            <li>• Use source names like &quot;USPSTF&quot; or &quot;NICE&quot; to filter by organization</li>
                    </ul>
                  </div>
                )}

                {/* Recent Searches */}
                {tempSearchQuery === '' && recentSearches.length > 0 && (
                  <div className="p-3 border-b border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Recent Searches
                    </p>
                    {recentSearches.map((search, index) => (
                      <button
                        key={index}
                        onClick={() => handleSearchSubmit(search)}
                        className="block w-full text-left px-3 py-2 text-sm text-ink hover:bg-well/50 rounded-md"
                      >
                        {search}
                      </button>
                    ))}
                  </div>
                )}

                {/* Filtered Suggestions */}
                {filteredSuggestions.length > 0 && (
                  <div className="p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <MagnifyingGlass className="h-3 w-3" />
                      Suggestions
                    </p>
                    {filteredSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSearchSubmit(suggestion)}
                        className="block w-full text-left px-3 py-2 text-sm text-ink hover:bg-well/50 rounded-md"
                      >
                        <span className="flex items-center gap-2">
                          <BookOpen className="h-3 w-3 text-muted-foreground" />
                          {suggestion}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* No Results */}
                {tempSearchQuery && filteredSuggestions.length === 0 && (
                  <div className="p-3 text-center">
                    <p className="text-sm text-muted-foreground">No suggestions found</p>
                    <button
                      onClick={() => handleSearchSubmit(tempSearchQuery)}
                      className="mt-2 text-xs text-info hover:text-info"
                    >
                      Search for &quot;{tempSearchQuery}&quot;
                    </button>
                  </div>
                )}
              </div>,
              document.body
            )}
          </div>

          {/* Sort Dropdown - Compact */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border",
                "bg-card hover:bg-well text-sm text-ink",
                "transition-all duration-200 min-w-[120px]",
                isSortDropdownOpen && "ring-2 ring-ring border-info/30"
              )}
            >
              <currentSortOption.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{currentSortOption.label}</span>
              <span className="sm:hidden">Sort</span>
              <CaretDown className={cn(
                "h-4 w-4 transition-transform duration-200 ml-auto",
                isSortDropdownOpen && "rotate-180"
              )} />
            </button>

            {isSortDropdownOpen && sortPortalStyle && createPortal(
              <div className="bg-card rounded-lg border border-border shadow-lg" style={sortPortalStyle}>
                <div className="p-2">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onSortChange(option.value);
                        setIsSortDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm",
                        "hover:bg-well/50 transition-colors duration-150",
                        sortBy === option.value 
                          ? "bg-info-soft text-info" 
                          : "text-ink"
                      )}
                    >
                      <option.icon className="h-4 w-4" />
                      {option.label}
                      {sortBy === option.value && (
                        <div className="ml-auto w-2 h-2 bg-info rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* Bookmarks Filter - Compact */}
          <Button
            variant={showBookmarksOnly ? "default" : "outline"}
            size="sm"
            onClick={() => onBookmarksOnlyChange(!showBookmarksOnly)}
            className={cn(
              "gap-2 transition-all duration-200 px-3 py-2.5",
              showBookmarksOnly 
                ? "bg-flag hover:bg-flag text-white" 
                : "border-border bg-card hover:bg-well text-ink"
            )}
          >
            <Star className={cn(
              "h-4 w-4",
              showBookmarksOnly ? "fill-current" : ""
            )} />
            <span className="hidden sm:inline">{showBookmarksOnly ? "Bookmarked" : "All"}</span>
          </Button>
        </div>

        {/* Current Search Query Display - Compact */}
        {searchQuery && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <Badge variant="outline" className="bg-info-soft text-info border-info/30 text-xs">
              Searching: {searchQuery}
            </Badge>
            <button
              onClick={() => onSearch('')}
              className="text-xs text-muted-foreground hover:text-ink"
            >
              Clear
            </button>
          </div>
        )}
      </div>


    </div>
  );
} 