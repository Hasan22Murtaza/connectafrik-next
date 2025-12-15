import { useCallback, useEffect, useState } from "react";
import { socialService, type FriendRequest } from "@/features/social/services/socialService";

export const useFriendRequests = () => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await socialService.getPendingFriendRequests();
    if (error) {
      setError(error.message);
    } else {
      setRequests(data ?? []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const respond = useCallback(
    async (requestId: string, status: "accepted" | "declined") => {
      const { error } = await socialService.respondToFriendRequest(requestId, status);
      if (error) {
        setError(error.message);
      } else {
        await refresh();
      }
    },
    [refresh]
  );

  const block = useCallback(
    async (requestId: string) => {
      const { error } = await socialService.blockUser(requestId);
      if (error) {
        setError(error.message);
      } else {
        await refresh();
      }
    },
    [refresh]
  );

  return {
    requests,
    loading,
    error,
    refresh,
    respond,
    block,
  };
};
