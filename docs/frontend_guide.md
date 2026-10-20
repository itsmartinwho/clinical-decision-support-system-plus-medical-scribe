# Frontend Guide

This document establishes frontend development guidelines, styling conventions, and architectural patterns for the Foresight CDSS MVP.

**For the overall system architecture, AI tool implementation, and backend details, refer to [`architecture.md`](./architecture.md).**

## Upcoming Consultations Navigation

The application supports differentiated behavior when interacting with upcoming consultations in both the Dashboard and Patients tab:

### Dashboard View
- **Start Button**: Clicking the "Start" button on an upcoming consultation navigates to the patient's workspace, automatically opens the consultation modal, and starts transcription with the consultation metadata pre-loaded
- **Row Click**: Clicking anywhere else in the consultation row navigates to the patient's workspace without auto-starting the consultation

### Patients Tab (All Consultations view)
- **Start Button (Upcoming)**: For upcoming consultations, the button shows "Start" and navigates with auto-start behavior
- **Go to Consult Button (Past)**: For past consultations, the button shows "Go to Consult" and navigates normally without auto-start
- **Row Click**: Clicking elsewhere in any consultation row navigates to the patient's workspace without auto-starting

### Technical Implementation
- Uses `autoStartTranscription=true` URL parameter to trigger automatic consultation modal opening and transcription start
- Legacy `autoStart=true` parameter also supported for backward compatibility
- ConsultationPanel supports `selectedEncounter` and `autoStartTranscription` props
- URL parameters are automatically cleaned up after modal interaction
- Consultation metadata (date, reason, etc.) is preserved during auto-start

## Code Organization

The project follows a standard Next.js project structure. For details on the directory structure and component architecture, refer to the "Frontend Architecture" section in [`architecture.md`](./architecture.md).

## Coding Standards

### TypeScript
- **Use TypeScript**: All components and functions typed.
- **Avoid `any`**: Use specific types or `unknown`.
- **Use interfaces/types**: For complex object types.
- **Type props**: Always type component props.
- **Export types**: Make types available for reuse.

### React & Components
- **Functional components**: Use functional components with hooks.
- **Custom hooks**: Extract reusable logic into custom hooks (`src/hooks/`).
- **Component size**: Keep components focused on a single responsibility.
- **Props destructuring**: Destructure props in function parameters.

## Key Components

### `ConsultationPanel`
The `ConsultationPanel` (`src/components/modals/ConsultationPanel.tsx`) is a key UI component for creating new consultations. It's a full-screen modal that automatically creates a new encounter when opened and provides a rich text editor for the consultation notes.

### `RichTextEditor`
The `RichTextEditor` (`src/components/ui/rich-text-editor.tsx`) is a robust text editing component built with Tiptap. It provides a reliable editing experience with an integrated toolbar and is compatible with the transcription service.

## State Management

- **Local State**: `useState` and `useReducer` for component-level state.
- **Global State**: React Context for shared state.
- **Data Fetching**: `supabaseDataService.ts` or direct Supabase client calls.

## Styling & UI Conventions

### Icon Library
The application uses Phosphor Icons (`@phosphor-icons/react`).

### Input and Placeholder Styling
Placeholders are styled to be paler and lighter than user-provided input. This is handled globally in `globals.css`.

### Patient Workspace Modernization (`PatientWorkspaceViewModern.tsx`)
The patient workspace has been modernized with a unified glassmorphic design and improved content organization using a reusable `Section` component.

### Side Panel Background Images
The dashboard and patients tab side panels now support custom background images with configurable transparency.

#### Configuration
All background image settings are centralized in `src/lib/side-panel-config.ts`:

```typescript
export const SIDE_PANEL_CONFIG = {
  // Background image path (relative to public directory)
  backgroundImage: '/images/background_waves.png',
  
  // Opacity for the background image (0.3 = 70% transparency)
  opacity: 0.3,
  
  // Background positioning and sizing
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
};
```

To test a different image, add it to `public/images/` and update the `backgroundImage` path in the configuration file.

### Plasma Background Effect
A subtle, animated gradient flow background effect is implemented using Three.js and a custom GLSL fragment shader. It is managed outside the main React render tree for stability and respects the user's `prefers-reduced-motion` setting.

