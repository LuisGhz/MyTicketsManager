import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface PageWrapperProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function PageWrapper({
  children,
  className,
  id = "main-content",
  ...props
}: PageWrapperProps) {
  return (
    <main
      id={id}
      className={cn("mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", className)}
      {...props}
    >
      {children}
    </main>
  );
}
