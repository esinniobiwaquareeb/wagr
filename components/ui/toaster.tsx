'use client'

import { useToast } from '@/hooks/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Always render if there's a title or description (even if empty string, show something)
        // Only skip if both are explicitly null/undefined
        const hasContent = title != null || description != null || action != null;
        
        if (!hasContent) {
          return null;
        }
        
        // Ensure at least title or description exists for display
        const displayTitle = title || "Notification";
        const displayDescription = description || (title ? undefined : "An error occurred");
        
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {displayTitle && <ToastTitle>{displayTitle}</ToastTitle>}
              {displayDescription && (
                <ToastDescription>{displayDescription}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
