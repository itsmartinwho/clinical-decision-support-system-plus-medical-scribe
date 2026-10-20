'use client';

import React, { useState } from 'react';
import { X, Star, CaretDown, CaretRight, Medal, Shield, Dna, Pill } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GuidelineModalData, SourceTheme } from '@/types/guidelines';
import { cn } from '@/lib/utils';
import { DraggableModalWrapper } from '@/components/ui/draggable-modal-wrapper';
import { ModalDragAndMinimizeConfig } from '@/types/modal';

interface GuidelineModalProps {
  modalData: GuidelineModalData;
  isOpen: boolean;
  onClose: () => void;
  sourceTheme?: SourceTheme;
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
  draggable?: boolean;
  draggableConfig?: ModalDragAndMinimizeConfig;
}

const sourceConfig = {
  USPSTF: {
    name: 'USPSTF',
    color: '#2563EB',
    icon: Medal,
    description: 'US Preventive Services Task Force'
  },
  NICE: {
    name: 'NICE', 
    color: '#7C3AED',
    icon: Shield,
    description: 'National Institute for Health and Care Excellence'
  },
  NCI_PDQ: {
    name: 'NCI',
    color: '#059669',
    icon: Dna,
    description: 'National Cancer Institute'
  },
  RxNorm: {
    name: 'RxNorm',
    color: '#EA580C',
    icon: Pill,
    description: 'RxNorm Drug Database'
  }
};

interface GuidelineModalContentProps {
  modalData: GuidelineModalData;
  config: typeof sourceConfig[keyof typeof sourceConfig];
  expandedSections: Set<string>;
  expandAll: boolean;
  toggleSection: (sectionId: string) => void;
  toggleExpandAll: () => void;
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
  onClose: () => void;
  hideCloseButton?: boolean;
}

function GuidelineModalContent({
  modalData,
  config,
  expandedSections,
  expandAll,
  toggleSection,
  toggleExpandAll,
  isBookmarked,
  onBookmarkToggle,
  onClose,
  hideCloseButton = false
}: GuidelineModalContentProps) {
  const IconComponent = config.icon;

  return (
    <>
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${config.color}20`, color: config.color }}
            >
              <IconComponent className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-ink mb-2">{modalData.title}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  style={{ backgroundColor: config.color, color: 'white' }}
                  className="text-xs"
                >
                  {config.name}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {modalData.specialty}
                </Badge>
                {modalData.metadata.grade && (
                  <Badge variant="outline" className="text-xs">
                    Grade {modalData.metadata.grade}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View Original Source Button */}
            {modalData.metadata?.url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(modalData.metadata?.url as string, '_blank')}
                className="text-xs px-3 py-1"
              >
                View Original Source
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onBookmarkToggle}
              className="h-9 w-9 p-0"
            >
              <Star 
                className={cn(
                  "h-4 w-4",
                  isBookmarked ? "fill-flag-line text-flag" : "text-muted-foreground"
                )}
              />
            </Button>
            {!hideCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-9 w-9 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Breadcrumbs */}
        {modalData.breadcrumbs && modalData.breadcrumbs.length > 0 && (
          <nav className="text-sm text-muted-foreground mb-4">
            {modalData.breadcrumbs.map((crumb, index) => (
              <span key={index}>
                {crumb}
                {index < modalData.breadcrumbs.length - 1 && (
                  <span className="mx-2">›</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Metadata */}
        <div className="text-sm text-ink-2 space-y-1">
          {modalData.metadata.publication_date && (
            <p>Published: {new Date(modalData.metadata.publication_date).toLocaleDateString()}</p>
          )}
          {modalData.metadata.last_reviewed && (
            <p>Last Reviewed: {new Date(modalData.metadata.last_reviewed).toLocaleDateString()}</p>
          )}
          {modalData.metadata.organization && (
            <p>Organization: {modalData.metadata.organization}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Section Controls */}
          {modalData.sections && modalData.sections.length > 0 && (
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-ink">Guideline Sections</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleExpandAll}
                className="text-xs"
              >
                {expandAll ? 'Collapse All' : 'Expand All'}
              </Button>
            </div>
          )}

          {/* Sections */}
          {modalData.sections && modalData.sections.length > 0 ? (
            <div className="space-y-4">
              {modalData.sections.map((section) => {
                const isExpanded = expandedSections.has(section.id);
                return (
                  <div key={section.id} className="border border-border rounded-lg">
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-well/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <CaretDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <CaretRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <h4 className="font-semibold text-ink">{section.title}</h4>
                      </div>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {section.type.replace('_', ' ')}
                      </Badge>
                    </button>
                    
                    {isExpanded && (
                      <div className="px-4 pb-4">
                        <div className="pl-7 prose prose-sm max-w-none">
                          <div
                            className="text-ink leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: section.content }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Full Content Fallback */
            <div className="prose prose-sm max-w-none">
              <div
                className="text-ink leading-relaxed"
                dangerouslySetInnerHTML={{ __html: modalData.fullContent }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function GuidelineModal({
  modalData,
  isOpen,
  onClose,
  sourceTheme,
  isBookmarked,
  onBookmarkToggle,
  draggable = false,
  draggableConfig
}: GuidelineModalProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  if (!isOpen) return null;

  const config = sourceConfig[modalData.source];
  const IconComponent = config.icon;

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const toggleExpandAll = () => {
    if (expandAll) {
      setExpandedSections(new Set());
    } else {
      setExpandedSections(new Set(modalData.sections.map(s => s.id)));
    }
    setExpandAll(!expandAll);
  };

  // Create default draggable config if needed
  const defaultDraggableConfig: ModalDragAndMinimizeConfig = {
    id: `guideline-modal-${modalData.id || Date.now()}`,
    title: modalData.title,
    icon: IconComponent,
    persistent: true,
  };

  const finalDraggableConfig = draggableConfig || defaultDraggableConfig;

  if (draggable) {
    return (
      // No overlay needed - handled by ModalManager
      <DraggableModalWrapper
        config={finalDraggableConfig}
        onClose={onClose}
        className="max-w-5xl w-full bg-card"
        showMinimizeButton={true}
        showCloseButton={true}
      >
        <GuidelineModalContent 
          modalData={modalData}
          config={config}
          expandedSections={expandedSections}
          expandAll={expandAll}
          toggleSection={toggleSection}
          toggleExpandAll={toggleExpandAll}
          isBookmarked={isBookmarked}
          onBookmarkToggle={onBookmarkToggle}
          onClose={onClose}
          hideCloseButton={true}
        />
      </DraggableModalWrapper>
    );
  }

  return (
    <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4">
      <div className="modal-glass rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-lg">
        <GuidelineModalContent 
          modalData={modalData}
          config={config}
          expandedSections={expandedSections}
          expandAll={expandAll}
          toggleSection={toggleSection}
          toggleExpandAll={toggleExpandAll}
          isBookmarked={isBookmarked}
          onBookmarkToggle={onBookmarkToggle}
          onClose={onClose}
        />
      </div>
    </div>
  );
} 