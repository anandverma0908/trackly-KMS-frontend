import type { Notification } from "@/shared/types";
import { api } from "@/shared/api/client";

export async function fetchNotifications(): Promise<Notification[]> {
  const { data } = await api.get("/notifications");
  return data?.notifications ?? data ?? [];
}

export async function markNotificationRead(id: number) {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await api.post("/notifications/read-all");
}
