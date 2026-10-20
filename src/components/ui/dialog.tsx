"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X, Minus } from '@phosphor-icons/react';
import ReactDOM from 'react-dom';

import { cn } from "@/lib/utils"
import { DraggableModalWrapper } from './draggable-modal-wrapper';
import { ModalDragAndMinimizeConfig } from '@/types/modal';
import { useModalDragAndMinimize } from '@/hooks/useModalDragAndMinimize';

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[9999] modal-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "flex items-center justify-center p-4",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <div className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none">
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "relative grid w-[calc(100vw-1.5rem)] max-w-lg max-h-[calc(100svh-2rem)] overflow-y-auto gap-4 rounded-xl p-5 sm:p-6 modal-glass pointer-events-auto sm:w-full sm:min-w-[min(672px,calc(100vw-3rem))]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </div>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "font-display text-2xl font-normal leading-tight tracking-[-0.01em]",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

// Draggable Dialog Components
interface DraggableDialogContentProps extends Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, 'className'> {
  draggable?: boolean;
  allowDragging?: boolean;
  draggableConfig?: ModalDragAndMinimizeConfig;
  className?: string;
  onClose?: () => void;
  showMinimizeButton?: boolean;
  showCloseButton?: boolean;
}

const DraggableDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DraggableDialogContentProps
>(({ 
  className, 
  children, 
  draggable = false,
  allowDragging = true,
  draggableConfig,
  onClose,
  showMinimizeButton = true,
  showCloseButton = true,
  ...props 
}, ref) => {
  const { onOpenAutoFocus, onCloseAutoFocus, onInteractOutside, ...restProps } = props;

  if (!draggable || !draggableConfig) {
    return (
      <DialogPortal>
        <DialogOverlay />
        <div className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none">
          <DialogPrimitive.Content 
            ref={ref}
            className={cn(
              "relative grid w-[calc(100vw-1.5rem)] max-w-lg max-h-[calc(100svh-2rem)] overflow-y-auto gap-4 rounded-xl p-5 sm:p-6 modal-glass pointer-events-auto sm:w-full sm:min-w-[min(672px,calc(100vw-3rem))]",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              className
            )} 
            onOpenAutoFocus={onOpenAutoFocus}
            onCloseAutoFocus={onCloseAutoFocus}
            onInteractOutside={onInteractOutside}
            {...restProps}
          >
            {children}
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </div>
      </DialogPortal>
    );
  }

  // Draggable dialogs now use DialogPrimitive.Content inside a positioned wrapper
  // No overlay for draggable modals to prevent interference with positioning and events
  return (
    <DialogPortal>
      <DraggablePositionedContent
        ref={ref}
        className={className}
        draggableConfig={draggableConfig}
        allowDragging={allowDragging}
        showMinimizeButton={showMinimizeButton}
        showCloseButton={showCloseButton}
        {...props}
      >
        {children}
      </DraggablePositionedContent>
    </DialogPortal>
  );
});

DraggableDialogContent.displayName = "DraggableDialogContent";

interface DraggablePositionedContentProps extends DraggableDialogContentProps {
  allowDragging?: boolean;
}

const DraggablePositionedContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DraggablePositionedContentProps
>(({
  className,
  children,
  draggableConfig,
  allowDragging = true,
  showMinimizeButton,
  showCloseButton,
  onInteractOutside,
  ...props
}, ref) => {
  // Always call hooks first, before any conditional logic
  const modalDragResult = useModalDragAndMinimize(draggableConfig, allowDragging);
  
  // Memoize props to prevent infinite re-renders - always call useMemo
  const stableContainerProps = React.useMemo(() => {
    if (!draggableConfig || !modalDragResult.containerProps) {
      return { className: "fixed draggable-modal-container", style: {} };
    }
    return {
      ...modalDragResult.containerProps,
      className: "fixed draggable-modal-container",
      style: { ...modalDragResult.containerProps.style }
    };
  }, [draggableConfig, modalDragResult.containerProps]);

  const stableDragHandleProps = React.useMemo(() => {
    if (!draggableConfig || !modalDragResult.dragHandleProps) {
      return {
        className: `modal-title-bar flex items-center justify-between px-5 py-3 border-b border-border ${allowDragging ? 'cursor-move' : 'cursor-default'}`,
        'data-testid': "modal-title-bar"
      };
    }
    return {
      ...modalDragResult.dragHandleProps,
      className: `modal-title-bar flex items-center justify-between px-5 py-3 border-b border-border ${allowDragging ? 'cursor-move' : 'cursor-default'}`,
      'data-testid': "modal-title-bar"
    };
  }, [draggableConfig, modalDragResult.dragHandleProps, allowDragging]);
  
  const handleClose = React.useCallback(() => {
    const trigger = document.querySelector(`[aria-controls="${props['aria-describedby']}"]`);
    if (trigger instanceof HTMLElement) {
      trigger.click();
    }
  }, [props]);

  // Early return after all hooks are called
  if (!draggableConfig) return null;

  const { isMinimized, isDragging, minimize } = modalDragResult;

  if (isMinimized) {
    return null;
  }

  return (
    <div {...stableContainerProps}>
      <DialogPrimitive.Content
        ref={ref}
        {...props}
        id={draggableConfig.id}
        className={cn(
          "modal-glass rounded-xl overflow-hidden flex flex-col w-full",
          // Remove max-w-lg constraint for better formatting
          isDragging && "modal-dragging",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "pointer-events-auto",
          className
        )}
        onCloseAutoFocus={e => e.preventDefault()}
        onOpenAutoFocus={e => e.preventDefault()}
        onInteractOutside={onInteractOutside}
      >
        <div {...stableDragHandleProps}>
          <h3 className="m-0 pointer-events-none">
            {draggableConfig.title || ''}
          </h3>
          <div className="flex items-center gap-2 ml-4 relative z-10">
            {showMinimizeButton && (
              <button
                onClick={minimize}
                className="modal-control-btn"
                aria-label="Minimize modal"
              >
                <Minus className="w-4 h-4" />
              </button>
            )}
            <DialogPrimitive.Close asChild>
              <button
                className="modal-control-btn"
                aria-label="Close modal"
              >
                <X className="w-4 w-4" />
              </button>
            </DialogPrimitive.Close>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </DialogPrimitive.Content>
    </div>
  );
});

DraggablePositionedContent.displayName = 'DraggablePositionedContent';

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DraggableDialogContent,
}
