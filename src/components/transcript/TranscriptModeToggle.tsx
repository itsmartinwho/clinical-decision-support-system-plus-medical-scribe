'use client';
import * as React from 'react';
import { ChatsCircle, PencilSimpleLine } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

// Read the transcript as a conversation, or edit it as text: two icons.
export default function TranscriptModeToggle({ mode, onChange }: { mode: 'conversation' | 'edit'; onChange: (m: 'conversation' | 'edit') => void }) {
  const item = (m: 'conversation' | 'edit', label: string, Icon: typeof ChatsCircle) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={mode === m}
      onClick={() => onChange(m)}
      className={cn(
        'inline-flex h-7 w-8 items-center justify-center rounded-md transition-[background-color,color,box-shadow]',
        mode === m ? 'bg-card text-iris shadow-card' : 'text-muted-foreground hover:text-ink',
      )}
    >
      <Icon size={16} weight={mode === m ? 'fill' : 'regular'} aria-hidden />
    </button>
  );
  return (
    <div role="group" className="inline-flex items-center gap-0.5 rounded-lg border border-hairline bg-well p-0.5">
      {item('conversation', 'Conversation', ChatsCircle)}
      {item('edit', 'Edit', PencilSimpleLine)}
    </div>
  );
}
