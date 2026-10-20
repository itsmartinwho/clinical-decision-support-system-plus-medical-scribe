# Transcription System Guide

This document provides a comprehensive guide to the Foresight CDSS transcription system, covering its architecture, development best practices, and troubleshooting.

## 🚨 Critical Warning for Developers

**DO NOT include the `stopTranscription` callback (or any cleanup callback) in useEffect dependency arrays.** This will cause an immediate start/stop cycle that breaks transcription functionality.

### Quick Reference: What NOT to Do

```typescript
// ❌ NEVER DO THIS - Will break transcription
useEffect(() => {
  return () => {
    stopTranscription(true);
  };
}, [isOpen, stopTranscription]); // stopTranscription in deps = broken
```

### Quick Reference: What TO Do

```typescript
// ✅ CORRECT - Direct cleanup without callback dependencies
useEffect(() => {
  if (isOpen) return;
  
  if (transcriptionActiveRef.current) {
    // Direct cleanup using refs
    if(mediaRecorderRef.current) {
      // ... cleanup mediaRecorder
    }
    // ... cleanup other resources
  }
}, [isOpen]); // Only modal state in deps
```

## Overview

The transcription system is a core feature of the Foresight CDSS that provides real-time speech-to-text functionality during patient consultations. It supports two main interfaces: modal-based consultations and integrated workspace tabs.

### Intended Behavior

- **Auto-Start**: Transcription begins automatically when creating a new consultation from the dashboard or patient list.
- **User Controls**: Pause, resume, and stop functionality is available in both interfaces.
- **Session Management**: Sessions are automatically managed and resources are cleaned up properly.
- **Continuous Operation**: The system handles conversation pauses and automatically reconnects if the connection is lost.
- **Cross-Platform**: Works in both modal (ConsultationPanel) and workspace tab (ConsolidatedConsultationTab) contexts.

## System Architecture

### Key Components

- **`ConsultationPanel.tsx`**: The modal-based consultation interface for new consultations and demo mode.
- **`ConsolidatedConsultationTab.tsx`**: The integrated workspace tab interface for ongoing consultations within patient workspaces.
- **`AudioWaveform.tsx`**: The visual component for audio input with control buttons.
- **`NewConsultationModal.tsx`**: Handles creation and navigation with autoStartTranscription parameter.
- **`PatientWorkspaceViewModern.tsx`**: Coordinates workspace tab functionality and passes autoStartTranscription parameter.
- **Deepgram WebSocket**: The service used for real-time speech-to-text processing with enhanced parameters for handling silence.

### Transcription Flow Architecture

1. **Creation Flow**: NewConsultationModal → Navigation with `autoStartTranscription=true` → Patient Workspace → ConsolidatedConsultationTab auto-start
2. **Modal Flow**: Direct ConsultationPanel modal with auto-start functionality
3. **Manual Flow**: User manually starts transcription in either interface

### Enhanced Deepgram Configuration

The system now uses optimized Deepgram parameters to handle conversation pauses and silence:

```typescript
const wsUrl = 'wss://api.deepgram.com/v1/listen?' + new URLSearchParams({
  model: 'nova-3-medical',
  punctuate: 'true',
  interim_results: 'true',
  smart_format: 'true',
  diarize: 'true',
  utterance_end_ms: '3000', // Detect utterance end after 3 seconds of silence
  endpointing: 'false', // Disable automatic endpointing to prevent premature closures
  vad_events: 'true' // Enable voice activity detection events
}).toString();
```

### KeepAlive Mechanism

To prevent connection timeouts during conversation pauses, the system implements a KeepAlive mechanism:

- **Purpose**: Prevents Deepgram's 10-second inactivity timeout
- **Frequency**: Sends KeepAlive messages every 5 seconds
- **Implementation**: Automatic JSON messages sent to maintain the WebSocket connection

```typescript
// KeepAlive mechanism to prevent connection timeouts during silence
let keepAliveInterval: NodeJS.Timeout | null = null;

// Start KeepAlive messages every 5 seconds to prevent 10-second timeout
keepAliveInterval = setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "KeepAlive" }));
    console.log("Sent KeepAlive message");
  }
}, 5000);
```

### Automatic Reconnection

The system now includes intelligent reconnection logic:

