import { supabase } from "@/lib/supabase";

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
  async sendFriendRequest(recipientId: string, message?: string) {
    const { data, error } = await supabase
      .from("friend_requests")
      .insert({ recipient_id: recipientId, message })
      .select()
      .single();

    return { data, error };
  },

  async respondToFriendRequest(requestId: string, status: "accepted" | "declined") {
    const { data, error } = await supabase
      .from("friend_requests")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", requestId)
      .select()
      .single();

    return { data, error };
  },

  async blockUser(requestId: string) {
    const { data, error } = await supabase
      .from("friend_requests")
      .update({ status: "blocked", responded_at: new Date().toISOString() })
      .eq("id", requestId)
      .select()
      .single();

    return { data, error };
  },

  async getPendingFriendRequests(): Promise<{ data: FriendRequest[] | null; error: Error | null }> {
    const { data, error } = await supabase
      .from("friend_requests")
      .select(
        `*,
        requester:requester_id(id, username, full_name, avatar_url)`
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    return { data: data as FriendRequest[] | null, error };
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

    channel.on("presence", { event: "sync" }, () => {
      // Presence state can be accessed with channel.presenceState()
      // Components can subscribe to updates by reading from this channel.
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        channel.track({ last_seen: new Date().toISOString() });
        await supabase
          .from("profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", userId);
      }
    });

    return channel;
  },
};
