"use client";

import { PeopleYouMayKnow } from "@/features/social/components/PeopleYouMayKnow";
import { ArrowLeft, Users } from "lucide-react";
import { useRouter } from "next/navigation";

export default function MobileFriendsPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen bg-white">
      
      <main className="flex-1 w-full px-4 py-6">
        {/* Back Button */}
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-gray-700 hover:text-[#FF6900] mb-6 transition-colors font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3 mb-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Users className="w-6 h-6" style={{ color: "#FF6900" }} />
            </div>
            Find Friends
          </h1>
          <p className="text-gray-600">
            Discover and connect with people you may know
          </p>
        </div>

        {/* People You May Know Section */}
        <div className="mb-8">
          <PeopleYouMayKnow />
        </div>

        {/* Additional sections can be added here */}
        <div className="bg-gray-50 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Connect with ConnectAfrik
          </h2>
          <p className="text-gray-600 mb-6 text-sm">
            Build your network by connecting with friends, colleagues, and people who share your interests.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-white rounded-lg border border-orange-200 hover:border-orange-300 transition-colors">
              <div className="bg-orange-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6" style={{ color: "#FF6900" }} />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">Find Friends</h3>
              <p className="text-xs text-gray-600 mt-1">Connect with people you know</p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg border border-green-200 hover:border-green-300 transition-colors">
              <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">Build Network</h3>
              <p className="text-xs text-gray-600 mt-1">Expand your social circle</p>
            </div>
          </div>
        </div>
      </main>
      
    </div>
  );
}
