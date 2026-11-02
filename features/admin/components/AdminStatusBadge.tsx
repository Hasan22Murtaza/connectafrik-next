const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  under_review: "bg-orange-50 text-orange-800 border-orange-200",
  resolved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  dismissed: "bg-gray-50 text-gray-600 border-gray-200",
  processing: "bg-sky-50 text-sky-800 border-sky-200",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-gray-50 text-gray-600 border-gray-200",
  open: "bg-orange-50 text-orange-800 border-orange-200",
  active: "bg-emerald-50 text-emerald-800 border-emerald-200",
  suspended: "bg-red-50 text-red-700 border-red-200",
  verified: "bg-sky-50 text-sky-800 border-sky-200",
  unverified: "bg-gray-50 text-gray-600 border-gray-200",
  new: "bg-sky-50 text-sky-800 border-sky-200",
  planned: "bg-violet-50 text-violet-800 border-violet-200",
  in_progress: "bg-indigo-50 text-indigo-800 border-indigo-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  ringing: "bg-amber-50 text-amber-800 border-amber-200",
  initiated: "bg-sky-50 text-sky-800 border-sky-200",
  ended: "bg-gray-50 text-gray-600 border-gray-200",
  missed: "bg-orange-50 text-orange-800 border-orange-200",
  declined: "bg-rose-50 text-rose-700 border-rose-200",
  healthy: "bg-emerald-50 text-emerald-800 border-emerald-200",
  degraded: "bg-amber-50 text-amber-800 border-amber-200",
  down: "bg-red-50 text-red-700 border-red-200",
  unknown: "bg-gray-50 text-gray-600 border-gray-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  info: "bg-sky-50 text-sky-800 border-sky-200",
  published: "bg-emerald-50 text-emerald-800 border-emerald-200",
  removed: "bg-red-50 text-red-700 border-red-200",
  listed: "bg-sky-50 text-sky-800 border-sky-200",
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-800 border-orange-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  low: "bg-sky-50 text-sky-800 border-sky-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
  read: "bg-gray-50 text-gray-600 border-gray-200",
  unread: "bg-primary-50 text-primary-700 border-primary-200",
  unavailable: "bg-gray-50 text-gray-600 border-gray-200",
};

export function AdminStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-xs text-gray-400">—</span>;

  const key = status.toLowerCase().replace(/\s+/g, "_");
  const style = STATUS_STYLES[key] ?? "bg-gray-50 text-gray-700 border-gray-200";

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
