import { AdminHeader } from "@/features/admin/components/AdminHeader";
import { AdminMobileNav, AdminSidebar } from "@/features/admin/components/AdminSidebar";
import { AdminShellProvider } from "@/features/admin/context/AdminShellContext";
import { AP } from "@/features/admin/constants/adminLayout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminShellProvider>
      <div className={AP.page}>
        <AdminHeader />
        <AdminMobileNav />
        <div className={AP.shell}>
          <AdminSidebar />
          <main className={`${AP.main} min-h-[calc(100vh-4rem)]`}>{children}</main>
        </div>
      </div>
    </AdminShellProvider>
  );
}
