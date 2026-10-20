'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils'; // Assuming cn utility exists for classnames

// Define the props for the FrostCard component
interface FrostCardProps extends React.ComponentProps<typeof motion.div> {
  children: React.ReactNode;
  className?: string;
}

export function FrostCard({ children, className, ...props }: FrostCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={cn(
        "bg-glass rounded-card p-[clamp(1rem,2vw,2rem)]",
        "frost-frame shadow-card dark:shadow-card-dark",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Export as default as per original brief sample structure if preferred,
// or keep named export for more explicit imports.
// For now, adding a default export to match the sample more closely.
export default FrostCard; 