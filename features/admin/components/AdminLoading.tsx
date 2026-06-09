import {
  AdminDashboardSkeleton,
  AdminDisputesPageSkeleton,
  AdminOrderDetailSkeleton,
  AdminOrdersPageSkeleton,
  AdminPayoutsPageSkeleton,
  AdminSidebarSkeleton,
  AdminTableSkeleton,
  AdminUserDetailSkeleton,
  AdminUsersPageSkeleton,
} from "./skeletons/AdminShimmerLoaders";

type AdminLoadingVariant =
  | "dashboard"
  | "orders"
  | "order-detail"
  | "payouts"
  | "disputes"
  | "users"
  | "user-detail"
  | "table"
  | "sidebar";

const VARIANT_MAP: Record<AdminLoadingVariant, React.ReactNode> = {
  dashboard: <AdminDashboardSkeleton />,
  orders: <AdminOrdersPageSkeleton />,
  "order-detail": <AdminOrderDetailSkeleton />,
  payouts: <AdminPayoutsPageSkeleton />,
  disputes: <AdminDisputesPageSkeleton />,
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
