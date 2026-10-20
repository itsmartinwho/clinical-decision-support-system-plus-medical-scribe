'use client';
import React from 'react';

export default function LikelihoodBadge({ likelihood }: { likelihood?: number }) {
  const level = likelihood !== undefined ? likelihood : 0;
  const color =
    level >= 4 ? "bg-critical text-white" :
    level >= 3 ? "bg-flag text-white" :
    level >= 2 ? "bg-flag-soft text-flag" :
    level >= 1 ? "bg-ok-soft text-ok" :
    "bg-well text-ink-2";
  return (
    <span className={`${color} text-xs px-2 py-0.5 rounded-full`}>
      {level}
    </span>
  );
} 