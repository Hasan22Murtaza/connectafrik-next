import type { LucideIcon } from "lucide-react";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export function AdminPageHeader({
  title,
  description,
  icon: Icon,
  action,
}: AdminPageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          {Icon && <Icon className="w-6 h-6 text-primary-600 shrink-0" />}
          {title}
        </h1>
        {description && (
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
