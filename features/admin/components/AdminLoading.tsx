import {
  AdminDashboardSkeleton,
  AdminMonitoringSkeleton,
  AdminSidebarSkeleton,
  AdminTableSkeleton,
  AdminUserDetailSkeleton,
  AdminUsersPageSkeleton,
} from "./skeletons/AdminShimmerLoaders";

type AdminLoadingVariant =
  | "dashboard"
  | "monitoring"
  | "users"
  | "user-detail"
  | "table"
  | "sidebar";

const VARIANT_MAP: Record<AdminLoadingVariant, React.ReactNode> = {
  dashboard: <AdminDashboardSkeleton />,
  monitoring: <AdminMonitoringSkeleton />,
  users: <AdminUsersPageSkeleton />,
  "user-detail": <AdminUserDetailSkeleton />,
  table: <AdminTableSkeleton />,
  sidebar: <AdminSidebarSkeleton />,
};

export function AdminLoading({
  variant = "dashboard",
}: {
  variant?: AdminLoadingVariant;
  message?: string;
}) {
  return <>{VARIANT_MAP[variant]}</>;
}
