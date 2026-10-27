import type { LucideIcon } from "@/shared/icons";

interface AdminEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: AdminEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center px-6 py-14 text-center"
      role="status"
      aria-label={title}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
        <Icon className="h-5 w-5 text-gray-400" aria-hidden="true" />
      </div>
      <h3 className="mb-1 text-sm font-medium text-gray-900">{title}</h3>
      {description && (
        <p className="mb-4 max-w-sm text-sm text-gray-500">{description}</p>
      )}
      {action}
    </div>
  );
}