## Draggable & Minimizable Modals

The application features a comprehensive draggable and minimizable modal system that enhances user productivity by allowing modals to be repositioned, minimized to a bottom taskbar, and restored on demand. This system is built with accessibility, performance, and user experience as core priorities.

#### Overview & Features

**Core Functionality:**
- **Drag and Drop**: Click and drag modals by their title bars for optimal positioning
- **Minimize/Restore**: Collapse modals to a bottom taskbar when not actively needed  
- **Position Persistence**: Modal positions are saved in sessionStorage and restored across sessions
- **Multiple Modal Support**: Multiple modals can be open and minimized simultaneously
- **Keyboard Shortcuts**: Ctrl+M to minimize, Escape to close
- **Viewport Constraints**: Modals stay within screen boundaries with configurable constraints
- **Perfect Centering**: All modals center correctly on initial open regardless of size
- **Accessibility Compliant**: Full screen reader and keyboard navigation support

**Supported Modal Types:**
- Demo Intro Modal (Dashboard) - Draggable, Minimizable, Centered
- New Consultation Modal (Dashboard & Patients) - Draggable, Minimizable, Centered  
- Consultation Panel Modal (Patient Workspaces) - Draggable, Minimizable, Centered
- Guidelines Modal - Draggable, Minimizable
- All Dialog-based Modals - Support through DraggableDialogContent

#### Technical Architecture

**Core Components:**
- `useModalDragAndMinimize` - Main hook for drag/minimize functionality
- `DraggableModalWrapper` - Standalone draggable modal component  
- `DraggableDialogContent` - Draggable version of Dialog component
- `modal-manager` - Global state management with sessionStorage persistence
- `modalPersistence` - Position constraints and storage utilities
- `MinimizedModalsBar` - Bottom taskbar for minimized modals

**Key Technical Features:**
- **Smart Centering**: Dynamic calculation based on modal type and viewport size
- **Drag Handle Optimization**: Full title bar draggable with button click prevention
- **Pointer Events Management**: Simplified pointer-events structure for reliable dragging
- **Constraint Management**: Proper viewport constraints with modal-specific dimensions
- **State Persistence**: Positions saved per modal ID in sessionStorage
- **Overlay Management**: Centralized overlay handling prevents UI blocking issues

#### Usage Examples

**Making a Dialog Draggable:**
```tsx
import { Dialog, DraggableDialogContent } from '@/components/ui/dialog';

function MyModal({ isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DraggableDialogContent
        draggable={true}
        draggableConfig={{
          id: 'my-modal-unique-id',
          title: 'My Draggable Modal',
          defaultPosition: { x: 100, y: 100 },
          persistent: true, // Saves position to sessionStorage
        }}
      >
        <DialogHeader>
          <DialogTitle>My Draggable Modal</DialogTitle>
        </DialogHeader>
        {/* Modal content */}
      </DraggableDialogContent>
    </Dialog>
  );
}
```

**Custom Modal with DraggableModalWrapper:**
```tsx
import { DraggableModalWrapper } from '@/components/ui/draggable-modal-wrapper';

function CustomModal({ isOpen, onClose }) {
  return (
    <DraggableModalWrapper
      onClose={onClose}
      config={{
        id: 'custom-modal',
        title: 'Custom Modal',
        persistent: true,
      }}
    >
      <div className="p-6">
        {/* Your custom modal content */}
      </div>
    </DraggableModalWrapper>
  );
}
```

#### Configuration Options

**ModalDragAndMinimizeConfig Interface:**
```tsx
interface ModalDragAndMinimizeConfig {
  id: string;                    // Unique identifier (required)
  title: string;                 // Title shown in minimized bar
  defaultPosition?: { x: number; y: number }; // Initial position
  persistent?: boolean;          // Save position to sessionStorage
  canMinimize?: boolean;         // Allow minimization (default: true)
  constraints?: {               // Viewport constraints
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
  };
}
```

#### Modal Manager Integration

The `ModalManagerProvider` must be included in your app's root layout to enable the minimized modal bar and global state management:

```tsx
// In your layout.tsx or App component
import { ModalManagerProvider } from '@/components/ui/modal-manager';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ModalManagerProvider>
          {children}
        </ModalManagerProvider>
      </body>
    </html>
  );
}
```

