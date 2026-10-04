import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-md border border-ink/20 bg-white px-3 py-3 text-base text-ink",
        props.className
      )}
    />
  );
}
