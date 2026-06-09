import { AdminHeader } from "@/features/admin/components/AdminHeader";
import { AdminMobileNav, AdminSidebar } from "@/features/admin/components/AdminSidebar";
import { MP } from "@/features/marketplace/constants/marketplaceLayout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <AdminHeader />
      <AdminMobileNav />
      <div className={MP.shellFull}>
        <AdminSidebar />
        <main className={`${MP.main} w-full min-h-[calc(100vh-4rem)]`}>
          {children}
        </main>
      </div>
    </div>
  );
}