#### Keyboard Shortcuts & Accessibility

**Keyboard Support:**
- `Ctrl + M` - Minimize/restore active modal
- `Escape` - Close active modal  
- `Tab` - Navigate between modal elements
- `Enter` - Activate focused button
- `Space` - Toggle focused checkbox/button

**Accessibility Features:**
- Proper ARIA labels and roles for all interactive elements
- Live region announcements for state changes
- Keyboard navigation with logical tab order
- Focus management during minimize/restore operations
- Screen reader compatible with descriptive labels

#### Performance & Browser Support

**Performance Optimizations:**
- Event listeners added/removed efficiently during drag operations
- Position updates throttled during drag for smooth performance
- Minimal DOM manipulations using CSS transforms
- Automatic cleanup on component unmount
- SessionStorage data with automatic expiration

**Browser Compatibility:**
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Progressive enhancement with graceful degradation
- Core modal functionality works without drag features on older browsers

#### Best Practices

1. **Unique Modal IDs**: Always provide a unique `id` in draggableConfig for proper state management
2. **Meaningful Titles**: Use descriptive titles for the minimized state display
3. **Persistent Configuration**: Set `persistent: true` for modals that should remember position
4. **Testing**: Test minimize/restore functionality when adding draggable support to new modals
5. **Content Handling**: Ensure modal content handles being minimized appropriately (e.g., ongoing processes continue)
6. **Responsive Design**: Consider how draggable modals behave on different screen sizes

#### Implementation Examples from the Codebase

**New Consultation Modal (Dashboard & Patients):**
- Uses `mergedDraggableConfig` to inject centered `defaultPosition` when none provided
- Calculates center based on estimated modal dimensions (512x400px)
- Includes form state preservation during minimize/restore cycles

**Consultation Panel Modal (Patient Workspaces):**
- Larger modal (estimated 800x600px) with complex clinical workflows
- Supports ongoing transcription and clinical engine processes while minimized
- Uses direct `DraggableModalWrapper` rendering without container conflicts

**Demo Intro Modal (Dashboard):**
- Fixed modal size (750x650px) with custom positioning logic
- Implements dynamic viewport-based centering calculations
- Non-persistent configuration suitable for introductory content

## Forms and Validation
- **Forms**: Standard React state and event handlers are used.
- **Validation**: Manual validation and simple checks are used.

## Performance Optimization
- **Memoization**: `React.memo`, `useCallback`, and `useMemo` are used to optimize performance.
- **Image optimization**: Next.js `<Image>` component should be used where possible.

## Accessibility
The application targets WCAG 2.1 AA compliance. This includes using semantic HTML, providing ARIA attributes, ensuring keyboard navigation, and maintaining sufficient color contrast.

## Testing

- **Component Testing**: Storybook for UI components. React Testing Library (aspirational for wider unit/integration testing).
- **E2E Testing**: Playwright for critical user flows.
- **Mock Strategy**: `/api/advisor` is live in E2E. Clinical engine functionality uses `ClinicalEngineServiceV3` for GPT-based reasoning.

## Documentation

### Code Documentation
- **JSDoc/TSDoc**: Document complex functions and components.
- **Props documentation**: Via TypeScript types.
- **Example usage**: In Storybook.

### Component Showcasing
- **Storybook**: Create stories for reusable UI components.

## Internationalization (Aspirational)
- No internationalization tools currently listed in `architecture.md`.

## Error Handling

### UI Error States
- **Error boundaries**: Use React error boundaries.
- **Fallback UIs**: Graceful degradation (e.g., `ErrorDisplay.tsx`).
- **User feedback**: Clear error messages.

## Security Best Practices

### Frontend Security
- **XSS prevention**: React helps by default. Avoid `innerHTML`.
- **CSRF protection**: Ensure protection if using custom state-changing API routes with cookies.
- **Sensitive data**: Never store unencrypted sensitive data in localStorage.

## Browser Compatibility
- **Support Targets**: Modern browsers (Chrome, Firefox, Safari, Edge - latest 2 versions).

## Code Quality Tools
- **ESLint & Prettier**: Enforce project rules.
- **TypeScript strict mode**: Enabled.

