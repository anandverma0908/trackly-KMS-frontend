import { useState } from "react";
import { Outlet } from "react-router-dom";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import NovaChatWidget from "@/components/nova/NovaChatWidget";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import styles from "./AppShell.module.css";

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />
      <div className={styles.body}>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className={styles.mobileOverlay} onClick={() => setSidebarOpen(false)} />
        )}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      <NovaChatWidget />
      <OnboardingModal />
    </div>
  );
}
