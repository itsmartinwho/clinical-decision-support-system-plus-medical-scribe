# Demo System Guide

This document provides a comprehensive guide to the Foresight CDSS demo system, covering its architecture, testing procedures, and best practices.

## Overview

The Foresight CDSS MVP includes a comprehensive demo system that showcases the platform's capabilities using existing features with automatic navigation and animations. The demo system is built with a clean service layer architecture that separates demo logic from production functionality.

## Architecture

### Service Layer

The demo system is built around three core services that handle different aspects of the demo experience:

#### 1. DemoDataService (`src/services/demo/DemoDataService.ts`)

Contains all demo data including:
- **Dorothy Robinson Patient Data**: The synthetic seed patient's profile, with demographics, medical history, and conditions (updated June 2025)
- **Encounter Data**: Her latest synthetic encounter (May 17, 2025 - constipation case)
- **Transcript Lines**: A generated bilingual (Spanish/English) consultation transcript
- **Clinical Content**: The diagnosis text and treatment plan from her seeded records

**Key Methods:**
- `getPatientData()`: Returns the demo patient (Dorothy Robinson)
- `getEncounterData()`: Returns structured encounter information
- `getTranscriptLines()`: Returns array of transcript lines for animation
- `getDiagnosisText()` / `getTreatmentPlanText()`: Returns clinical content

#### 2. DemoAnimationService (`src/services/demo/DemoAnimationService.ts`)

Handles all demo animations and timing:
- **Transcript Animation**: Types out conversation lines with 1200ms intervals
- **Clinical Plan Simulation**: Simulates AI processing with 1800ms delay
- **Cleanup Management**: Proper cleanup of timers and intervals

**Key Methods:**
- `startTranscriptAnimation()`: Begins typing animation for transcript
- `startClinicalPlanSimulation()`: Simulates clinical plan generation
- `clearAllAnimations()`: Cleanup method for all active animations

#### 3. DemoStateService (`src/services/demo/DemoStateService.ts`)

Manages demo state persistence and cross-tab communication:
- **localStorage Integration**: Persists demo completion state
- **Cross-tab Synchronization**: Ensures consistent state across browser tabs
- **Stage Management**: Tracks demo progression through defined stages

**Key Methods:**
- `hasDemoRun()` / `setDemoRun()`: Manages demo completion state
- `shouldShowDemoModal()`: Determines if intro modal should display
- `addStorageListener()`: Enables cross-tab state synchronization

### Hook Layer

The hook layer provides specialized demo behavior for different component types:

#### 1. useDemoOrchestrator (`src/hooks/demo/useDemoOrchestrator.tsx`)

Main orchestrator that coordinates between all services:
- **State Management**: Centralizes all demo state
- **Service Coordination**: Manages interactions between services
- **Navigation Control**: Handles demo flow and routing
- **Animation Lifecycle**: Coordinates animation timing and cleanup

#### 2. useDemoConsultation (`src/hooks/demo/useDemoConsultation.tsx`)

Provides demo behavior specifically for consultation components:
- **Transcript Animation**: Manages animated conversation display
- **Clinical Plan Simulation**: Handles diagnosis and treatment plan generation
- **Demo Mode Props**: Provides demo-specific props for consultation panels

#### 3. useDemoWorkspace (`src/hooks/demo/useDemoWorkspace.tsx`)

Handles workspace demo behavior:
- **Panel Visibility**: Controls when demo consultation panel appears
- **Stage Management**: Manages workspace-specific demo stages
- **UI State**: Handles demo-specific UI states and transitions

### Context Layer

#### DemoContext (`src/contexts/DemoContext.tsx`)

Simplified context provider that wraps the demo orchestrator:
- **Provider Pattern**: Makes demo state available throughout the app
- **Type Safety**: Provides typed access to demo functionality
- **Error Handling**: Ensures hooks are used within proper context

## Demo Flow Stages

The demo progresses through the following stages:

1. **`introModal`**: Initial welcome modal with demo explanation
2. **`fabVisible`**: Floating action button becomes visible
3. **`selectingPatient`**: User selects Dorothy Robinson patient
4. **`navigatingToWorkspace`**: Navigation to patient workspace
5. **`consultationPanelReady`**: Consultation panel is ready to open
6. **`animatingTranscript`**: Transcript animation is playing
7. **`simulatingPlanGeneration`**: Clinical plan generation simulation
8. **`showingPlan`**: Final diagnosis and treatment plan display
9. **`finished`**: Demo completed

## Testing Guide

### Quick Test Instructions

The demo system should automatically show up when you first visit the application. If it doesn't appear, follow these steps to test and debug:

#### 1. Check Browser Console

