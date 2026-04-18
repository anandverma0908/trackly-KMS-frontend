import { useQuery } from "@tanstack/react-query";
import { useFilterStore } from "@/store";
import { useAuthStore } from "@/features/auth/model/useAuthStore";
import { fetchSummary } from "@/services/api";

export function useDashboard() {
  const { dateFrom, dateTo, project, user, pods, clients } = useFilterStore();
  const getScopedPod = useAuthStore((s) => s.getScopedPod);

  const scopedPod = getScopedPod();

  // If role-scoped to a POD, override the multi-select with just that POD
  const effectivePods = pods.length > 0 ? pods : scopedPod ? [scopedPod] : [];

  const params = {
    dateFrom,
    dateTo,
    project,
    user,
    pods: effectivePods,
    clients: clients,
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["summary", params],
    queryFn: () => fetchSummary(params),
  });

  return {
    summary: data,
    isLoading,
    isError,
    error,
    refetch,
    byPod: data?.by_pod ?? [],
    byClient: data?.by_client ?? [],
    byUser: data?.by_user ?? [],
    totalHours: data?.total_hours ?? 0,
    totalTickets: data?.total_tickets ?? 0,
    isScopedToPod: !!scopedPod,
    scopedPod,
  };
}
