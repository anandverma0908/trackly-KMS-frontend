import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import RequireAuth from "@/components/guards/RequireAuth";
import RequireRole from "@/components/guards/RequireRole";
import AppShell from "@/components/layout/AppShell";
import LoginPage from "@/features/auth/LoginPage";
import TicketsPage from "@/features/tickets/TicketsPage";
import TeamPage from "@/features/team/TeamPage";
import SettingsPage from "@/features/settings/SettingsPage";
import WikiPage from "@/features/wiki/WikiPage";

import StandupPage from "@/features/standup/StandupPage";
import AnalyticsPage from "@/features/analytics/AnalyticsPage";

import ManualEntryPage from "@/features/manual-entry/ManualEntryPage";
import SpacesPage from "@/features/spaces/SpacesPage";
import ProjectDetailPage from "@/features/spaces/ProjectDetailPage";

import MyWorkPage from "@/features/my-work/MyWorkPage";
const NovaPage = lazy(() => import("@/features/nova/NovaPage"));
import CodeReviewPage from "@/features/code-review/CodeReviewPage";
import GoalsPage from "@/features/goals/GoalsPage";
import CalendarPage from "@/features/calendar/CalendarPage";
import DecisionsPage from "@/features/decisions/DecisionsPage";
import ProcessesPage from "@/features/processes/ProcessesPage";
import AuditLogPage from "@/features/audit/AuditLogPage";
import ChatPage from "@/features/chat/ChatPage";
import FormsPage from "@/features/forms/FormsPage";
import GuestPortalPage from "@/features/guest/GuestPortalPage";
import GuestLoginPage from "@/features/guest/GuestLoginPage";

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
        <Route
          path="/guest-login"
          element={
            <PageTransition>
              <GuestLoginPage />
            </PageTransition>
          }
        />

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
              <Route index element={<Navigate to="/my-work" replace />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/wiki" element={<WikiPage />} />
              <Route path="/standup" element={<StandupPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/timesheets" element={<ManualEntryPage />} />
              <Route path="/spaces" element={<SpacesPage />} />
              <Route
                path="/spaces/:projectId"
                element={<ProjectDetailPage />}
              />
              <Route path="/my-work" element={<MyWorkPage />} />
              <Route path="/eos" element={<Suspense fallback={null}><NovaPage /></Suspense>} />
              <Route path="/code-review" element={<CodeReviewPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/decisions" element={<DecisionsPage />} />
              <Route path="/processes" element={<ProcessesPage />} />
              <Route path="/audit-log" element={<AuditLogPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/forms" element={<FormsPage />} />
              <Route path="/guest" element={<GuestPortalPage />} />
            </Route>
          </Route>
        </Route>

        {/* Catch-all */}
        <Route
          path="*"
          element={
            <PageTransition>
              <Navigate to="/my-work" replace />
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