Open the browser developer tools (F12) and look for these console messages:
- `Demo orchestrator initializing - hasDemoRun: false`
- `Demo orchestrator initializing - shouldShowDemoModal: true`
- `Demo orchestrator initializing - initialDemoStage: introModal`
- `DashboardView demo state: { hasDemoRun: false, isDemoModalOpen: true, demoStage: 'introModal', isDemoActive: false }`

#### 2. Reset Demo State

**🎯 Easiest Method - Use the UI:**
1. Click on the user profile picture in the top-right corner of the header
2. Click "Reset Demo" from the dropdown menu
3. The page will automatically reload and the demo modal should appear

**Alternative Methods:**

If the demo has already run (you'll see `hasDemoRun: true` in console), you can also reset it using any of these methods:

**Method 1 - Use the exposed function:**
```javascript
resetDemo()
```

**Method 2 - Use the alternative function:**
```javascript
forceShowDemo()
```

**Method 3 - Manual reset:**
```javascript
localStorage.removeItem('hasDemoRun');
window.location.reload();
```

**Method 4 - Complete manual reset:**
```javascript
localStorage.clear();
window.location.reload();
```

> **Note:** After running any reset command, the page will automatically reload and the demo modal should appear.

#### 3. Expected Demo Flow

1. **Initial Load**: Demo modal should appear with "See Foresight in Action" title
2. **Start Demo**: Click "Start Demo" button
3. **Navigation**: Should navigate to Dorothy Robinson patient workspace
4. **Demo Panel**: Consultation panel should open automatically
5. **Animation**: Transcript should animate line by line
6. **Clinical Plan**: After transcript, diagnosis and treatment should appear

#### 4. Demo Patient Data

The demo uses the synthetic seed patient "Dorothy Robinson" (`supabase/seed.sql`), ID `0681FA35-A794-4684-97BD-00B88370DB41`

Patient details:
- Name: Dorothy Robinson
- Gender: Female
- DOB: 1978-10-02
- Language: Spanish
- Medical History: Acute myelomonocytic leukemia in complete remission (since 1998)
- Latest Encounter: May 17, 2025 - Constipation case with bilingual transcript

### Troubleshooting

**Demo modal not showing:**
- Check console for initialization logs
- Verify localStorage doesn't have `hasDemoRun: true`
- Ensure you're on the dashboard page
- **Try the UI reset**: Click user profile → "Reset Demo"

**Demo functions not available in console:**
- **Recommended**: Use the UI reset option instead (user profile → "Reset Demo")
- Wait for the page to fully load (check for "Demo functions available" message in console)
- Try refreshing the page and waiting a few seconds
- If still not available, use the manual reset method

**"ReferenceError: javascript is not defined" error:**
- **Recommended**: Use the UI reset option instead (user profile → "Reset Demo")
- This happens when trying to run code that's not properly defined
- Use one of the alternative reset methods listed above
- Make sure you're typing the function name correctly (no extra characters)

**Demo fails to start:**
- Check for JavaScript errors in console
- Verify DemoProvider is wrapping the app
- Check network tab for failed requests
- **Try the UI reset**: Click user profile → "Reset Demo"

**Demo gets stuck:**
- Check demo stage in console logs
- Verify animation services are working
- Look for any race conditions in patient data loading

**If all else fails:**
Try this complete reset sequence:
```javascript
// Clear all localStorage
localStorage.clear();
// Force reload
window.location.href = window.location.href;
```

### Race Condition Prevention Guide

⚠️ **IMPORTANT**: The demo system is delicate and requires careful handling to prevent race conditions. Always consider these when making changes:

#### Known Race Conditions and Solutions

##### 1. Encounter Creation Loops
- **Issue**: `useEffect` dependencies on `createEncounter` callback causing infinite loops
- **Solution**: Use refs to track creation state and separate dependency management
- **Implementation**: `shouldCreateEncounterRef` in `ConsultationPanel.tsx`
- **Key Code**: Never call `createEncounter` in demo mode, use `shouldCreateEncounterRef.current = !isDemoMode`

##### 2. Demo/Production Logic Conflicts
- **Issue**: Mixed demo and production state in same component instances
- **Solution**: Separate demo and production consultation panels entirely
- **Implementation**: Conditional rendering of separate `ConsultationPanel` instances
- **Key Code**: Always use `isDemoMode` flag to separate logic paths

##### 3. Transcription Service Conflicts
- **Issue**: Multiple transcription sessions or conflicts with manual editing
- **Solution**: State guards and proper WebSocket cleanup
- **Implementation**: `isSavingRef` and connection cleanup in `ConsultationTab.tsx`

##### 4. Patient Data Loading Races
- **Issue**: Multiple simultaneous data loads triggering state updates
- **Solution**: Loading state refs and patient ID tracking
- **Implementation**: `isLoadingDataRef` and `loadedPatientIdRef` in `PatientWorkspaceViewModern.tsx`

##### 5. LocalStorage Key Mismatches
- **Issue**: Reset functions using wrong localStorage keys
- **Solution**: Always use the current `DEMO_STORAGE_KEY` value (`hasDemoRun_v3`)
- **Implementation**: Update all reset functions when storage key changes

#### Best Practices for Robust Implementation

1. **Use Refs for State Guards**: Prevent multiple simultaneous operations
2. **Separate Demo from Production**: Never mix demo and production logic in the same component instance
3. **Proper Cleanup**: Always clean up WebSockets, timers, and event listeners
4. **Dependency Management**: Be careful with useEffect dependencies, especially callbacks
5. **Service Layer Separation**: Keep demo logic in services, not components
6. **Storage Key Consistency**: Always use the current storage key from `DemoStateService.DEMO_STORAGE_KEY`
7. **State Synchronization**: Use storage events for cross-tab synchronization
8. **Proper Reset Logic**: Use `localStorage.removeItem()` not `setItem('false')` for complete reset

## Integration with Production Components

### Clean Separation Approach

The demo system integrates with production components through composition rather than modification:

```typescript
// Production component remains unchanged
const ProductionComponent = ({ patient, encounter }) => {
  // Normal production logic
};

// Demo behavior is added through hooks
const ComponentWithDemo = ({ patient, encounter }) => {
  const demoState = useDemo();
  const demoWorkspace = useDemoWorkspace({
    patient,
    isDemoActive: demoState.isDemoActive,
    // ... other demo props
  });

  // Component uses both production and demo logic
  return (
    <>
      <ProductionComponent patient={patient} encounter={encounter} />
      {demoWorkspace.shouldRunDemoUi && (
        <DemoSpecificComponent {...demoProps} />
      )}
    </>
  );
};
```

### Key Integration Points

1. **PatientWorkspaceViewModern**: Main workspace component with demo consultation panel
2. **ConsultationPanel**: Accepts demo props for animated behavior
3. **DashboardView**: Integrates demo modal and floating action button

## Benefits of This Architecture

### 1. Clean Separation of Concerns
- Demo logic is completely separated from production code
- No demo-specific props polluting production components
- Easy to maintain and test independently

### 2. Reusability
- Services can be used across different components
- Hooks provide specialized behavior for different use cases
- Easy to extend with new demo scenarios

### 3. Maintainability
- Clear boundaries between demo and production functionality
- Centralized demo data and logic
- Proper cleanup and memory management

### 4. Testing
- Services can be unit tested independently
- Demo behavior can be tested without affecting production
- Easy to mock demo services for testing

## Usage Examples

### Starting the Demo

```typescript
const { startDemo, isDemoActive, demoStage } = useDemo();

// Start demo programmatically
await startDemo();
```

### Adding Demo Behavior to Components

```typescript
const MyComponent = ({ patient }) => {
  const demoState = useDemo();
  const demoConsultation = useDemoConsultation({
    patient,
    isDemoActive: demoState.isDemoActive,
    demoStage: demoState.demoStage,
    // ... other props
  });

  return (
    <ConsultationPanel
      patient={patient}
      isDemoMode={demoConsultation.isDemoMode}
      initialDemoTranscript={demoConsultation.initialDemoTranscript}
      // ... other demo props
    />
  );
};
```

### Accessing Demo Data

```typescript
// Get demo patient data
const demoPatient = DemoDataService.getPatientData();

// Get demo encounter
const demoEncounter = DemoDataService.getEncounterData();

// Get transcript for animation
const transcriptLines = DemoDataService.getTranscriptLines();
```

## Future Enhancements

### Potential Improvements

1. **Multiple Demo Scenarios**: Support for different demo flows and patient cases
2. **Demo Recording**: Ability to record and replay user interactions
3. **Customizable Timing**: User-configurable animation speeds and delays
4. **Demo Analytics**: Track demo completion rates and user engagement
5. **Interactive Tutorials**: Step-by-step guided tours with tooltips

### Extension Points

The current architecture makes it easy to add:
- New demo services for different types of content
- Additional demo hooks for new component types
- Custom animation services for different interaction patterns
- New demo stages for extended workflows

## Troubleshooting

### Common Issues

1. **Demo Not Starting**: Check that Dorothy Robinson patient exists in database
2. **Animations Not Playing**: Verify DemoAnimationService cleanup is working properly
3. **State Persistence Issues**: Check localStorage permissions and cross-tab communication
4. **Memory Leaks**: Ensure proper cleanup of timers and event listeners

### Best Practices for Implementation

1. **Proper Cleanup**: Always clean up WebSockets, timers, and event listeners
2. **Service Layer Separation**: Keep demo logic in services, not components
3. **Separate Demo from Production**: Never mix demo and production logic in the same component instance

### Debugging

Enable demo debugging by checking console logs:
- Demo stage transitions are logged in `useDemoOrchestrator`
- Animation lifecycle events are logged in `DemoAnimationService`
- State changes are logged in `DemoStateService` 