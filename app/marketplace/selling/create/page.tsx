"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lightbulb, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import CreateProductForm from "@/features/marketplace/components/CreateProductForm";
import MarketplaceHubNav from "@/features/marketplace/components/MarketplaceHubNav";
import { MarketplaceGridShimmer } from "@/shared/components/ui/ShimmerLoaders";

const CreateListingPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/signin?redirect=/marketplace/selling/create");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen px-4 py-6">
        <MarketplaceGridShimmer count={4} />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pb-8">
      <div className="flex gap-4 min-w-0 w-full max-w-screen-2xl mx-auto">
        <aside className="hidden lg:block w-[240px] shrink-0 py-6">
          <button
            type="button"
            onClick={() => router.push("/marketplace/selling")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 text-sm px-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Your listings
          </button>

        </aside>

        <main className="flex-1 py-6 min-w-0 max-w-3xl">
          <div className="lg:hidden mb-6">
            <button
              type="button"
              onClick={() => router.push("/marketplace/selling")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to listings
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Create listing</h1>
           
          </div>

          <div className="hidden lg:block mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Create listing</h1>
           
          </div>

          <CreateProductForm
            onCancel={() => router.push("/marketplace/selling")}
            onSuccess={() => router.push("/marketplace/selling")}
          />
        </main>

        <aside className="hidden xl:block w-[280px] shrink-0 py-6">
          <div className="sticky top-6 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-2">Listing tips</h3>
                  <ul className="text-xs text-gray-600 space-y-2">
                    <li>Use clear, well-lit photos from multiple angles.</li>
                    <li>Write a descriptive title with key details.</li>
                    <li>Set a fair price in your local currency.</li>
                    <li>Add your city so nearby buyers can find you.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 text-sm mb-1">Stay safe</h3>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Meet in public places, never share payment details in chat, and use
                    ConnectAfrik checkout for buyer protection.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CreateListingPage;
