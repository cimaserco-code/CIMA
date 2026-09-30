import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastProvider,
  ToastDescription,
  ToastTitle,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, open, ...props }) {
        return (
          <Toast key={id} open={open} {...props}>
            <div className="grid gap-1 pr-6 flex-1 min-w-0">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>

            {action}
            <ToastClose
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dismiss(id);
              }}
            />
          </Toast>
        );
      })}
    </ToastProvider>
  );
}