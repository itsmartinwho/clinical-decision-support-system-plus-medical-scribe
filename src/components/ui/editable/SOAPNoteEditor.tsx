'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RichTextEditor, RichTextEditorRef } from '@/components/ui/rich-text-editor';
import EditableSection, { 
  createFieldHistory, 
  updateFieldHistory, 
  undoFieldHistory, 
  redoFieldHistory 
} from './EditableSection';

interface SOAPSection {
  id: 'subjective' | 'objective' | 'assessment' | 'plan';
  title: string;
  content: string;
}

interface SOAPNoteEditorProps {
  soapNote: string;
  onSave: (newSoapNote: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export default function SOAPNoteEditor({
  soapNote,
  onSave,
  disabled = false,
  className = '',
}: SOAPNoteEditorProps) {
  // Parse SOAP note into sections
  const parseSoapNote = (soapText: string): SOAPSection[] => {
    const defaultSections: SOAPSection[] = [
      { id: 'subjective', title: 'Subjective', content: '' },
      { id: 'objective', title: 'Objective', content: '' },
      { id: 'assessment', title: 'Assessment', content: '' },
      { id: 'plan', title: 'Plan', content: '' },
    ];

    if (!soapText) return defaultSections;

    // Headings spelled out ("SUBJECTIVE:", "Objective:"), each at the start of a line
    const heading = (name: string) =>
      soapText.match(new RegExp(`(?:^|\\n)\\s*${name}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN)\\s*:|$)`, 'i'))?.[1]?.trim();
    const full = ['SUBJECTIVE', 'OBJECTIVE', 'ASSESSMENT', 'PLAN'].map(heading);
    if (full.some(Boolean)) {
      return [
        { id: 'subjective', title: 'Subjective', content: full[0] || '' },
        { id: 'objective', title: 'Objective', content: full[1] || '' },
        { id: 'assessment', title: 'Assessment', content: full[2] || '' },
        { id: 'plan', title: 'Plan', content: full[3] || '' },
      ];
    }

    // Try to parse structured SOAP note (S: ...\nO: ...\nA: ...\nP: ...)
    const sMatch = soapText.match(/S:\s*([\s\S]*?)(?=\n[OAP]:|\n$|$)/);
    const oMatch = soapText.match(/O:\s*([\s\S]*?)(?=\n[SAP]:|\n$|$)/);
    const aMatch = soapText.match(/A:\s*([\s\S]*?)(?=\n[SOP]:|\n$|$)/);
    const pMatch = soapText.match(/P:\s*([\s\S]*?)(?=\n[SOA]:|\n$|$)/);

    if (sMatch || oMatch || aMatch || pMatch) {
      // Structured format found
      return [
        { id: 'subjective', title: 'Subjective', content: sMatch?.[1]?.trim() || '' },
        { id: 'objective', title: 'Objective', content: oMatch?.[1]?.trim() || '' },
        { id: 'assessment', title: 'Assessment', content: aMatch?.[1]?.trim() || '' },
        { id: 'plan', title: 'Plan', content: pMatch?.[1]?.trim() || '' },
      ];
    }

    // Fallback: put entire content in subjective section
    return [
      { id: 'subjective', title: 'Subjective', content: soapText },
      { id: 'objective', title: 'Objective', content: '' },
      { id: 'assessment', title: 'Assessment', content: '' },
      { id: 'plan', title: 'Plan', content: '' },
    ];
  };

  // Reconstruct SOAP note from sections
  const reconstructSoapNote = (sections: SOAPSection[]): string => {
    return sections
      .map(section => {
        const content = section.content.trim();
        if (!content) return '';
        return `${section.id.charAt(0).toUpperCase()}: ${content}`;
      })
      .filter(Boolean)
      .join('\n');
  };

  const [sections, setSections] = useState(() => parseSoapNote(soapNote));
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionHistories, setSectionHistories] = useState(() => {
    const histories: Record<string, any> = {};
    sections.forEach(section => {
      histories[section.id] = createFieldHistory(section.content);
    });
    return histories;
  });
  const [isSaving, setIsSaving] = useState(false);

  // Update sections when soapNote prop changes
  useEffect(() => {
    if (!editingSection) {
      const newSections = parseSoapNote(soapNote);
      setSections(newSections);
      
      const newHistories: Record<string, any> = {};
      newSections.forEach(section => {
        newHistories[section.id] = createFieldHistory(section.content);
      });
      setSectionHistories(newHistories);
    }
  }, [soapNote, editingSection]);

  const handleEdit = (sectionId: string) => {
    if (disabled) return;
    setEditingSection(sectionId);
  };

  const handleSave = async (sectionId: string) => {
    const currentContent = sectionHistories[sectionId].present;
    
    setIsSaving(true);
    
    try {
      // Update the section content
      const updatedSections = sections.map(section =>
        section.id === sectionId ? { ...section, content: currentContent } : section
      );
      
      // Reconstruct full SOAP note
      const newSoapNote = reconstructSoapNote(updatedSections);
      
      await onSave(newSoapNote);
      
      setSections(updatedSections);
      setEditingSection(null);
    } catch (error) {
      console.error('Failed to save SOAP section:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (section) {
      setSectionHistories(prev => ({
        ...prev,
        [sectionId]: createFieldHistory(section.content)
      }));
    }
    setEditingSection(null);
  };

  const handleContentChange = (sectionId: string, newContent: string) => {
    setSectionHistories(prev => ({
      ...prev,
      [sectionId]: updateFieldHistory(prev[sectionId], newContent)
    }));
  };

  const handleUndo = (sectionId: string) => {
    setSectionHistories(prev => ({
      ...prev,
      [sectionId]: undoFieldHistory(prev[sectionId])
    }));
  };

  const handleRedo = (sectionId: string) => {
    setSectionHistories(prev => ({
      ...prev,
      [sectionId]: redoFieldHistory(prev[sectionId])
    }));
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {sections.map((section) => {
        const isEditing = editingSection === section.id;
        const history = sectionHistories[section.id];
        
        return (
          <Card key={section.id} className="border-l-[3px] border-l-iris/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-foreground">{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <EditableSection
                isEditing={isEditing}
                onEdit={() => handleEdit(section.id)}
                onSave={() => handleSave(section.id)}
                onCancel={() => handleCancel(section.id)}
                onUndo={() => handleUndo(section.id)}
                onRedo={() => handleRedo(section.id)}
                canUndo={history?.past?.length > 0}
                canRedo={history?.future?.length > 0}
                isSaving={isSaving}
                disabled={disabled}
                showEditButton={!isEditing}
              >
                {isEditing ? (
                  <RichTextEditor
                    content={history.present}
                    onContentChange={(content) => handleContentChange(section.id, content)}
                    placeholder={`Enter ${section.title.toLowerCase()} information...`}
                    minHeight="150px"
                    showToolbar={true}
                  />
                ) : (
                  <div className="min-h-[60px]">
                    {section.content ? (
                      <div 
                        className="text-sm max-w-none text-foreground whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: section.content }}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground/70">
                        No {section.title.toLowerCase()} information recorded
                      </p>
                    )}
                  </div>
                )}
              </EditableSection>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
} 