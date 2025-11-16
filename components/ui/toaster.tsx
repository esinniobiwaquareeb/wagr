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
        // Normalize title and description - handle empty strings, null, undefined
        const normalizedTitle = title && String(title).trim() ? String(title).trim() : null;
        const normalizedDescription = description && String(description).trim() ? String(description).trim() : null;
        
        // Only skip if both title and description are empty/null/undefined and no action
        const hasContent = normalizedTitle || normalizedDescription || action;
        
        if (!hasContent) {
          return null;
        }
        
        // Ensure at least title or description exists for display
        // For destructive toasts, always show something meaningful
        const displayTitle = normalizedTitle || (props.variant === 'destructive' ? "Something went wrong" : "Notification");
        const displayDescription = normalizedDescription || (normalizedTitle ? undefined : (props.variant === 'destructive' ? "Please try again or contact support if the problem persists." : "An error occurred"));
        
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
