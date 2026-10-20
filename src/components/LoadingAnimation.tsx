import React from 'react';
import { LoadingState } from '@/components/ui/states';

interface LoadingAnimationProps {
  customText?: string;
}

// Kept under its old name: many views import it.
const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ customText }) => (
  <LoadingState label={customText ?? 'Loading'} />
);

export default LoadingAnimation;