## Patient Workspace Architecture

### Tab Consolidation (2025 Refactor)

The patient workspace has been streamlined from 8 tabs to 2 tabs for improved user experience:

**Previous Structure (8 tabs):**
- Consultation
- Diagnosis  
- Treatment
- Labs
- Prior Auth
- Trials
- History
- All Data

**New Structure (2 tabs):**
- **Consultation** - Consolidated view for selected encounter
- **All Data** - Complete patient data across all encounters

### ConsolidatedConsultationTab Component

The new `ConsolidatedConsultationTab` (`src/components/patient-workspace-tabs/ConsolidatedConsultationTab.tsx`) combines all clinical data for a specific encounter in a vertical layout:

#### Layout Structure
1. **Encounter Header** - Date, ID, and reason for visit
2. **Summary Notes (SOAP Notes)** - Clinical summary with transcript viewer button
3. **Diagnosis** - Diagnoses for the encounter
4. **Treatment** - Treatment plans and medications  
5. **Labs** - Laboratory results
6. **Prior Authorization** - Prior auth forms and documentation
7. **Clinical Trials** - Relevant trial recommendations

#### Key Features
- **Encounter-Specific:** Shows data only for the selected encounter from the dropdown
- **Transcript Viewing:** "View Transcript" button opens a modal viewer for the full transcript
- **Card-Based Layout:** Each section is in a separate Card component for visual organization
- **Responsive Design:** Mobile-friendly with proper spacing and collapsible sections

#### Integration Points
- **PatientWorkspaceViewModern:** Main workspace component that renders the consolidated tab
- **Encounter Selection:** Uses the same encounter dropdown that was previously available
- **Demo Compatibility:** Maintains full compatibility with demo mode and routing
- **Routing Preservation:** All existing navigation from dashboard, patients list, and deep links continue to work

### Design Rationale

The consolidation addresses several UX concerns:
- **Reduced Cognitive Load:** Fewer tabs to navigate
- **Contextual Grouping:** All data for one encounter in one view
- **Improved Workflow:** Clinical data flows logically from notes → diagnosis → treatment → labs → documentation
- **Mobile Optimization:** Better experience on smaller screens with fewer navigation elements

### Migration Notes

The consolidation maintains backward compatibility:
- **URL Routes:** Existing patient workspace URLs continue to work  
- **Demo System:** Full demo functionality preserved
- **Data Structures:** No changes to underlying data models
- **Component Reuse:** Original tab components preserved for potential future use

Components like `DiagnosisTab`, `TreatmentTab`, etc. remain in the codebase but are no longer imported into the main workspace view.

---

## Modal System - Minimizable Modals Implementation

### Overview

The Foresight CDSS includes a comprehensive modal system with minimization functionality that enhances user productivity by allowing modals to be minimized to a taskbar and restored on demand. This system is fully integrated across all modal components in the application.

**Note: Draggability was disabled** due to recurring issues with modal positioning, centering, and user experience conflicts. The system now focuses on robust minimize/restore functionality while maintaining proper modal centering and stability.

### Core Features

**1. Minimize and Restore Functionality**
- Minimize modals to a bottom taskbar for better workspace management
- One-click restore from minimized state
- Visual minimize/restore animations for smooth user experience
- Maintains modal state and content during minimization cycles

**2. Drag Infrastructure (Disabled)**
- Complete drag and drop infrastructure exists but is disabled via `allowDragging={false}`
- Infrastructure remains in place for potential future re-enablement if issues are resolved
- Title bars show default cursor instead of grab cursor to indicate dragging is disabled

**3. Minimize and Restore System**
- Minimize modals to a bottom taskbar with one-click operation
- Restore from minimized state maintaining original centered position
- Multiple modal management with organized taskbar display
- Persistent minimize state across page navigation

**4. Position Management**
- Modals automatically center on screen when opened
- Proper centering calculations account for navigation bar and sidebar
- Smart positioning prevents modals from appearing off-screen
- Fixed positioning system eliminates previous centering issues

**5. Keyboard Accessibility**
- `Ctrl+M` to minimize/restore active modal
- `Escape` to close modals
- Full keyboard navigation support
- Screen reader compatibility with proper ARIA labels

