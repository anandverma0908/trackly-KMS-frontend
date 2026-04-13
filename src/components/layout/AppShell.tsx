import { useState } from "react";
import { Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import NovaChatWidget from "@/components/nova/NovaChatWidget";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import NotificationPanel from "@/components/nova/NotificationPanel";
import styles from "./AppShell.module.css";

export default function AppShell() {
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen,        setNotifOpen]        = useState(false);

  return (
    <div className={styles.shell}>
      {/* Sidebar — full height, never shifts */}
      {sidebarOpen && (
        <div className={styles.mobileOverlay} onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Right side: topbar + main — shrinks when notif panel opens */}
      <div className={styles.rightSide}>
        <Topbar
          onMenuClick={()     => setSidebarOpen((v) => !v)}
          onSidebarToggle={()  => setSidebarCollapsed((v) => !v)}
          sidebarCollapsed={sidebarCollapsed}
          notifOpen={notifOpen}
          onNotifToggle={()   => setNotifOpen((v) => !v)}
        />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>

      {/* Notification panel — flex sibling, animates width */}
      <AnimatePresence initial={false}>
        {notifOpen && (
          <motion.aside
            className={styles.notifPanel}
            initial={{ width: 0 }}
            animate={{ width: 340 }}
            exit={{ width: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 38, mass: 0.7 }}
          >
            <div className={styles.notifInner}>
              <NotificationPanel onClose={() => setNotifOpen(false)} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* <NovaChatWidget /> */}
      <OnboardingModal />
    </div>
  );
}