- **Trigger Conditions**: Reconnects when connection is lost unexpectedly (not user-initiated)
- **Timing**: Waits 2 seconds before attempting reconnection to avoid rapid loops
- **Safety Checks**: Only reconnects if transcription should still be active and not paused

```typescript
// Only attempt reconnection if the transcription is still supposed to be active
// and it wasn't a user-initiated close (code 1000) or going away (code 1001)
if (transcriptionActiveRef.current && !isPausedRef.current && event.code !== 1000 && event.code !== 1001) {
  console.log('Connection lost unexpectedly, attempting reconnection...');
  
  // Wait a short time before reconnecting to avoid rapid reconnection loops
  setTimeout(() => {
    if (transcriptionActiveRef.current && !isPausedRef.current && isOpen) {
      console.log('Attempting automatic reconnection...');
      startVoiceInput(); // Recursive call to restart transcription
    }
  }, 2000);
}
```

### State Management and the Ref-State Pattern

The system uses a combination of React state (`useState`) and refs (`useRef`) to manage asynchronous operations and avoid race conditions.

**The core problem solved by this pattern was a race condition where React's dependency management would trigger cleanup functions immediately after starting transcription.**

To prevent this, we use a "ref-state" pattern:
1. State (`isTranscribing`) is used for UI reactivity.
2. A ref (`transcriptionActiveRef`) is used for reliable access to the current state in asynchronous callbacks and cleanup functions.

```typescript
const setIsTranscribingAndRef = (val: boolean) => {
  setIsTranscribing(val);           // For UI reactivity
  transcriptionActiveRef.current = val;  // For cleanup/async access
};
```

## Essential Developer Patterns

### 1. The Cleanup Order Pattern

Always clean up resources in this exact order to prevent memory leaks and errors:

1.  **KeepAlive Interval**: Clear the KeepAlive interval first.
2.  **MediaRecorder**: Stop the recorder and its tracks.
3.  **Audio Stream**: Stop all tracks on the audio stream.
4.  **WebSocket**: Close the connection.
5.  **State**: Update `isTranscribing` and `isPaused` state to `false`.

### 2. The Stable Callback Pattern

When passing callbacks to child components, ensure they are stable by using `useCallback` with an empty dependency array and accessing any required state via refs. This prevents unnecessary re-renders.

### 3. The Auto-Start Protection Pattern

To prevent infinite loops of transcription auto-starting, use a ref to track whether an auto-start has already been attempted for a given encounter.

### 4. The Resilient Connection Pattern

The system now implements resilient connection handling:
- KeepAlive messages prevent timeout disconnections
- Automatic reconnection handles unexpected connection losses
- Proper event handling for different types of WebSocket closures

## Debugging and Testing

### Debugging Checklist

1.  **Check Console Logs**: Look for the critical log message: `"[ConsultationPanel] Cleanup: Stopping transcription on true close/unmount"`. If it appears immediately after starting, you have a dependency issue.
2.  **Verify Refs and State**: Ensure `transcriptionActiveRef.current` and the `isTranscribing` state are in sync.
3.  **Check MediaRecorder State**: Log `mediaRecorderRef.current?.state` to see if it's `'recording'`, `'paused'`, or `'inactive'`.
4.  **Monitor KeepAlive Messages**: Look for regular "Sent KeepAlive message" logs every 5 seconds during active transcription.
5.  **Watch Reconnection Attempts**: Monitor for "Connection lost unexpectedly, attempting reconnection..." messages.

### Must-Test Scenarios

- **Basic Flow**: Start, speak, see text.
- **Pause/Resume**: Pause and resume transcription, ensuring it continues correctly.
- **Conversation Pauses**: Test with natural conversation pauses (3+ seconds) to ensure connection stays alive.
- **Network Interruption**: Test with brief network interruptions to verify automatic reconnection.
- **Modal Close**: Close the modal and verify that all resources are cleaned up properly (e.g., the browser microphone icon disappears).

### New Testing Scenarios

- **Long Silence Periods**: Test with periods of silence longer than 10 seconds to verify KeepAlive functionality.
- **Connection Recovery**: Temporarily disable network connection and verify automatic reconnection works.
- **Speech Detection Events**: Monitor console for UtteranceEnd and SpeechStarted events during natural conversation.
- **Auto-Start from Dashboard**: Create new consultation from dashboard/patients list and verify transcription auto-starts in workspace.
- **Auto-Start from Workspace**: Create new consultation from within patient workspace and verify transcription auto-starts.
- **Cross-Component Functionality**: Test that all transcription features work identically in both ConsultationPanel and ConsolidatedConsultationTab.

