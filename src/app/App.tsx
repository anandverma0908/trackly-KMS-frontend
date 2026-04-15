import { useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
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

function useRouteDirection() {
  const location = useLocation();
  const prevRef = useRef(location);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev.pathname !== location.pathname) {
      const fromLogin = prev.pathname === "/login";
      const toLogin = location.pathname === "/login";
      if (fromLogin && !toLogin) {
        setDirection(1); // login -> app: push up
      } else if (!fromLogin && toLogin) {
        setDirection(-1); // app -> login: push down
      } else {
        setDirection(0);
      }
      prevRef.current = location;
    }
  }, [location]);

  return direction;
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const direction = useRouteDirection();
  const isLoginToApp = direction === 1;
  const isAppToLogin = direction === -1;

  return (
    <motion.div
      initial={{
        y: isLoginToApp ? "100%" : isAppToLogin ? "-100%" : 0,
        opacity: isLoginToApp || isAppToLogin ? 1 : 0.95,
      }}
      animate={{ y: 0, opacity: 1 }}
      exit={{
        y: isLoginToApp ? "-100%" : isAppToLogin ? "100%" : 0,
        opacity: 1,
      }}
      transition={{
        duration: 0.55,
        ease: [0.32, 0.72, 0, 1],
      }}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "auto",
        zIndex: isLoginToApp ? 2 : 1,
      }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="sync" initial={false}>
      <Routes location={location} key={location.pathname}>
        {/* Public */}
        <Route
          path="/login"
          element={
            <PageTransition>
              <LoginPage />
            </PageTransition>
          }
        />

        {/* Requires login but NO shell — full screen */}
        <Route
          element={
            <PageTransition>
              <RequireAuth />
            </PageTransition>
          }
        >
          <Route path="/settings/password" element={<ChangePasswordPage />} />
        </Route>

        {/* All app routes — require login + shell */}
        <Route
          element={
            <PageTransition>
              <RequireAuth />
            </PageTransition>
          }
        >
          <Route
            element={
              <PageTransition>
                <AppShell />
              </PageTransition>
            }
          >
            <Route element={<RequireRole />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/kanban" element={<KanbanBoard />} />
              <Route path="/sprints" element={<SprintPage />} />
              <Route path="/wiki" element={<WikiPage />} />
              <Route path="/standup" element={<StandupPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="/manual-entry" element={<ManualEntryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/budget" element={<BurnRatePage />} />
              <Route path="/settings/notifications" element={<NotificationPrefsPage />} />
              <Route path="/timesheets/weekly" element={<WeeklyTimeGrid />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/spaces" element={<SpacesPage />} />
              <Route path="/spaces/:projectId" element={<ProjectDetailPage />} />
            </Route>
          </Route>
        </Route>

        {/* Catch-all */}
        <Route
          path="*"
          element={
            <PageTransition>
              <Navigate to="/dashboard" replace />
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return <AnimatedRoutes />;
}
