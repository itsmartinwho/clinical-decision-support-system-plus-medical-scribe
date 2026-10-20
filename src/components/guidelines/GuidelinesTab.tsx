'use client';

import React from 'react';
import { useGuidelines } from '@/hooks/useGuidelines';
import { useBookmarks } from '@/hooks/useBookmarks';
import SpecialtyFilter from './SpecialtyFilter';
import SourceFilter from './SourceFilter';
import GuidelineSearch from './GuidelineSearch';
import GuidelineCard from './GuidelineCard';
import GuidelineModal from './GuidelineModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GridFour, List, SquaresFour } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export default function GuidelinesTab() {
  const {
    guidelines,
    specialtyCategories,
    sourceThemes,
    availableSources,
    guidelineCountsBySource,
    uiState,
    isLoading,
    error,
    searchGuidelines,
    filterGuidelines,
    setCurrentView,
    openGuidelineModal,
    closeGuidelineModal,
    getSourceTheme
  } = useGuidelines({ 
    autoLoad: true,
    initialFilter: {
      // Load saved sources from localStorage
      sources: (() => {
        if (typeof window !== 'undefined') {
          try {
            const saved = localStorage.getItem('foresight-selected-sources');
            return saved ? JSON.parse(saved) : [];
          } catch {
            return [];
          }
        }
        return [];
      })()
    }
  });

  const {
    isBookmarked,
    toggleBookmark,
    addRecentView
  } = useBookmarks();

  const handleGuidelineClick = async (guidelineId: number) => {
    await openGuidelineModal(guidelineId);
    await addRecentView(guidelineId);
  };

  const handleBookmarkToggle = async (guidelineId: number) => {
    await toggleBookmark(guidelineId);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-critical mb-2">Error Loading Guidelines</h3>
          <p className="text-ink-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps mb-1.5">Library</p>
          <h1 className="title-display text-[1.875rem] sm:text-[2.25rem]">Clinical guidelines</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Recommendations from USPSTF, NICE, NCI PDQ and RxNorm, searchable by specialty.
          </p>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-card rounded-lg p-1 border border-border">
          <Button
            variant={uiState.currentView === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('grid')}
            className="h-8 w-8 p-0"
          >
            <GridFour className="h-4 w-4" />
          </Button>
          <Button
            variant={uiState.currentView === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('list')}
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={uiState.currentView === 'comparison' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('comparison')}
            className="h-8 w-8 p-0"
          >
            <SquaresFour className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Top Row - Source and Search/Sort */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 mb-6">
        <div className="flex-1">
          <SourceFilter
            selectedSources={uiState.filter.sources}
            onSourcesChange={(sources) => {
              // Save to localStorage
              localStorage.setItem('foresight-selected-sources', JSON.stringify(sources));
              filterGuidelines({ sources });
            }}
            availableSources={availableSources}
            guidelineCounts={guidelineCountsBySource}
          />
        </div>
        
        <div className="flex-1">
          <GuidelineSearch
            searchQuery={uiState.filter.searchQuery}
            onSearch={searchGuidelines}
            sortBy={uiState.filter.sortBy}
            onSortChange={(sortBy) => filterGuidelines({ sortBy })}
            showBookmarksOnly={uiState.filter.showBookmarksOnly}
            onBookmarksOnlyChange={(showBookmarksOnly) => filterGuidelines({ showBookmarksOnly })}
          />
        </div>
      </div>

      {/* Main Content Area - Sidebar + Guidelines */}
      <div className="flex gap-6">
        {/* Left Sidebar - Medical Specialties */}
        <div className="w-80 flex-shrink-0">
          <div className="sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <SpecialtyFilter
              categories={specialtyCategories}
              selectedSpecialties={uiState.filter.specialties}
              onSpecialtyChange={(specialties) => filterGuidelines({ specialties })}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Right Side - Guidelines Grid/List */}
        <div className="flex-1 min-w-0">
          <div className="min-h-[400px] max-h-[calc(100vh-12rem)] overflow-y-auto pr-2" 
               style={{
                 scrollbarWidth: 'thin',
                 scrollbarColor: '#d1d5db transparent'
               }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-info/30"></div>
          </div>
        ) : guidelines.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center max-w-md">
              <h3 className="text-lg font-semibold text-ink-2 mb-2">No Guidelines Found</h3>
              <p className="text-muted-foreground mb-4">
                {uiState.filter.searchQuery ? 
                  `No guidelines match your search for "${uiState.filter.searchQuery}"` :
                  'No guidelines available with current filters'
                }
              </p>
              {!uiState.filter.searchQuery && uiState.filter.sources.length === 0 && uiState.filter.specialties.length === 0 && (
                <div className="bg-flag-soft border border-flag-line rounded-lg p-4 text-sm text-flag">
                  <p className="mb-2">📚 <strong>No clinical guidelines loaded yet</strong></p>
                  <p>Clinical guidelines need to be ingested into the database first. Contact your system administrator to load guidelines from sources like USPSTF, NICE, NCI PDQ, or RxNorm.</p>
                </div>
              )}
              {(uiState.filter.sources.length > 0 || uiState.filter.specialties.length > 0) && (
                <p className="text-sm text-muted-foreground">
                  Try clearing some filters or search for specific topics
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className={cn(
            "transition-all duration-300 pb-6",
            uiState.currentView === 'grid' && "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
            uiState.currentView === 'list' && "space-y-4",
            uiState.currentView === 'comparison' && "space-y-6"
          )}>
            {uiState.currentView === 'comparison' && (
              <div className="space-y-6">
                {/* Comparison View Header */}
                <div className="flex items-center justify-between bg-info-soft border border-info/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <SquaresFour className="h-5 w-5 text-info" />
                    <div>
                      <h3 className="font-semibold text-ink">Source Comparison Panels</h3>
                      <p className="text-sm text-ink-2">
                        Guidelines organized by source for side-by-side comparison
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-card text-ink">
                    {guidelines.length} guidelines
                  </Badge>
                </div>

                {/* Source-based Comparison Panels */}
                {(() => {
                  const groupedGuidelines = guidelines.reduce((acc, guideline) => {
                    const source = guideline.source;
                    if (!acc[source]) acc[source] = [];
                    acc[source].push(guideline);
                    return acc;
                  }, {} as Record<string, typeof guidelines>);

                  const getSourceDisplayName = (source: string) => {
                    switch (source) {
                      case 'USPSTF': return 'US Preventive Services Task Force';
                      case 'NICE': return 'National Institute for Health and Care Excellence';
                      case 'NCI_PDQ': return 'National Cancer Institute PDQ';
                      case 'RxNorm': return 'RxNorm Drug Database';
                      default: return source;
                    }
                  };

                  const getSourceIcon = (source: string) => {
                    switch (source) {
                      case 'USPSTF': return '🇺🇸';
                      case 'NICE': return '🇬🇧';
                      case 'NCI_PDQ': return '🎗️';
                      case 'RxNorm': return '💊';
                      default: return '📋';
                    }
                  };

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                      {Object.entries(groupedGuidelines).map(([source, sourceGuidelines]) => (
                        <div key={source} className="space-y-4">
                          {/* Source Panel Header */}
                          <div className={cn(
                            "flex items-center justify-between p-4 rounded-lg border-2 shadow-sm ",
                            source === 'USPSTF' && "bg-info-soft/80 border-info/30",
                            source === 'NICE' && "bg-info-soft/80 border-info/30",
                            source === 'NCI_PDQ' && "bg-ok-soft/80 border-ok-line",
                            source === 'RxNorm' && "bg-flag-soft/80 border-flag-line"
                          )}>
                            <div className="flex items-center space-x-3">
                              <span className="text-2xl">{getSourceIcon(source)}</span>
                              <div>
                                <h4 className={cn(
                                  "font-semibold text-lg",
                                  source === 'USPSTF' && "text-info",
                                  source === 'NICE' && "text-info",
                                  source === 'NCI_PDQ' && "text-ok",
                                  source === 'RxNorm' && "text-flag"
                                )}>
                                  {source}
                                </h4>
                                <p className="text-xs text-ink-2 max-w-[180px] truncate">
                                  {getSourceDisplayName(source)}
                                </p>
                              </div>
                            </div>
                            <Badge className={cn(
                              "font-medium text-xs",
                              source === 'USPSTF' && "bg-info-soft text-info border-info/30",
                              source === 'NICE' && "bg-info-soft text-info border-info/30",
                              source === 'NCI_PDQ' && "bg-ok-soft text-ok border-ok-line",
                              source === 'RxNorm' && "bg-flag-soft text-flag border-flag-line"
                            )}>
                              {sourceGuidelines.length} guidelines
                            </Badge>
                          </div>

                          {/* Guidelines for this source */}
                          <div className="space-y-3 max-h-[600px] overflow-y-auto">
                            {sourceGuidelines.map((guideline) => (
                              <GuidelineCard
                                key={guideline.id}
                                guideline={guideline}
                                sourceTheme={getSourceTheme(guideline.source)}
                                isBookmarked={isBookmarked(guideline.id)}
                                viewMode="list"
                                onClick={() => handleGuidelineClick(guideline.id)}
                                onBookmarkToggle={() => handleBookmarkToggle(guideline.id)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {uiState.currentView !== 'comparison' && (
              <>
                {guidelines.map((guideline) => (
                  <GuidelineCard
                    key={guideline.id}
                    guideline={guideline}
                    sourceTheme={getSourceTheme(guideline.source)}
                    isBookmarked={isBookmarked(guideline.id)}
                    viewMode={uiState.currentView}
                    onClick={() => handleGuidelineClick(guideline.id)}
                    onBookmarkToggle={() => handleBookmarkToggle(guideline.id)}
                  />
                ))}
              </>
            )}
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {uiState.activeModal && (
        <GuidelineModal
          modalData={uiState.activeModal}
          isOpen={!!uiState.activeModal}
          onClose={closeGuidelineModal}
          sourceTheme={getSourceTheme(uiState.activeModal.source)}
          isBookmarked={isBookmarked(uiState.activeModal.id)}
          onBookmarkToggle={() => handleBookmarkToggle(uiState.activeModal!.id)}
        />
      )}
    </div>
  );
} 