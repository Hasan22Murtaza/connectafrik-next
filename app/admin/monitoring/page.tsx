import { redirect } from "next/navigation";

/** Moderation/monitoring content now lives on Dashboard + Reports. */
export default function AdminMonitoringRedirectPage() {
  redirect("/admin/dashboard");
}
