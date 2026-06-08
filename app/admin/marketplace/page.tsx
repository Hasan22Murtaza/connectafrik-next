"use client";

import Link from "next/link";
import { LayoutDashboard, Shield, DollarSign, Settings } from "lucide-react";

const links = [
  {
    href: "/admin/marketplace/dashboard",
    title: "Dashboard",
    description: "GMV, escrow, payouts, and multi-currency reporting",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/marketplace/disputes",
    title: "Disputes",
    description: "Review and resolve buyer-seller disputes",
    icon: Shield,
  },
];

export default function AdminMarketplaceHubPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Marketplace Admin</h1>
        <p className="text-sm text-gray-600 mb-8">
          Manage the ConnectAfrik marketplace financial operations.
        </p>

        <div className="grid gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-300 hover:shadow-sm transition-all flex items-start gap-4"
            >
              <link.icon className="w-6 h-6 text-primary-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">{link.title}</p>
                <p className="text-sm text-gray-600 mt-1">{link.description}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium flex items-center gap-2 mb-1">
            <Settings className="w-4 h-4" /> Admin access
          </p>
          Set <code className="bg-blue-100 px-1 rounded">MARKETPLACE_ADMIN_USER_IDS</code> in .env
          or assign <code className="bg-blue-100 px-1 rounded">platform_role = admin</code> on profiles.
        </div>
      </div>
    </div>
  );
}
