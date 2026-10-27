import { AdminHeader } from "@/features/admin/components/AdminHeader";
import { AdminSidebar } from "@/features/admin/components/AdminSidebar";
import { AdminShellProvider } from "@/features/admin/context/AdminShellContext";
import { AP } from "@/features/admin/constants/adminLayout";
import { getNoIndexMetadata } from "@/lib/seo";

export const metadata = getNoIndexMetadata("Admin");

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminShellProvider>
      <div className={AP.page}>
        <div className={AP.shell}>
          <AdminSidebar />
          <div className="relative z-0 flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden bg-white">
            <AdminHeader />
            <main className={AP.main}>{children}</main>
          </div>
        </div>
      </div>
    </AdminShellProvider>
  );
}
