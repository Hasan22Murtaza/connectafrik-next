import { useEffect, useState, useCallback } from "react";
import { fetchVideoSDKToken } from "@/lib/videosdk";

interface UseVideoSDKTokenResult {
  token: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useVideoSDKToken(roomId: string, userId: string): UseVideoSDKTokenResult {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const tokenValue = await fetchVideoSDKToken({ roomId, userId });
      setToken(tokenValue);
    } catch (err: any) {
      setError(err.message);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [roomId, userId]);

  useEffect(() => {
    fetchToken();

    const interval = setInterval(fetchToken, 540000); // refresh every 9 min
    return () => clearInterval(interval);
  }, [fetchToken]);

  return { token, loading, error, refresh: fetchToken };
}
