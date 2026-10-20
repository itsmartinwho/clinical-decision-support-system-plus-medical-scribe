'use client';
import React from 'react';
import { WarningCircle as AlertTriangle } from '@phosphor-icons/react';

interface ErrorDisplayProps {
  message: string | null | undefined;
  context?: string; // Optional context for more detailed error reporting
}

export default function ErrorDisplay({ message, context }: ErrorDisplayProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="p-4 my-4 bg-critical-soft border border-critical-line rounded-md text-critical flex items-start space-x-3">
      <AlertTriangle className="h-5 w-5 text-critical flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-medium">An Error Occurred</p>
        <p className="text-sm">{message}</p>
        {context && <p className="text-xs mt-1 text-critical">Context: {context}</p>}
      </div>
    </div>
  );
} 