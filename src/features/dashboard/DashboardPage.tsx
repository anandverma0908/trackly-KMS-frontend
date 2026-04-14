import toast from "react-hot-toast";
import { useDashboard } from "./useDashboard";
import { useAuthStore } from "@/features/auth/useAuthStore";
import { RiRefreshLine, RiCalendarLine } from "react-icons/ri";
import styles from "./DashboardPage.module.css";

// Core widgets
import DashboardKPIStrip from "./widgets/DashboardKPIStrip";
import MyActiveTickets from "./widgets/MyActiveTickets";
import TodayStandup from "./widgets/TodayStandup";
import WeeklyHeatmap from "./widgets/WeeklyHeatmap";
import RecentActivity from "./widgets/RecentActivity";
import QuickActions from "./widgets/QuickActions";
import MySprintItems from "./widgets/MySprintItems";

// Lead+ widgets
import TeamHoursChart from "./widgets/TeamHoursChart";
import BlockedTickets from "./widgets/BlockedTickets";
import TeamStandups from "./widgets/TeamStandups";
import PodVelocity from "./widgets/PodVelocity";
import SprintBurndown from "./widgets/SprintBurndown";

// Manager+ widgets
import BurnRateWidget from "./widgets/BurnRateWidget";
import TicketsByStatus from "./widgets/TicketsByStatus";
import KnowledgeGapsWidget from "./widgets/KnowledgeGapsWidget";

// Admin
import SystemHealth from "./widgets/SystemHealth";

const TODAY = new Date().toLocaleDateString("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export default function DashboardPage() {
  const { refetch } = useDashboard();
  const user = useAuthStore((s) => s.user);
  const can = useAuthStore((s) => s.can);

  const isTeamMember = can("view:own");
  const isLead =
    !isTeamMember &&
    (user?.role === "tech_lead" ||
      user?.role === "engineering_manager" ||
      user?.role === "admin");
  const isManager =
    user?.role === "engineering_manager" || user?.role === "admin";
  const isAdmin = user?.role === "admin";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      {/* <div className={`${styles.header} fade-up`}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            {greeting}, {firstName}
          </h1>
          <p className={styles.subtitle}>
            Here's what's happening across your workspace.
          </p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.dateBadge}>
            <RiCalendarLine size={13} />
            {TODAY}
          </span>
        </div>
      </div> */}

      {/* ── KPI Strip ── */}
      <div className={`${styles.kpiRow} fade-up-1`}>
        <DashboardKPIStrip />
      </div>

      {/* ── Main row: primary chart + active tickets panel ── */}
      <div className={`${styles.mainRow} fade-up-2`}>
        {/* Right: active tickets for everyone */}
        <MyActiveTickets />

        <RecentActivity limit={12} />
      </div>

      {/* ── Mid row: heatmap + velocity/sprint ── */}
      <div className={`${styles.midRow} fade-up-3`}>
        <WeeklyHeatmap />
        {isTeamMember ? <MySprintItems /> : <SprintBurndown />}
      </div>

      {/* ── Lead section ── */}
      {isLead && (
        <section className={`${styles.section} fade-up-3`}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Team Management</span>
            <div className={styles.sectionDivider} />
          </div>
          <div className={styles.midRow}>
            <BlockedTickets />
            <TeamStandups />
          </div>
          <div className={styles.midRow}>
            <PodVelocity />
            {isTeamMember ? null : <TodayStandup />}
          </div>
        </section>
      )}

      {/* ── Manager section ── */}
      {isManager && (
        <section className={`${styles.section} fade-up-3`}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Analytics &amp; Budgets</span>
            <div className={styles.sectionDivider} />
          </div>
          <div className={styles.midRow}>
            <TicketsByStatus />
            <BurnRateWidget />
          </div>
          <div className={styles.midRow}>
            <KnowledgeGapsWidget />
            <MySprintItems />
          </div>
        </section>
      )}

      {/* ── Admin section ── */}
      {isAdmin && (
        <section className={`${styles.section} fade-up-3`}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>System</span>
            <div className={styles.sectionDivider} />
          </div>
          <SystemHealth />
        </section>
      )}

      {/* ── Bottom: team chart quick actions ── */}
      <div className={`${styles.bottomRow} fade-up-3`}>
        {/* Left: lead sees TeamHours, others see sprint burndown or standup */}
        {isLead || isManager ? <TeamHoursChart /> : <TodayStandup />}
        <QuickActions />
      </div>
    </div>
  );
}
