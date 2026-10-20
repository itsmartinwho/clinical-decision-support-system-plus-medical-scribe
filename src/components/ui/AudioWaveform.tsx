import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Microphone as Mic, MicrophoneSlash as MicOff } from '@phosphor-icons/react';
import { Button } from './button';

interface AudioWaveformProps {
  isRecording: boolean;
  isPaused: boolean;
  mediaStream?: MediaStream | null; // Accept existing media stream
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  className?: string;
  height?: number;
  barCount?: number;
  barColor?: string;
  backgroundColor?: string;
  showMicIcon?: boolean;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isRecording,
  isPaused,
  mediaStream,
  onPause,
  onResume,
  onStop,
  className = '',
  height = 32,
  barCount = 15,
  barColor = '#22c55e', // green-500
  backgroundColor = 'transparent',
  showMicIcon = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const audioContextRef = useRef<AudioContext>();
  const analyserRef = useRef<AnalyserNode>();
  const sourceRef = useRef<MediaStreamAudioSourceNode>();
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  // Initialize audio context when we have a media stream
  useEffect(() => {
    const initAudio = async () => {
      if (!isRecording || isPaused || !mediaStream || isInitialized) {
        console.log('AudioWaveform: Skipping init - isRecording:', isRecording, 'isPaused:', isPaused, 'hasMediaStream:', !!mediaStream, 'isInitialized:', isInitialized);
        return;
      }

      try {
        console.log('AudioWaveform: Initializing with mediaStream:', mediaStream);
        console.log('AudioWaveform: MediaStream tracks:', mediaStream.getTracks());
        
        // Check if we have audio tracks
        const audioTracks = mediaStream.getAudioTracks();
        if (audioTracks.length === 0) {
          console.warn('AudioWaveform: No audio tracks found in mediaStream');
          return;
        }

        console.log('AudioWaveform: Found audio tracks:', audioTracks);

        // Create audio context
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;

        // Create analyser
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3; // Reduced for more responsive animation
        analyserRef.current = analyser;

        // Create source from media stream
        const source = audioContext.createMediaStreamSource(mediaStream);
        sourceRef.current = source;
        source.connect(analyser);

        setHasPermission(true);
        setIsInitialized(true);
        console.log('AudioWaveform: Audio context and analyser setup complete');
      } catch (error) {
        console.error('AudioWaveform: Error setting up audio analysis:', error);
        setHasPermission(false);
      }
    };

    initAudio();

    // Cleanup function
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (!isRecording && audioContextRef.current && audioContextRef.current.state !== 'closed') {
        console.log('AudioWaveform: Cleaning up audio context');
        if (sourceRef.current) {
          sourceRef.current.disconnect();
        }
        audioContextRef.current.close();
        setIsInitialized(false);
      }
    };
  }, [isRecording, isPaused, mediaStream, isInitialized]);

  // Start/stop animation based on recording state
  useEffect(() => {
    if (!isRecording || isPaused || !isInitialized || !analyserRef.current || !canvasRef.current) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    console.log('AudioWaveform: Starting animation loop, buffer length:', bufferLength);

    const draw = () => {
      if (!isRecording || isPaused) {
        console.log('AudioWaveform: Stopping animation - recording stopped or paused');
        return;
      }

      animationRef.current = requestAnimationFrame(draw);

      // Get frequency data
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume for debugging
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      if (average > 1) { // Only log when there's actual audio
        console.log('AudioWaveform: Audio level average:', average);
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate bar dimensions
      const barWidth = 2;
      const barSpacing = 2;
      const totalBarsWidth = barCount * barWidth + (barCount - 1) * barSpacing;
      const startX = (canvas.width - totalBarsWidth) / 2;

      // Draw bars
      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * bufferLength);
        const value = dataArray[dataIndex];
        const barHeight = Math.max(3, (value / 255) * canvas.height * 0.8);
        
        const x = startX + i * (barWidth + barSpacing);
        const y = (canvas.height - barHeight) / 2;

        ctx.fillStyle = barColor;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    };

    // Start animation
    console.log('AudioWaveform: Starting draw loop');
    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    };
  }, [isRecording, isPaused, isInitialized, barCount, barColor, height]);

  // Draw idle state when not recording or paused
  useEffect(() => {
    if (!canvasRef.current || (isRecording && !isPaused)) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw idle bars at minimum height
    const barWidth = 2;
    const barSpacing = 2;
    const totalBarsWidth = barCount * barWidth + (barCount - 1) * barSpacing;
    const startX = (canvas.width - totalBarsWidth) / 2;
    const minBarHeight = 3;

    ctx.fillStyle = isPaused ? `${barColor}80` : `${barColor}40`;
    for (let i = 0; i < barCount; i++) {
      const x = startX + i * (barWidth + barSpacing);
      const y = (canvas.height - minBarHeight) / 2;
      ctx.fillRect(x, y, barWidth, minBarHeight);
    }
  }, [isRecording, isPaused, barCount, barColor]);

  // Show the component when recording OR when paused (active transcription session)
  console.log('AudioWaveform render decision:', { isRecording, isPaused, shouldHide: !isRecording && !isPaused });
  if (!isRecording && !isPaused) {
    console.log('AudioWaveform: Returning null because isRecording=false AND isPaused=false');
    return null;
  }

  console.log('AudioWaveform: Rendering component, isRecording:', isRecording, 'isPaused:', isPaused);

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
        
        {!hasPermission && (
          <div className="absolute inset-0 flex items-center justify-center">
            <MicOff size={12} className="text-destructive" />
          </div>
        )}
      </div>
      
      {/* Microphone indicator */}
      {showMicIcon && (
        <div className={`flex items-center ${isRecording && !isPaused ? 'text-ok' : 'text-muted-foreground'}`}>
          <Mic size={12} />
        </div>
      )}
      
      {/* Pause/Resume button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={isPaused ? onResume : onPause}
        className="h-6 w-6 p-0 hover:bg-well"
        title={isPaused ? "Resume Recording" : "Pause Recording"}
      >
        {isPaused ? <Play size={10} /> : <Pause size={10} />}
      </Button>
    </div>
  );
}; 