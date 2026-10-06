"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import toast from "react-hot-toast";

/**
 * Direct checkout is not part of the Marketplace flow.
 * Buyers contact the seller in chat and agree offline.
 */
const CheckoutPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    toast("Message the seller to arrange this listing.");
    router.replace(id ? `/marketplace/${id}` : "/marketplace");
  }, [id, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <p className="text-sm text-content-secondary">Opening the listing…</p>
    </div>
  );
};

export default CheckoutPage;
