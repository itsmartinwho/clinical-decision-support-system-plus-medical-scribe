import React, { useState } from 'react';
import { DecisionTreeRenderer } from '../../ui/decision-tree-renderer';
import { RichContent, RichElement } from '@/lib/types';

interface TreatmentRendererProps {
  content: string | any; // Allow string or fallback to any for backwards compatibility
  richContent?: RichContent;
  isStreaming?: boolean;
  onChartDelete?: (chartId: string) => void;
  onContentEdit?: (newContent: string) => void;
  editable?: boolean;
}

export const TreatmentRenderer: React.FC<TreatmentRendererProps> = ({
  content,
  richContent,
  isStreaming = false,
  onChartDelete,
  onContentEdit,
  editable = true
}) => {
  // Defensive programming: ensure content is always a string
  const safeContent = typeof content === 'string' ? content : '';
  
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(safeContent);

  const handleEdit = () => {
    if (!editable) return;
    setIsEditing(true);
    setEditContent(richContent?.text_content || safeContent);
  };

  const handleSave = () => {
    if (onContentEdit) {
      onContentEdit(editContent);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(richContent?.text_content || safeContent);
    setIsEditing(false);
  };

  // Simple markdown-to-HTML converter
  const renderMarkdown = (text: string) => {
    // Ensure text is a string and handle edge cases
    if (!text || typeof text !== 'string') {
      return { __html: '<p class="text-muted-foreground">No content available</p>' };
    }
    
    // First, normalize line endings and clean up excessive whitespace
    let html = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    html = html
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-8 mb-4">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      // Process lists first
      .replace(/^- (.*$)/gim, '::LIST_ITEM::$1')
      
    // Handle paragraphs and line breaks
    html = html
      .split('\n\n')
      .map(paragraph => {
        paragraph = paragraph.trim();
        if (!paragraph) return '';
        
        // Check if this paragraph contains list items
        if (paragraph.includes('::LIST_ITEM::')) {
          const items = paragraph
            .split('\n')
            .filter(line => line.includes('::LIST_ITEM::'))
            .map(line => `<li class="mb-1">${line.replace('::LIST_ITEM::', '• ')}</li>`)
            .join('');
          return `<ul class="mb-4 ml-4">${items}</ul>`;
        }
        
        // Regular paragraph
        return `<p class="mb-4">${paragraph.replace(/\n/g, '<br/>')}</p>`;
      })
      .filter(p => p.length > 0)
      .join('');

    return { __html: html };
  };

  const renderRichElements = () => {
    if (!richContent?.rich_elements?.length) {
      console.log('TreatmentRenderer: No rich elements found');
      return null;
    }

    console.log('TreatmentRenderer: Rendering rich elements:', richContent.rich_elements);

    return (
      <div className="mt-4 space-y-4">
        {richContent.rich_elements.map((element) => (
          <RichElementRenderer
            key={element.id}
            element={element}
            onDelete={onChartDelete}
            editable={editable}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="treatment-renderer">
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-64 p-3 border border-border rounded-md resize-vertical font-mono text-sm"
            placeholder="Edit treatment content..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-info text-white rounded-md text-sm hover:bg-info"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 bg-hairline text-ink rounded-md text-sm hover:bg-hairline"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="relative group">
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={renderMarkdown(richContent?.text_content || safeContent)}
          />
          {editable && (
            <button
              onClick={handleEdit}
              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-well rounded text-xs text-ink-2 hover:bg-well"
            >
              Edit
            </button>
          )}
        </div>
      )}

      {/* Render rich elements (decision trees, charts, etc.) */}
      {renderRichElements()}
    </div>
  );
};

// Component to render individual rich elements
const RichElementRenderer: React.FC<{
  element: RichElement;
  onDelete?: (id: string) => void;
  editable?: boolean;
}> = ({ element, onDelete, editable = true }) => {
  console.log('RichElementRenderer: Rendering element:', element.type, element);

  const handleDelete = () => {
    if (onDelete) {
      onDelete(element.id);
    }
  };

  const renderElement = () => {
    switch (element.type) {
      case 'decision_tree':
        console.log('RichElementRenderer: Rendering decision tree with data:', element.data);
        return (
          <DecisionTreeRenderer 
            tree={element.data}
            editable={element.editable !== false}
          />
        );
      
      case 'chart':
        return (
          <div className="bg-well/50 p-4 rounded-md">
            <div className="text-sm text-ink-2 mb-2">Chart: {element.data.title || 'Untitled'}</div>
            {/* Chart rendering would go here - could be Chart.js, D3, etc. */}
            <div className="h-64 bg-card border-2 border-dashed border-border rounded flex items-center justify-center">
              Chart Placeholder
            </div>
          </div>
        );
      
      case 'table':
        return (
          <div className="overflow-x-auto">
            <div className="text-sm font-medium text-ink mb-2">
              {element.data.title || 'Table'}
            </div>
            <table className="min-w-full border border-border">
              <thead className="bg-well/50">
                <tr>
                  {element.data.headers?.map((header: string, index: number) => (
                    <th key={index} className="px-4 py-2 border-b border-border text-left font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {element.data.rows?.map((row: string[], rowIndex: number) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-card' : 'bg-well/50'}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-2 border-b border-border">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      
      default:
        return (
          <div className="bg-flag-soft p-4 rounded-md border border-flag-line">
            <div className="text-flag">Unknown element type: {element.type}</div>
          </div>
        );
    }
  };

  return (
    <div className="relative group">
      {renderElement()}
      
      {/* Delete button for non-editable elements (like charts) */}
      {editable && !element.editable && (
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-critical-soft hover:bg-critical-soft text-critical p-1 rounded text-xs"
          title="Delete this element"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default TreatmentRenderer; 