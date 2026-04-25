import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchGoals,
  createGoal,
  updateGoal,
  deleteGoal,
} from "@/services/api";
import { QUERY_KEYS } from "@/config/queryKeys";
import type { Goal } from "@/types";

/* ── Queries ── */
export function useGoals(quarter?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.goals(quarter),
    queryFn: () => fetchGoals(quarter),
    staleTime: 0,
  });
}

/* ── Mutations ── */
export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGoal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"], refetchType: "all" });
      toast.success("Goal created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Goal> }) =>
      updateGoal(id, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["goals"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.goal(vars.id), refetchType: "all" });
      toast.success("Goal updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"], refetchType: "all" });
      toast.success("Goal deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
