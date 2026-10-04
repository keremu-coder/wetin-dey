import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "outline";
}) {
  const styles = {
    primary: "bg-accent text-white hover:opacity-90",
    ghost: "bg-transparent text-ink hover:bg-black/5",
    danger: "bg-red-800 text-white hover:opacity-90",
    outline: "border border-ink/20 bg-white hover:bg-black/5"
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-3 text-base font-medium disabled:opacity-50",
        styles,
        className
      )}
      {...props}
    />
  );
}
