import { supabase } from "@/lib/supabase";
import { apiClient } from "@/lib/api-client";

export type FriendRequestStatus = "pending" | "accepted" | "declined" | "blocked";

export interface FriendRequest {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: FriendRequestStatus;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  requester?: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface NotificationRecord {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  is_read: boolean;
}

export const socialService = {
  async fetchAllPages<T>(endpoint: string, limit = 50): Promise<T[]> {
    const allItems: T[] = []
    let page = 0
    let hasMore = true

    while (hasMore) {
      const res = await apiClient.get<{ data: T[]; hasMore?: boolean }>(endpoint, { page, limit })
      const items = res.data || []
      allItems.push(...items)
      hasMore = Boolean(res.hasMore)
      page += 1
      if (items.length === 0) break
    }

    return allItems
  },

  async sendFriendRequest(recipientId: string, message?: string) {
    try {
      const data = await apiClient.post<{ success: boolean }>("/api/friends", {
        receiver_id: recipientId,
      });
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async respondToFriendRequest(requestId: string, status: "accepted" | "declined") {
    try {
      const data = await apiClient.patch(`/api/friends/requests/${requestId}`, { status });
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async blockUser(requestId: string) {
    try {
      const data = await apiClient.patch(`/api/friends/requests/${requestId}`, { status: "blocked" });
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async getPendingFriendRequests(): Promise<{ data: FriendRequest[] | null; error: Error | null }> {
    try {
      const allRequests = await this.fetchAllPages<any>('/api/friends/requests', 20)
      const mapped = allRequests.map((req: any) => ({
        ...req,
        requester_id: req.sender_id || req.requester_id,
        recipient_id: req.receiver_id || req.recipient_id,
        requester: req.requester || req.sender,
      }));
      return { data: mapped as FriendRequest[], error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  async getNotifications(limit = 25): Promise<{ data: NotificationRecord[] | null; error: Error | null }> {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, payload, created_at, is_read")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data: data as NotificationRecord[] | null, error };
  },

  async markNotificationRead(notificationId: string) {
    const { data, error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .select()
      .single();

    return { data, error };
  },

  initPresence(userId: string) {
    const channel = supabase.channel("presence#global", {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel.on("presence", { event: "sync" }, () => {});

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        channel.track({ last_seen: new Date().toISOString() });
        try {
          await apiClient.patch('/api/users/me/presence', {
            status: 'online',
            last_seen: new Date().toISOString(),
          });
        } catch {
          // Non-blocking
        }
      }
    });

    return channel;
  },
};