**6. Cross-Page Persistence**
- Minimized modals persist when navigating between pages
- Smart state management distinguishes between component unmounting and user actions
- Seamless restoration from any page in the application

### Technical Architecture

**File Structure:**
```
src/
├── types/modal.ts                           # TypeScript interfaces
├── hooks/useModalDragAndMinimize.tsx        # Core minimize logic (drag disabled)
├── lib/modalPersistence.ts                 # SessionStorage utilities  
├── components/ui/
│   ├── modal-manager.tsx                    # Global state management
│   ├── minimized-modal-bar.tsx             # Bottom taskbar component
│   ├── draggable-modal-wrapper.tsx         # Modal wrapper (drag disabled)
│   ├── dialog.tsx                          # Enhanced Dialog component
│   ├── alert-dialog.tsx                    # Enhanced AlertDialog component
│   └── sheet.tsx                           # Enhanced Sheet component
├── styles/modal-drag.css                   # CSS animations and styling
└── tests/e2e/modal-drag-minimize.spec.ts   # Comprehensive test suite
```

**Component Integration Pattern:**

The system maintains backward compatibility with existing modal implementations:

```tsx
// Before
<DialogContent>
  {/* content */}
</DialogContent>

// After (with minimize support, dragging disabled)
<DraggableDialogContent 
  draggable={true}           // Enables modal wrapper
  allowDragging={false}      // Disables actual dragging
  draggableConfig={{ id: 'unique-id' }}
>
  {/* content */}
</DraggableDialogContent>
```

### State Management

**Global State Architecture:**
- **ModalManagerProvider**: React Context + useReducer for modal coordination
- **Local State**: Individual hooks for drag/minimize behavior per modal
- **Persistence Layer**: SessionStorage with automatic cleanup
- **Performance**: Throttled position updates, efficient event handling

**Key Actions:**
- `REGISTER_MODAL`: Register new modal with system
- `UNREGISTER_MODAL`: Remove modal from system
- `SET_MODAL_VISIBILITY`: Hide/show modal without unregistering
- `MINIMIZE_MODAL`: Move modal to minimized state
- `RESTORE_MODAL`: Return modal to active state
- `UPDATE_POSITION`: Update modal position during drag

### Configuration Options

```tsx
interface ModalDragAndMinimizeConfig {
  id: string;                         // Unique identifier (required)
  title: string;                      // For title bar and minimized display
  icon?: ComponentType | string;      // For minimized display
  defaultPosition?: { x: number; y: number }; // Auto-calculated if not provided
  persistent?: boolean;               // Default: false
}

// Component props
interface ModalProps {
  draggable?: boolean;                // Enables modal wrapper (default: false)
  allowDragging?: boolean;            // Controls drag functionality (default: false)
  draggableConfig?: ModalDragAndMinimizeConfig;
}
```

### Implementation Examples

**New Consultation Modal:**
```tsx
<DraggableDialogContent 
  draggable={true}
  allowDragging={false}  // Dragging disabled
  draggableConfig={{
    id: 'new-consultation',
    title: 'New Consultation',
    persistent: false,
  }}
>
  {/* Form content */}
</DraggableDialogContent>
```

**Consultation Panel (Complex Clinical Workflow):**
```tsx
<DraggableModalWrapper
  allowDragging={false}  // Dragging disabled
  config={{
    id: `consultation-${encounterId}`,
    title: `Consultation - ${patient?.full_name}`,
    persistent: false,
  }}
>
  <Card className="w-full max-w-6xl bg-background/95">
    {/* Clinical interface content */}
  </Card>
</DraggableModalWrapper>
```

### Visual Design

**Glass Morphism Styling:**
- Semi-transparent backgrounds with backdrop blur effects
- Subtle shadows and border styling for depth
- Smooth CSS transitions for state changes
- Consistent with application's overall design language

**Animation System:**
- CSS transitions for smooth movement during drag operations
- Entrance/exit animations for minimize/restore actions
- Hover effects for interactive elements (minimize button, taskbar items)
- Performance-optimized using CSS transforms

### Best Practices

**1. Unique Modal IDs:** Always provide a unique `id` for proper state management
```tsx
// Good
id: `consultation-${encounterId}`

// Avoid  
id: 'consultation' // Multiple instances conflict
```

