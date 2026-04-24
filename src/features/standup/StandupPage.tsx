import { useAuthStore } from "@/features/auth/useAuthStore";
import EngineerView from "./components/EngineerView";
import ManagerView from "./components/ManagerView";

export default function StandupPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === "engineering_manager" || user?.role === "admin";
  return isManager ? <ManagerView /> : <EngineerView />;
}
