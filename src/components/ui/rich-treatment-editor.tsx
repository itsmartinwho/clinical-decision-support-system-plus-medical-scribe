import React, { useState, useCallback } from 'react';
import { TreatmentRenderer } from '../advisor/streaming-markdown/treatment-renderer';
import { ClinicalGuidelinesIndicator, extractGuidelinesFromRichContent } from '@/components/ui/clinical-guidelines-indicator';
import { RichContent, RichElement } from '@/lib/types';

interface RichTreatmentEditorProps {
  content: RichContent;
  onSave: (updatedContent: RichContent) => void;
  isDemo?: boolean;
  label?: string;
}

export const RichTreatmentEditor: React.FC<RichTreatmentEditorProps> = ({
  content,
  onSave,
  isDemo = false,
  label = 'Treatment Plan'
}) => {
  // Defensive normalization: ensure content follows RichContent schema
  const legacyContent = content as any; // Handle legacy formats that don't match RichContent
  const normalizedContent = {
    content_type: content?.content_type || 'text/markdown',
    text_content: content?.text_content || legacyContent?.markdown || '',
    rich_elements: Array.isArray(content?.rich_elements) ? content.rich_elements : [],
    created_at: content?.created_at || new Date().toISOString(),
    version: content?.version || '1.0',
    // Legacy fallback: convert legacy tables/charts to rich_elements if needed
    ...(legacyContent?.tables && Array.isArray(legacyContent.tables) && legacyContent.tables.length > 0 ? {
      rich_elements: [
        ...Array.isArray(content?.rich_elements) ? content.rich_elements : [],
        ...legacyContent.tables.map((table: any, index: number) => ({
          id: `legacy_table_${index}`,
          type: 'table',
          position: index,
          data: table,
          editable: true
        }))
      ]
    } : {})
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(normalizedContent);

  const handleStartEdit = useCallback(() => {
    if (isDemo) return; // No editing in demo mode
    setIsEditing(true);
    setEditedContent(normalizedContent);
  }, [normalizedContent, isDemo]);

  const handleSave = useCallback(() => {
    onSave(editedContent);
    setIsEditing(false);
  }, [editedContent, onSave]);

  const handleCancel = useCallback(() => {
    setEditedContent(normalizedContent);
    setIsEditing(false);
  }, [normalizedContent]);

  const handleTextContentChange = useCallback((newTextContent: string) => {
    setEditedContent(prev => ({
      ...prev,
      text_content: newTextContent,
      updated_at: new Date().toISOString()
    }));
  }, []);

  const handleChartDelete = useCallback((chartId: string) => {
    setEditedContent(prev => ({
      ...prev,
      rich_elements: prev.rich_elements.filter(el => el.id !== chartId),
      updated_at: new Date().toISOString()
    }));
  }, []);

  const addRichElement = useCallback((element: Omit<RichElement, 'id' | 'position'>) => {
    const newElement: RichElement = {
      ...element,
      id: `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      position: editedContent.rich_elements.length
    };

    setEditedContent(prev => ({
      ...prev,
      rich_elements: [...prev.rich_elements, newElement],
      updated_at: new Date().toISOString()
    }));
  }, [editedContent.rich_elements.length]);

  if (isEditing) {
    return (
      <div className="rich-treatment-editor space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-ink">{label} (Editing)</h3>
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

        {/* Text Content Editor */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink">
            Text Content
          </label>
          <textarea
            value={editedContent.text_content}
            onChange={(e) => handleTextContentChange(e.target.value)}
            className="w-full h-64 p-3 border border-border rounded-md resize-vertical font-mono text-sm"
            placeholder="Enter treatment content in markdown format..."
          />
        </div>

        {/* Rich Elements Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-ink">
              Rich Elements ({editedContent.rich_elements.length})
            </label>
            <RichElementControls onAddElement={addRichElement} />
          </div>
          
          <div className="space-y-2">
            {editedContent.rich_elements.map((element, index) => (
              <RichElementEditor
                key={element.id}
                element={element}
                onUpdate={(updatedElement) => {
                  const updatedElements = [...editedContent.rich_elements];
                  updatedElements[index] = updatedElement;
                  setEditedContent(prev => ({
                    ...prev,
                    rich_elements: updatedElements,
                    updated_at: new Date().toISOString()
                  }));
                }}
                onDelete={() => handleChartDelete(element.id)}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink">Preview</label>
          <div className="border border-border rounded-md p-4 bg-well/50">
            <TreatmentRenderer
              content={editedContent.text_content}
              richContent={editedContent}
              editable={false}
            />
          </div>
        </div>
      </div>
    );
  }

  const guidelines = extractGuidelinesFromRichContent(normalizedContent);

  return (
    <div className="rich-treatment-editor">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
          <h3 className="text-base sm:text-lg font-medium text-ink truncate">{label}</h3>
          {guidelines.length > 0 && (
            <ClinicalGuidelinesIndicator 
              guidelines={guidelines} 
              variant="compact"
            />
          )}
        </div>
        {!isDemo && (
          <button
            onClick={handleStartEdit}
            className="px-3 py-1.5 bg-well text-ink rounded-md text-sm hover:bg-well touch-manipulation whitespace-nowrap self-start sm:self-auto"
          >
            Edit
          </button>
        )}
      </div>

      {guidelines.length > 0 && (
        <div className="mb-4">
          <ClinicalGuidelinesIndicator 
            guidelines={guidelines} 
            variant="detailed"
            maxDisplay={2}
          />
        </div>
      )}

      <div className="overflow-hidden">
        <TreatmentRenderer
          content={normalizedContent.text_content}
          richContent={normalizedContent}
          editable={!isDemo}
          onChartDelete={handleChartDelete}
          onContentEdit={handleTextContentChange}
        />
      </div>
    </div>
  );
};

// Controls for adding rich elements
const RichElementControls: React.FC<{
  onAddElement: (element: Omit<RichElement, 'id' | 'position'>) => void;
}> = ({ onAddElement }) => {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const addTable = useCallback(() => {
    onAddElement({
      type: 'table',
      data: {
        headers: ['Medication', 'Dosage', 'Frequency'],
        rows: [
          ['Example Drug', '10mg', 'Daily'],
          ['', '', '']
        ]
      },
      editable: true
    });
    setShowAddMenu(false);
  }, [onAddElement]);

  const addChart = useCallback(() => {
    onAddElement({
      type: 'chart',
      data: {
        title: 'Treatment Progress',
        type: 'line',
        data: []
      },
      editable: false
    });
    setShowAddMenu(false);
  }, [onAddElement]);

  return (
    <div className="relative">
      <button
        onClick={() => setShowAddMenu(!showAddMenu)}
        className="px-2 py-1 bg-ok-soft text-ok rounded text-xs hover:bg-ok-soft"
      >
        + Add Element
      </button>
      
      {showAddMenu && (
        <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-10">
          <button
            onClick={addTable}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-well/50"
          >
            Add Table
          </button>
          <button
            onClick={addChart}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-well/50"
          >
            Add Chart
          </button>
        </div>
      )}
    </div>
  );
};

// Editor for individual rich elements
const RichElementEditor: React.FC<{
  element: RichElement;
  onUpdate: (element: RichElement) => void;
  onDelete: () => void;
}> = ({ element, onUpdate, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateElementData = useCallback((newData: any) => {
    onUpdate({
      ...element,
      data: newData
    });
  }, [element, onUpdate]);

  return (
    <div className="border border-border rounded-md p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium capitalize">{element.type} Element</span>
        <div className="flex gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-muted-foreground hover:text-ink"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-critical hover:text-critical"
          >
            Delete
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-3">
          {element.type === 'table' && (
            <TableElementEditor 
              data={element.data}
              onUpdate={updateElementData}
            />
          )}
          {element.type === 'chart' && (
            <ChartElementEditor 
              data={element.data}
              onUpdate={updateElementData}
            />
          )}
        </div>
      )}
    </div>
  );
};

// Table element editor
const TableElementEditor: React.FC<{
  data: any;
  onUpdate: (data: any) => void;
}> = ({ data, onUpdate }) => {
  const addRow = useCallback(() => {
    const newRow = new Array(data.headers.length).fill('');
    onUpdate({
      ...data,
      rows: [...data.rows, newRow]
    });
  }, [data, onUpdate]);

  const updateCell = useCallback((rowIndex: number, cellIndex: number, value: string) => {
    const newRows = [...data.rows];
    newRows[rowIndex][cellIndex] = value;
    onUpdate({
      ...data,
      rows: newRows
    });
  }, [data, onUpdate]);

  return (
    <div className="space-y-2">
      <div className="text-xs text-ink-2">Table Editor</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              {data.headers.map((header: string, index: number) => (
                <th key={index} className="border border-border px-2 py-1 bg-well/50">
                  <input
                    value={header}
                    onChange={(e) => {
                      const newHeaders = [...data.headers];
                      newHeaders[index] = e.target.value;
                      onUpdate({ ...data, headers: newHeaders });
                    }}
                    className="w-full bg-transparent text-center"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row: string[], rowIndex: number) => (
              <tr key={rowIndex}>
                {row.map((cell: string, cellIndex: number) => (
                  <td key={cellIndex} className="border border-border px-2 py-1">
                    <input
                      value={cell}
                      onChange={(e) => updateCell(rowIndex, cellIndex, e.target.value)}
                      className="w-full bg-transparent"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRow}
        className="px-2 py-1 bg-info-soft text-info rounded text-xs hover:bg-info-soft"
      >
        Add Row
      </button>
    </div>
  );
};

// Chart element editor
const ChartElementEditor: React.FC<{
  data: any;
  onUpdate: (data: any) => void;
}> = ({ data, onUpdate }) => {
  return (
    <div className="space-y-2">
      <div className="text-xs text-ink-2">Chart Configuration</div>
      <div className="space-y-2">
        <input
          value={data.title || ''}
          onChange={(e) => onUpdate({ ...data, title: e.target.value })}
          placeholder="Chart title"
          className="w-full p-2 border border-border rounded text-sm"
        />
        <div className="text-xs text-muted-foreground">
          Chart data and visualization settings would be configured here.
        </div>
      </div>
    </div>
  );
};

export default RichTreatmentEditor; 