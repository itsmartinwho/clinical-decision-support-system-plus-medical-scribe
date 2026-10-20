'use client';
import React from 'react';

export default function SeverityBadge({ severity }: { severity: string }) {
  const color =
    severity === "High"
      ? "bg-critical"
      : severity === "Medium"
      ? "bg-flag"
      : "bg-ink";
  return (
    <span className={`${color} text-white text-xs px-2 py-0.5 rounded-full`}>
      {severity}
    </span>
  );
} 