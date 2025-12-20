// Simple in-memory store for notifications
// In production, use a database or real-time service like Socket.io

interface CallNotification {
  roomId: string;
  callerId: string;
  callerName: string;
  timestamp: number;
}

const notifications: Map<string, CallNotification[]> = new Map();

export function addNotification(userId: string, notification: CallNotification) {
  if (!notifications.has(userId)) {
    notifications.set(userId, []);
  }
  notifications.get(userId)!.push(notification);
}

export function getNotifications(userId: string): CallNotification[] {
  return notifications.get(userId) || [];
}

export function clearNotifications(userId: string) {
  notifications.delete(userId);
}



