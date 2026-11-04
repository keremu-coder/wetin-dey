import type { TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-md border border-ink/20 bg-white px-3 py-3 text-base text-ink",
        props.className
      )}
    />
  );
}
