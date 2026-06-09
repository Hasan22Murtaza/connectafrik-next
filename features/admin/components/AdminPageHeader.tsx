import type { LucideIcon } from "lucide-react";
import { AdminMotion } from "./AdminMotion";

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
    <AdminMotion className="flex items-start justify-between gap-4 mb-6 sm:mb-8 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
          {Icon && (
            <span className="p-2 rounded-xl bg-gradient-to-br from-primary-50 to-orange-50 shrink-0">
              <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" aria-hidden="true" />
            </span>
          )}
          <span className="truncate">{title}</span>
        </h1>
        {description && (
          <p className="text-sm sm:text-base text-gray-500 mt-2 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </AdminMotion>
  );
}
