import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchDecisions,
  createDecision,
  deleteDecision,
} from "@/services/api";
import { QUERY_KEYS } from "@/config/queryKeys";


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
