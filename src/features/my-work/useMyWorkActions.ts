import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { updateTicketStatus, updateTicket, logTime, createComment } from "@/services/api";
import type { AITicket } from "./useMyWork";

export function useMyWorkActions() {
  const queryClient = useQueryClient();

  const handleStatusUpdate = useCallback(
    async (key: string, status: string) => {
      const tid = toast.loading("Updating status…");
      try {
        await updateTicketStatus(key, status);
        queryClient.invalidateQueries({ queryKey: ["my-work"] });
        toast.success(`${key} moved to ${status}`, { id: tid });
      } catch {
        toast.error("Failed to update status", { id: tid });
      }
    },
    [queryClient],
  );

  const handleEscalate = useCallback(
    async (key: string) => {
      const tid = toast.loading("Escalating…");
      try {
        await updateTicket(key, { priority: "Highest" });
        queryClient.invalidateQueries({ queryKey: ["my-work"] });
        toast.success(`${key} escalated to Highest priority`, { id: tid });
      } catch {
        toast.error("Failed to escalate", { id: tid });
      }
    },
    [queryClient],
  );

  const handleLogTime = useCallback(
    async (key: string, hours: number, comment: string) => {
      const tid = toast.loading("Logging time…");
      try {
        await logTime(key, hours, comment, new Date().toISOString().slice(0, 10));
        queryClient.invalidateQueries({ queryKey: ["my-work"] });
        toast.success(`${hours}h logged on ${key}`, { id: tid });
      } catch {
        toast.error("Failed to log time", { id: tid });
      }
    },
    [queryClient],
  );

  const handleComment = useCallback(
    async (key: string, text: string) => {
      const tid = toast.loading("Posting comment…");
      try {
        await createComment(key, text);
        toast.success(`Comment posted on ${key}`, { id: tid });
      } catch {
        toast.error("Failed to post comment", { id: tid });
      }
    },
    [queryClient],
  );

  const handleQuickAction = useCallback(
    (
      actionId: string,
      ticket: AITicket,
      setSelectedKey: (key: string) => void,
      setCommentTicket: (t: AITicket) => void,
      setLogTimeTicket: (t: AITicket) => void,
    ) => {
      switch (actionId) {
        case "open":
        case "ping-blocker":
        case "ping-reviewer":
          setSelectedKey(ticket.key);
          break;
        case "draft-unblock":
          setCommentTicket(ticket);
          break;
        case "log-time":
          setLogTimeTicket(ticket);
          break;
        case "approve":
          handleStatusUpdate(ticket.key, "Done");
          break;
        case "escalate":
          handleEscalate(ticket.key);
          break;
      }
    },
    [handleStatusUpdate, handleEscalate],
  );

  return { handleStatusUpdate, handleEscalate, handleLogTime, handleComment, handleQuickAction };
}
