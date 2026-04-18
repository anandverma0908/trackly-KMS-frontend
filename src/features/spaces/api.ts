import type { Project } from "@/features/spaces/model/spacesData";
import { api, mock } from "@/shared/api/client";

export async function fetchProject(pod: string): Promise<Project> {
  if (mock()?.fetchProject) return mock().fetchProject(pod);
  const { data } = await api.get<Project>(`/spaces/${pod}/project`);
  return data;
}

export async function createSpace(payload: {
  key: string;
  name: string;
  description: string;
  category: string;
  color: string;
}) {
  if (mock()?.createSpace) return mock().createSpace(payload);
  const { data } = await api.post("/spaces", payload);
  return data;
}

export async function deleteSpace(pod: string) {
  if (mock()?.deleteSpace) return mock().deleteSpace(pod);
  const { data } = await api.delete(`/spaces/${pod}`);
  return data;
}
