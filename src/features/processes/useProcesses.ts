import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchProcesses,
  createProcess,
  deleteProcess,
} from "@/services/api";
import { QUERY_KEYS } from "@/config/queryKeys";


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
