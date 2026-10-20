'use client';

import React from 'react';
import { CircleNotch, Brain, Stethoscope } from '@phosphor-icons/react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DiagnosisLoadingStateProps {
  stage?: 'analyzing' | 'differential' | 'finalizing';
  className?: string;
}

export default function DiagnosisLoadingState({
  stage = 'analyzing',
  className = '',
}: DiagnosisLoadingStateProps) {
  const getStageInfo = (stage: string) => {
    switch (stage) {
      case 'differential':
        return {
          icon: Stethoscope,
          title: 'Generating Differential Diagnoses',
          description: 'Analyzing patient data to identify potential diagnoses...',
          color: 'text-info',
        };
      case 'finalizing':
        return {
          icon: Brain,
          title: 'Finalizing Diagnosis',
          description: 'Synthesizing final diagnosis based on all available information...',
          color: 'text-ok',
        };
      default: // analyzing
        return {
          icon: CircleNotch,
          title: 'Analyzing Clinical Data',
          description: 'Processing patient information and consultation transcript...',
          color: 'text-primary',
        };
    }
  };

  const stageInfo = getStageInfo(stage);
  const IconComponent = stageInfo.icon;

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="flex items-center justify-center py-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <IconComponent 
              className={cn(
                'h-8 w-8',
                stageInfo.color,
                stage === 'analyzing' || stage === 'differential' ? 'animate-spin' : 'animate-pulse'
              )} 
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {stageInfo.title}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {stageInfo.description}
            </p>
          </div>
          <div className="flex justify-center space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full bg-current animate-pulse',
                  stageInfo.color
                )}
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '1s',
                }}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 