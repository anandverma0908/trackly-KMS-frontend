import { useDashboard } from "./model/useDashboard";
import { useAuthStore } from "@/features/auth/model/useAuthStore";
import styles from "./DashboardPage.module.scss";

// Core widgets
import DashboardKPIStrip from "./widgets/DashboardKPIStrip";
import MyActiveTickets from "./widgets/MyActiveTickets";
import TodayStandup from "./widgets/TodayStandup";
import WeeklyHeatmap from "./widgets/WeeklyHeatmap";
import RecentActivity from "./widgets/RecentActivity";

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

export default function DashboardPage() {
  useDashboard();
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

  return (
    <div className={styles.page}>
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

      <div className={`${styles.kpiRow} fade-up-1`}>
        <DashboardKPIStrip />
      </div>

      <div className={`${styles.mainRow} fade-up-2`}>
        {/* Right: active tickets for everyone */}
        <MyActiveTickets />

        <RecentActivity limit={5} />
      </div>

      <div className={`${styles.midRow} fade-up-3`}>
        <PodVelocity />
        {isTeamMember ? <WeeklyHeatmap /> : <SprintBurndown />}
      </div>

      {isLead && (
        <section className={`${styles.section} fade-up-3`}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Team Management</span>
            <div className={styles.sectionDivider} />
          </div>
          <div className={styles.midRow}>
            <TeamHoursChart />
            <TeamStandups />
          </div>
          <div className={styles.midRow}>
            <BlockedTickets />
            {isTeamMember ? null : <TodayStandup />}
          </div>
        </section>
      )}

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
            <WeeklyHeatmap />
          </div>
        </section>
      )}

      {isAdmin && (
        <section className={`${styles.section} fade-up-3`}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>System</span>
            <div className={styles.sectionDivider} />
          </div>
          <SystemHealth />
        </section>
      )}
    </div>
  );
}
