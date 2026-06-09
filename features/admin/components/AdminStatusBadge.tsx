const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  approved: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
  open: "bg-orange-50 text-orange-700",
  held: "bg-purple-50 text-purple-700",
  scheduled: "bg-indigo-50 text-indigo-700",
  frozen: "bg-red-50 text-red-700",
  released: "bg-green-50 text-green-700",
  refunded: "bg-gray-100 text-gray-600",
  active: "bg-green-50 text-green-700",
  suspended: "bg-red-50 text-red-700",
  verified: "bg-blue-50 text-blue-700",
  unverified: "bg-gray-100 text-gray-600",
  buyer: "bg-sky-50 text-sky-700",
  seller: "bg-violet-50 text-violet-700",
  both: "bg-indigo-50 text-indigo-700",
  none: "bg-gray-100 text-gray-600",
};

export function AdminStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-gray-400 text-xs">—</span>;

  const key = status.toLowerCase().replace(/\s+/g, "_");
  const style = STATUS_STYLES[key] ?? "bg-gray-100 text-gray-700";

  return (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ring-1 ring-inset ring-black/5 ${style}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
