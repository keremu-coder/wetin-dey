import type { InputHTMLAttributes } from "react";

export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-h-[44px] items-start gap-3 text-base">
      <input type="checkbox" className="mt-1 h-5 w-5" {...props} />
      <span>{label}</span>
    </label>
  );
}
