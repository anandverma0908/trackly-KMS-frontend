import { useState, useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import NotificationPanel from "@/components/nova/NotificationPanel";
import EosPanel from "@/components/nova/EosPanel";
import CommandBar from "@/components/CommandBar/CommandBar";
import { fetchNotifications } from "@/services/api";
import { useNotificationStore } from "@/store";
import type { Notification } from "@/types";
import styles from "./AppShell.module.css";

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [eosOpen, setEosOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  const { setUnreadCount } = useNotificationStore();
  const hasLoadedRef = useRef(false);
  const prevCountRef = useRef(0);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 20_000,
  });

  useEffect(() => {
    const unread = notifications.filter((n) => !n.read).length;
    if (hasLoadedRef.current && unread > prevCountRef.current) {
      const newest = notifications.find((n) => !n.read);
      if (newest) {
        toast(newest.title, { icon: "🔔", duration: 5000 });
      }
    }
    hasLoadedRef.current = true;
    if (unread !== prevCountRef.current) {
      prevCountRef.current = unread;
      setUnreadCount(unread);
    }
  // setUnreadCount is a stable Zustand action — safe to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleNotif() {
    setNotifOpen((v) => !v);
    setEosOpen(false);
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

      {/* ⌘K Command Bar */}
      <AnimatePresence>
        {cmdOpen && <CommandBar onClose={() => setCmdOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