**2. Meaningful Titles:** Use descriptive titles for minimized display
```tsx
title: `Consultation - ${patient?.full_name}`
// Better than: title: 'Modal'
```

**3. Container Architecture:** Render `DraggableModalWrapper` directly without intermediate containers
```tsx
// Correct
<DraggableModalWrapper>
  <Card>Content</Card>
</DraggableModalWrapper>

// Incorrect - breaks coordinate system
<div className="fixed inset-0">
  <div>
    <DraggableModalWrapper>
      <Card>Content</Card>
    </DraggableModalWrapper>
  </div>
</div>
```

**4. Disable Dragging:** Always set `allowDragging={false}` to prevent positioning issues
```tsx
// Correct - dragging disabled
<DraggableDialogContent 
  draggable={true}
  allowDragging={false}
  draggableConfig={{ id: 'modal-id', title: 'Modal Title' }}
/>

// Note: Automatic centering handles positioning without manual calculations
```

### Performance Optimizations

**Efficient Event Handling:**
- Automatic event listener cleanup on component unmount
- Minimal DOM manipulations using CSS transforms  
- Background state persistence without blocking UI
- Focus management and keyboard accessibility optimizations

**Memory Management:**
- SessionStorage data automatically expires after 24 hours
- Modal state cleaned up on component unmount
- Efficient React context usage prevents unnecessary re-renders
- No memory leaks in drag event handling

### Browser Compatibility

**Supported Browsers:**
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Progressive enhancement for older browsers
- Core modal functionality works without drag features as fallback
- Touch device support for mobile and tablet usage

### Testing

**Comprehensive Test Suite:**
- End-to-end tests with Playwright (`tests/e2e/modal-drag-minimize.spec.ts`)
- Tests cover drag operations, minimize/restore, keyboard shortcuts
- Cross-page persistence validation
- Multiple modal scenarios and edge cases
- Accessibility compliance verification

**Test Coverage Includes:**
- Modal dragging to different viewport positions
- Minimize and restore operations
- Keyboard shortcuts (`Ctrl+M`, `Escape`)
- Position persistence across page reloads
- Cross-page navigation with minimized modals
- Multiple modal management
- Viewport constraint enforcement

### Troubleshooting Common Issues

**Modal Not Centering:**
- Verify `defaultPosition` calculation matches actual modal dimensions
- Ensure parent containers don't interfere with positioning

**Minimize Button Not Working:**
- Check that `canMinimize` is set to `true` in config
- Verify `ModalManagerProvider` is included in app layout

**Position Not Persisting:**
- Confirm `persistPosition` is enabled (default: true)
- Check browser sessionStorage is not disabled
- Verify unique `modalId` is provided

**Drag Not Working:**
- Ensure `draggable` prop is set to `true`
- Check that drag handle area (title bar) is properly configured
- Verify no CSS interference with pointer events

### Integration Requirements

**App Layout Setup:**
```tsx
// Required in layout.tsx or root component
import { ModalManagerProvider } from '@/components/ui/modal-manager';
import MinimizedModalBar from '@/components/ui/minimized-modal-bar';

export default function RootLayout({ children }) {
  return (
    <ModalManagerProvider>
      {children}
      <MinimizedModalBar />
    </ModalManagerProvider>
  );
}
```

**CSS Dependencies:**
```css
/* Required styles in styles/modal-drag.css */
@import './modal-drag.css';
```

This implementation provides a robust, accessible, and user-friendly modal system that significantly enhances the clinical workflow experience by allowing clinicians to manage multiple consultation windows effectively.

## Editable Fields System

### Overview
The application includes a comprehensive editable fields system that allows users to edit encounter data directly in the workspace without requiring page refreshes.

### Architecture
- **useEditableEncounterFields**: Custom hook managing field updates
- **EditableSection**: Base wrapper component with edit controls
- **Field-specific components**: EditableTextField, EditableDateTimeField, SOAPNoteEditor, etc.

### Editable Field Components

#### EditableTextField
- Supports single-line and multiline text input
- Includes validation and error handling
- Features undo/redo functionality
- Auto-saves on user action

