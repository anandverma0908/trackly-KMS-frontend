import { Routes, Route, Navigate } from "react-router-dom";
import RequireAuth from "@/components/guards/RequireAuth";
import RequireRole from "@/components/guards/RequireRole";
import AppShell from "@/components/layout/AppShell";
import LoginPage from "@/features/auth/LoginPage";
import DashboardPage from "@/features/dashboard/DashboardPage";
import TicketsPage from "@/features/tickets/TicketsPage";
import TeamPage from "@/features/team/TeamPage";
import ExportPage from "@/features/export/ExportPage";
import SettingsPage from "@/features/settings/SettingsPage";
import ManualEntryPage from "@/features/manual-entry/ManualEntryPage";
import UsersPage from "@/features/settings/UsersPage";
import ChangePasswordPage from "@/features/settings/ChangePasswordPage";
import WikiPage from "@/features/wiki/WikiPage";
import KanbanBoard from "@/features/kanban/KanbanBoard";
import SprintPage from "@/features/sprint/SprintPage";
import StandupPage from "@/features/standup/StandupPage";
import AnalyticsPage from "@/features/analytics/AnalyticsPage";
import BurnRatePage from "@/features/settings/BurnRatePage";
import NotificationPrefsPage from "@/features/settings/NotificationPrefsPage";
import WeeklyTimeGrid from "@/features/timetrack/WeeklyTimeGrid";
import SpacesPage from "@/features/spaces/SpacesPage";
import ProjectDetailPage from "@/features/spaces/ProjectDetailPage";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Requires login but NO shell — full screen */}
      <Route element={<RequireAuth />}>
        <Route path="/settings/password" element={<ChangePasswordPage />} />
      </Route>

      {/* All app routes — require login + shell */}
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route element={<RequireRole />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"   element={<DashboardPage />} />
            <Route path="/tickets"     element={<TicketsPage />} />
            {/* <Route path="/kanban"      element={<KanbanBoard />} /> */}
            <Route path="/sprints"     element={<SprintPage />} />
            <Route path="/wiki"        element={<WikiPage />} />
            <Route path="/standup"     element={<StandupPage />} />
            <Route path="/analytics"   element={<AnalyticsPage />} />
            <Route path="/team"        element={<TeamPage />} />
            <Route path="/export"      element={<ExportPage />} />
            <Route path="/manual-entry" element={<ManualEntryPage />} />
            <Route path="/settings"    element={<SettingsPage />} />
            <Route path="/settings/budget" element={<BurnRatePage />} />
            <Route path="/settings/notifications" element={<NotificationPrefsPage />} />
            <Route path="/timesheets/weekly" element={<WeeklyTimeGrid />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/spaces"             element={<SpacesPage />} />
            <Route path="/spaces/:projectId"  element={<ProjectDetailPage />} />
          </Route>
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
