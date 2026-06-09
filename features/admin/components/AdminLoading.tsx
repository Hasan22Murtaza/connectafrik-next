import {
  AdminDashboardSkeleton,
  AdminDisputesPageSkeleton,
  AdminOrderDetailSkeleton,
  AdminOrdersPageSkeleton,
  AdminPayoutsPageSkeleton,
  AdminSidebarSkeleton,
  AdminTableSkeleton,
} from "./skeletons/AdminShimmerLoaders";

type AdminLoadingVariant =
  | "dashboard"
  | "orders"
  | "order-detail"
  | "payouts"
  | "disputes"
  | "table"
  | "sidebar";

const VARIANT_MAP: Record<AdminLoadingVariant, React.ReactNode> = {
  dashboard: <AdminDashboardSkeleton />,
  orders: <AdminOrdersPageSkeleton />,
  "order-detail": <AdminOrderDetailSkeleton />,
  payouts: <AdminPayoutsPageSkeleton />,
  disputes: <AdminDisputesPageSkeleton />,
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
