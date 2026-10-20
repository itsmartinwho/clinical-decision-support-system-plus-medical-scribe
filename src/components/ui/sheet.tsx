"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from '@phosphor-icons/react';

import { cn } from "@/lib/utils"
import { DraggableModalWrapper } from './draggable-modal-wrapper';
import { ModalDragAndMinimizeConfig } from '@/types/modal';

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 glass-backdrop data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-card border-border p-6 shadow-float transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-250 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

// Draggable Sheet Components
interface DraggableSheetContentProps extends Omit<React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>, 'className'> {
  draggableConfig: ModalDragAndMinimizeConfig;
  className?: string;
  onClose?: () => void;
  showMinimizeButton?: boolean;
  showCloseButton?: boolean;
  side?: VariantProps<typeof sheetVariants>['side'];
}

const DraggableSheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  DraggableSheetContentProps
>(({ 
  className, 
  children, 
  draggableConfig,
  onClose,
  showMinimizeButton = true,
  showCloseButton = true,
  side = "right",
  ...props 
}, ref) => {
  // Calculate initial position based on side
  const getInitialPosition = () => {
    const viewport = {
      width: typeof window !== 'undefined' ? window.innerWidth : 1200,
      height: typeof window !== 'undefined' ? window.innerHeight : 800,
    };
    
    switch (side) {
      case 'left':
        return { x: 50, y: (viewport.height - 600) / 2 };
      case 'right':
        return { x: viewport.width - 450, y: (viewport.height - 600) / 2 };
      case 'top':
        return { x: (viewport.width - 600) / 2, y: 50 };
      case 'bottom':
        return { x: (viewport.width - 600) / 2, y: viewport.height - 450 };
      default:
        return { x: (viewport.width - 600) / 2, y: (viewport.height - 600) / 2 };
    }
  };

  const configWithPosition = {
    ...draggableConfig,
    defaultPosition: draggableConfig.defaultPosition || getInitialPosition(),
  };

  return (
    <SheetPortal>
      <SheetOverlay />
      <div className="fixed inset-0 z-50 pointer-events-none">
        <DraggableModalWrapper
          config={configWithPosition}
          onClose={onClose}
          className={cn(
            "pointer-events-auto",
            side === 'left' || side === 'right' ? 'w-3/4 max-w-sm h-full max-h-[90vh]' : '',
            side === 'top' || side === 'bottom' ? 'w-full max-w-4xl h-3/4 max-h-sm' : '',
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className
          )}
          showMinimizeButton={showMinimizeButton}
          showCloseButton={showCloseButton}
        >
          <SheetPrimitive.Content
            ref={ref}
            className="w-full h-full outline-none"
            {...props}
          >
            {children}
          </SheetPrimitive.Content>
        </DraggableModalWrapper>
      </div>
    </SheetPortal>
  )
});
DraggableSheetContent.displayName = "DraggableSheetContent";

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  DraggableSheetContent,
}