## Recent Fix: Transcription Regression (January 2025)

### Issue Resolved

Fixed a regression where creating new consultations from the dashboard or patient list would navigate to the patient workspace but fail to automatically start transcription.

### Root Causes

1. **Missing Auto-Start Parameter**: `NewConsultationModal` was navigating with only `encounterId` but missing the `autoStartTranscription=true` parameter.
2. **Incomplete Workspace Integration**: `PatientWorkspaceViewModern` wasn't detecting and passing the autoStartTranscription parameter to the consultation tab.
3. **Missing Transcription Functionality**: `ConsolidatedConsultationTab` only displayed existing transcripts but lacked live transcription capabilities.

### Solution Implemented

1. **Enhanced NewConsultationModal Navigation**: Updated both existing patient and new patient creation flows to navigate with `?tab=consultation&encounterId=${id}&autoStartTranscription=true`.

2. **Updated PatientWorkspaceViewModern**: Modified URL parameter handling to detect `autoStartTranscription` and pass it to `ConsolidatedConsultationTab`.

3. **Complete ConsolidatedConsultationTab Integration**: Added full live transcription functionality:
   - Live transcription state management with Deepgram WebSocket API
   - Enhanced Deepgram configuration with medical model and silence handling
   - KeepAlive mechanism and automatic reconnection
   - AudioWaveform controls for pause/resume/stop
   - Auto-start transcription when `autoStartTranscription=true`
   - Rich text editor for live transcript display and editing
   - Automatic transcript saving to database

### Technical Implementation Details

- **Hook Order Compliance**: Ensured all React hooks are called before early returns to comply with Rules of Hooks.
- **State Synchronization**: Used same ref-state pattern as ConsultationPanel for reliable transcription state management.
- **Icon Import Fixes**: Updated phosphor-icons imports to use correct icon names (PencilSimple, FloppyDisk instead of Edit3, Save).
- **Parameter Flow**: `NewConsultationModal` → URL with `autoStartTranscription=true` → `PatientWorkspaceViewModern` → `ConsolidatedConsultationTab` auto-start.

This fix restores the intended user experience where creating a new consultation from anywhere in the application automatically starts live transcription in the appropriate interface.

## API and Dependencies

- **Deepgram API**: The system uses the Deepgram API for speech-to-text.
    - **Endpoint:** `wss://api.deepgram.com/v1/listen`
    - **Model:** `nova-3-medical`
    - **Enhanced Parameters:**
        - `utterance_end_ms=3000`: Detects utterance end after 3 seconds
        - `endpointing=false`: Disables automatic endpointing to prevent premature closures
        - `vad_events=true`: Enables voice activity detection events
- **Environment Variables**:
    - `DEEPGRAM_API_KEY`: Required for the transcription service. Server only: the browser gets a 30-second token from `/api/deepgram/token` (`src/lib/deepgram.ts`) for each socket it opens, and passes it as the `bearer` subprotocol.

## Troubleshooting Common Issues

### Transcription Stops During Conversation Pauses

**Symptoms**: Transcription stops working after periods of silence in conversation.

**Solution**: This should now be resolved with the KeepAlive mechanism. If it still occurs:
1. Check console for KeepAlive messages being sent every 5 seconds
2. Verify the WebSocket connection isn't being closed with code 1000 or 1001
3. Monitor for automatic reconnection attempts

### Cannot Restart Transcription After Connection Loss

**Symptoms**: Transcription buttons become unresponsive after a connection loss.

**Solution**: The system now automatically reconnects. If manual restart is needed:
1. Check if `transcriptionActiveRef.current` is properly set to `false`
2. Verify all audio resources are cleaned up before restarting
3. Monitor console for reconnection attempt logs

### Frequent Disconnections

**Symptoms**: WebSocket connections frequently close and reconnect.

**Investigation Steps**:
1. Check network stability
2. Verify Deepgram API key is valid
3. Monitor for error messages in WebSocket error handlers
4. Check if KeepAlive messages are being sent successfully 