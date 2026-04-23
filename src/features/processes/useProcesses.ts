import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchProcesses,
  fetchProcess,
  createProcess,
  updateProcess,
  deleteProcess,
} from "@/services/api";
import { QUERY_KEYS } from "@/config/queryKeys";
import type { Process } from "@/types";

export function useProcesses(params?: {
  space_id?: string;
  org_level?: boolean;
  category?: string;
}) {
  return useQuery({
    queryKey: QUERY_KEYS.processes(params),
    queryFn: () => fetchProcesses(params),
    staleTime: 0,
  });
}

export function useProcess(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.process(id),
    queryFn: () => fetchProcess(id),
    enabled: !!id,
  });
}

export function useCreateProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProcess,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["processes"] });
      toast.success("Process created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Process> }) =>
      updateProcess(id, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["processes"] });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.process(vars.id) });
      toast.success("Process updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteProcess,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["processes"] });
      toast.success("Process deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
