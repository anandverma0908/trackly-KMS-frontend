import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchDecisions,
  fetchDecision,
  createDecision,
  updateDecision,
  deleteDecision,
} from "@/services/api";
import { QUERY_KEYS } from "@/config/queryKeys";
import type { Decision } from "@/types";

export function useDecisions(params?: {
  space_id?: string;
  org_level?: boolean;
  status?: string;
}) {
  return useQuery({
    queryKey: QUERY_KEYS.decisions(params),
    queryFn: () => fetchDecisions(params),
    staleTime: 0,
  });
}

export function useDecision(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.decision(id),
    queryFn: () => fetchDecision(id),
    enabled: !!id,
  });
}

export function useCreateDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDecision,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["decisions"] });
      toast.success("Decision recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Decision> }) =>
      updateDecision(id, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["decisions"] });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.decision(vars.id) });
      toast.success("Decision updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDecision,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["decisions"] });
      toast.success("Decision deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
