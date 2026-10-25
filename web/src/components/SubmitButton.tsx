"use client";

import { useFormStatus } from "react-dom";
import { IconSpinner } from "./Icons";

// A form's submit button that shows it is working and refuses a second tap while the action runs.
// Keeps its size and colour; the spinner takes the icon's place and the label turns into "Đang …".
export function SubmitButton({
  children,
  pendingLabel = "Đang gửi…",
  className = "btn btn-accent",
  disabled,
  iconOnly,
  spinnerSize = 18,
  ariaLabel,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  iconOnly?: boolean;
  spinnerSize?: number;
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      aria-label={pending && iconOnly ? pendingLabel : ariaLabel}
      style={pending ? { opacity: 0.85, cursor: "wait" } : undefined}
    >
      {pending ? (
        <>
          <IconSpinner size={spinnerSize} className="spin" />
          {!iconOnly && pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

// Fades and locks whatever it wraps while the surrounding form is pending (the "Trả lại" label next to "Duyệt").
export function Dim({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <span className={className} style={pending ? { opacity: 0.45, pointerEvents: "none" } : undefined}>
      {children}
    </span>
  );
}