#### EditableDateTimeField  
- Date and time picker with validation
- Supports scheduled and actual encounter times
- Proper timezone handling

#### SOAPNoteEditor
- Rich text editor for SOAP notes
- Parses structured S/O/A/P sections
- Individual section editing
- Reconstructs full SOAP note on save

### Data Flow and Cache Management

#### Issue Resolution (Fixed)
Previously, edited fields would not show new values until page refresh, and sometimes changes weren't saved. This has been resolved through:

1. **Improved Cache Invalidation**:
   ```typescript
   // Clear cached data after successful update
   supabaseDataService.clearDemoPatientData(patientId);
   await supabaseDataService.loadPatientData();
   ```

2. **Custom Event System**:
   ```typescript
   // Trigger UI updates via custom events
   const changeEvent = new CustomEvent('supabase-data-change', { 
     detail: { patientId, encounterId, fieldName, newValue } 
   });
   window.dispatchEvent(changeEvent);
   ```

3. **Local State Updates**:
   ```typescript
   // Immediate UI feedback via success callbacks
   onSuccess: (updatedEncounter) => {
     // Update local state immediately
     setDetailedPatientData(prevData => {
       // Update encounter data...
     });
   }
   ```

### Currently Editable Fields

#### Consultation Tab (ConsolidatedConsultationTab)
- ✅ Reason for visit (EditableTextField - multiline)
- ✅ Scheduled start datetime (EditableDateTimeField)
- ✅ Scheduled end datetime (EditableDateTimeField)
- ✅ Actual start datetime (EditableDateTimeField)
- ✅ Actual end datetime (EditableDateTimeField)
- ✅ Insurance status (EditableTextField)
- ✅ SOAP notes (SOAPNoteEditor - structured sections)
- ✅ Prior authorization justification (EditableTextField - multiline)
- ✅ Transcript (via TranscriptEditorModal)

#### All Data View Tab (AllDataViewTab)
- ⚠️ Currently read-only, needs editable field integration
- Demographics: Static display only
- Encounter history: Static display with restore/delete functionality

### Field Validation
- Required field validation for critical data
- Type-safe input validation
- Custom validation rules per field type
- Real-time error feedback

### User Experience Features
- Hover-to-edit discovery pattern
- Inline edit controls (save/cancel/undo/redo)
- Keyboard shortcuts (Ctrl+Enter to save, Escape to cancel)
- Unsaved changes warnings
- Loading states during save operations
- Success/error toast notifications

### Error Handling
- Network error recovery
- Optimistic updates with rollback
- User-friendly error messages
- Graceful degradation

## Development Guidelines

### Component Structure
Follow atomic design principles:
```
components/
├── ui/           # Atoms (buttons, inputs, etc.)
├── layout/       # Molecules (headers, sidebars)
├── modals/       # Organisms (complete modal experiences)
└── views/        # Templates (full page layouts)
```

### State Management
- Local component state for UI interactions
- Custom hooks for business logic
- Context providers for global state
- Supabase for persistent data

### Styling Guidelines
- Use Tailwind CSS utility classes
- Follow design system tokens
- Implement glass morphism consistently
- Ensure mobile responsiveness

### Testing
- Unit tests for utility functions
- Component tests for UI interactions
- Integration tests for data flows
- E2E tests for critical user journeys

## Performance Considerations

### Data Loading
- Lazy loading for large datasets
- Optimistic updates for better UX
- Proper cache invalidation strategies
- Error boundaries for graceful failures

### Bundle Optimization
- Code splitting by route
- Dynamic imports for heavy components
- Tree shaking for unused code
- Asset optimization

## Troubleshooting

### Common Issues

#### Fields Not Updating After Save
**Fixed**: This was caused by insufficient cache invalidation. The solution included:
- Proper cache clearing in useEditableEncounterFields
- Custom event system for cross-component updates
- Immediate local state updates via success callbacks

#### Slow Field Updates
- Check network requests in DevTools
- Verify proper data service caching
- Ensure minimal re-renders

#### Validation Errors
- Check field validation rules
- Verify required field constraints
- Test edge cases (empty values, special characters)

### Development Tools
- React DevTools for component debugging
- Network tab for API call analysis
- Supabase dashboard for data verification
- TypeScript compiler for type checking
