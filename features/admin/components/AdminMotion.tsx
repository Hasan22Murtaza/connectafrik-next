"use client";

interface AdminMotionProps {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
  /** @deprecated No longer used — animations removed. */
  variant?: string;
  /** @deprecated No longer used — animations removed. */
  delay?: number;
}

export function AdminMotion({
  children,
  className = "",
  as: Tag = "div",
}: AdminMotionProps) {
  return <Tag className={className}>{children}</Tag>;
}

interface AdminStaggerProps {
  children: React.ReactNode[];
  className?: string;
  /** @deprecated No longer used — animations removed. */
  baseDelay?: number;
  /** @deprecated No longer used — animations removed. */
  staggerMs?: number;
}

export function AdminStagger({ children, className = "" }: AdminStaggerProps) {
  return <div className={className}>{children}</div>;
}
