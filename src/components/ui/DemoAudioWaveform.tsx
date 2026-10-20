import React, { useEffect, useRef } from 'react';
import { Pause, Microphone as Mic } from '@phosphor-icons/react';
import { Button } from './button';

interface DemoAudioWaveformProps {
  className?: string;
  height?: number;
  barCount?: number;
  barColor?: string;
  backgroundColor?: string;
  showMicIcon?: boolean;
}

export const DemoAudioWaveform: React.FC<DemoAudioWaveformProps> = ({
  className = '',
  height = 32,
  barCount = 15,
  barColor = '#4F42D8', // iris
  backgroundColor = 'transparent',
  showMicIcon = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Demo animation effect - creates a simulated waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationTime = 0;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      animationTime += 0.1;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate bar dimensions
      const barWidth = 2;
      const barSpacing = 2;
      const totalBarsWidth = barCount * barWidth + (barCount - 1) * barSpacing;
      const startX = (canvas.width - totalBarsWidth) / 2;

      // Draw bars with simulated audio data
      for (let i = 0; i < barCount; i++) {
        // Create a smooth wave pattern with some randomness
        const baseWave = Math.sin(animationTime + i * 0.3) * 0.5 + 0.5;
        const randomness = Math.sin(animationTime * 3 + i * 0.8) * 0.3 + 0.7;
        const combinedHeight = (baseWave * randomness) * 0.8 + 0.1;
        
        const barHeight = Math.max(3, combinedHeight * canvas.height * 0.8);
        
        const x = startX + i * (barWidth + barSpacing);
        const y = (canvas.height - barHeight) / 2;

        ctx.fillStyle = barColor;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    };

    // Start animation
    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [barCount, barColor, height]);

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-full shadow-lg ${className}`}>
      {/* Waveform */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={60}
          height={height}
          className="block"
          style={{ backgroundColor }}
        />
      </div>
      
      {/* Microphone indicator - always active in demo */}
      {showMicIcon && (
        <div className="flex items-center text-ok">
          <Mic size={12} />
        </div>
      )}
      
      {/* Disabled Pause button for demo */}
      <Button
        variant="ghost"
        size="sm"
        disabled={true}
        className="h-6 w-6 p-0 opacity-50 cursor-not-allowed"
        title="Demo mode - controls disabled"
      >
        <Pause size={10} />
      </Button>
    </div>
  );
}; 