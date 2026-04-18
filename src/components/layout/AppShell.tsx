import { useState } from "react";
import { Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import NotificationPanel from "@/components/nova/NotificationPanel";
import EosPanel from "@/components/nova/EosPanel";
import styles from "./AppShell.module.css";

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [eosOpen, setEosOpen] = useState(false);

  function toggleNotif() {
    setNotifOpen((v) => !v);
    setEosOpen(false);
  }

  function toggleEos() {
    setEosOpen((v) => !v);
    setNotifOpen(false);
  }

  return (
    <div className={styles.shell}>
      {/* Sidebar — full height, never shifts */}
      {sidebarOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Right side: topbar + main */}
      <div className={styles.rightSide}>
        <Topbar
          onMenuClick={() => setSidebarOpen((v) => !v)}
          onSidebarToggle={() => setSidebarCollapsed((v) => !v)}
          sidebarCollapsed={sidebarCollapsed}
          notifOpen={notifOpen}
          onNotifToggle={toggleNotif}
          eosOpen={eosOpen}
          onEosToggle={toggleEos}
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
            animate={{ width: 280 }}
            exit={{ width: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 38, mass: 0.7 }}
          >
            <div className={styles.notifInner}>
              <NotificationPanel onClose={() => setNotifOpen(false)} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* EOS panel — flex sibling, animates width */}
      <AnimatePresence initial={false}>
        {eosOpen && (
          <motion.aside
            className={styles.eosPanel}
            initial={{ width: 0 }}
            animate={{ width: 340 }}
            exit={{ width: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 38, mass: 0.7 }}
          >
            <div className={styles.eosInner}>
              <EosPanel onClose={() => setEosOpen(false)} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <OnboardingModal />
    </div>
  );
}
