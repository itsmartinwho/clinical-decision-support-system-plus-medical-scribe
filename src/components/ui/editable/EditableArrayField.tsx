import React, { useState } from 'react';
import { Button } from '../button';
import { Input } from '../input';
import { Card, CardContent, CardHeader, CardTitle } from '../card';
import { PencilSimple as Edit, FloppyDisk as Save, X, Plus, Trash as Trash2, List } from '@phosphor-icons/react';

interface EditableArrayFieldProps {
  label: string;
  value: string[] | null;
  onSave: (value: string[] | null) => Promise<void>;
  placeholder?: string;
  itemPlaceholder?: string;
  readOnly?: boolean;
  maxItems?: number;
}

export function EditableArrayField({
  label,
  value,
  onSave,
  placeholder = "No items",
  itemPlaceholder = "Enter item...",
  readOnly = false,
  maxItems = 20
}: EditableArrayFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const displayValue = value || [];
  const isEmpty = displayValue.length === 0;

  const handleEdit = () => {
    setItems([...displayValue]);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      // Filter out empty items and trim whitespace
      const cleanedItems = items
        .map(item => item.trim())
        .filter(item => item.length > 0);
      
      const valueToSave = cleanedItems.length > 0 ? cleanedItems : null;
      await onSave(valueToSave);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save array field:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setItems([]);
  };

  const handleItemChange = (index: number, newValue: string) => {
    const newItems = [...items];
    newItems[index] = newValue;
    setItems(newItems);
  };

  const handleAddItem = () => {
    if (items.length < maxItems) {
      setItems([...items, '']);
    }
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const canAddMore = items.length < maxItems;

  if (!isEditing) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <List className="w-4 h-4" />
              {label}
              {!isEmpty && (
                <span className="text-xs bg-muted px-2 py-1 rounded">
                  {displayValue.length} item{displayValue.length !== 1 ? 's' : ''}
                </span>
              )}
            </CardTitle>
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="h-8 w-8 p-0"
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isEmpty ? (
            <div className="text-sm text-muted-foreground italic">
              {placeholder}
            </div>
          ) : (
            <div className="space-y-2">
              {displayValue.map((item, index) => (
                <div 
                  key={index}
                  className="text-sm bg-muted p-2 rounded border-l-2 border-primary"
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <List className="w-4 h-4" />
            {label}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <Save className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={item}
                  onChange={(e) => handleItemChange(index, e.target.value)}
                  placeholder={itemPlaceholder}
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveItem(index)}
                  disabled={isLoading}
                  className="h-10 w-10 p-0 text-critical hover:text-critical"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          
          {canAddMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              disabled={isLoading}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          )}
          
          {!canAddMore && (
            <div className="text-xs text-muted-foreground text-center">
              Maximum of {maxItems} items allowed
            </div>
          )}
          
          <div className="text-xs text-muted-foreground">
            Empty items will be automatically removed when saved.
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 