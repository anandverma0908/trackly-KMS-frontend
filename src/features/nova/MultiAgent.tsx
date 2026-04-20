import { useState } from "react";
import {
  RiSparklingLine, RiFlashlightLine, RiFileTextLine, RiRouteLine, RiHeartPulseLine,
  RiCheckLine, RiCloseLine, RiPauseLine, RiPlayLine, RiAlertLine,
} from "react-icons/ri";
import toast from "react-hot-toast";
import panelStyles from "./Gen2.module.css";
import styles from "./Gen3.module.css";

interface Agent {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  status: "active" | "idle" | "paused";
  lastAction: string;
  nextAction: string;
  actionsToday: number;
  ticketsHandled: number;
}

interface Approval {
  id: string;
  agent: string;
  title: string;
  desc: string;
  approved: boolean | null;
}

const INITIAL_AGENTS: Agent[] = [
  {
    id: "sprint",
    name: "Sprint Agent",
    desc: "Manages sprint ceremonies, sends blocker alerts, flags at-risk tickets, and drafts sprint summaries at close.",
    icon: <RiFlashlightLine size={16} />,
    status: "active",
    lastAction: "Sent blocker alert for TRK-142 to Anand V. — blocked 48h",
    nextAction: "Sprint 9 retrospective summary at 5:00 PM",
    actionsToday: 12,
    ticketsHandled: 7,
  },
  {
    id: "docs",
    name: "Documentation Agent",
    desc: "Keeps wiki current. Auto-creates pages from closed tickets, flags stale docs, and links tickets to existing articles.",
    icon: <RiFileTextLine size={16} />,
    status: "active",
    lastAction: "Created wiki stub for 'Rate Limiting' from 3 resolved tickets",
    nextAction: "Scanning 8 tickets closed today for doc gaps",
    actionsToday: 8,
    ticketsHandled: 5,
  },
  {
    id: "routing",
    name: "Routing Agent",
    desc: "Assigns all incoming tickets based on team skills, current workload, and historical resolution patterns.",
    icon: <RiRouteLine size={16} />,
    status: "active",
    lastAction: "Assigned TRK-201 (auth) to Priya S. — 8 prior auth resolutions",
    nextAction: "3 unassigned tickets in queue",
    actionsToday: 19,
    ticketsHandled: 19,
  },
  {
    id: "health",
    name: "Health Agent",
    desc: "Monitors team wellbeing via linguistic signals in comments and updates. Surfaces stress patterns before they escalate.",
    icon: <RiHeartPulseLine size={16} />,
    status: "active",
    lastAction: "Flagged 3 engineers with frustration signals in Sprint 9 comments",
    nextAction: "Weekly sentiment digest — Sunday 6:00 PM",
    actionsToday: 4,
    ticketsHandled: 0,
  },
];

const INITIAL_APPROVALS: Approval[] = [
  {
    id: "a1",
    agent: "Routing Agent",
    title: "Assign TRK-205 to Rahul D.?",
    desc: "DB failover ticket. Rahul has 4 past DB resolutions but is currently at 92% workload. Alternative: Karan M. has capacity.",
    approved: null,
  },
  {
    id: "a2",
    agent: "Documentation Agent",
    title: "Archive 14 wiki pages marked stale (90+ days)?",
    desc: "Pages have had zero views in 90 days and are superseded by newer docs. They'll move to Archive, not deleted.",
    approved: null,
  },
  {
    id: "a3",
    agent: "Sprint Agent",
    title: "Move TRK-198 and TRK-199 to backlog?",
    desc: "Both tickets are blocked and won't complete before sprint end. Moving prevents sprint score inflation.",
    approved: null,
  },
];

export default function MultiAgent() {
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [approvals, setApprovals] = useState<Approval[]>(INITIAL_APPROVALS);

  function toggleAgent(id: string) {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: a.status === "paused" ? "active" : "paused" }
          : a
      )
    );
  }

  function handleApproval(id: string, approved: boolean) {
    setApprovals((prev) => prev.map((a) => a.id === id ? { ...a, approved } : a));
    toast.success(approved ? "Action approved — agent will proceed" : "Action skipped");
  }

  const pendingCount = approvals.filter((a) => a.approved === null).length;

  return (
    <div className={panelStyles.panel}>
      <div className={panelStyles.panelHeader}>
        <h2 className={panelStyles.panelTitle}>Multi-Agent Work Execution</h2>
        <p className={panelStyles.panelSub}>
          4 agents run in parallel, each owning a workstream. You supervise — agents execute. Approve exceptions as they arise.
        </p>
      </div>

      {/* Approval queue */}
      {pendingCount > 0 && (
        <div className={styles.approvalQueue}>
          <div className={styles.approvalQueueHeader}>
            <RiAlertLine size={14} color="var(--amber, #f59e0b)" />
            Approval Queue
            <span className={styles.approvalQueueBadge}>{pendingCount} pending</span>
          </div>
          {approvals.map((a) => (
            <div key={a.id} className={styles.approvalItem}>
              <div className={styles.approvalInfo}>
                <div className={styles.approvalAgent}>{a.agent}</div>
                <div className={styles.approvalTitle}>{a.title}</div>
                <div className={styles.approvalDesc}>{a.desc}</div>
              </div>
              <div className={styles.approvalBtns}>
                {a.approved === null ? (
                  <>
                    <button className={styles.approvalApprove} onClick={() => handleApproval(a.id, true)}>
                      <RiCheckLine size={12} /> Approve
                    </button>
                    <button className={styles.approvalSkip} onClick={() => handleApproval(a.id, false)}>
                      <RiCloseLine size={13} />
                    </button>
                  </>
                ) : (
                  <div className={styles.approvalApproved}>
                    <RiCheckLine size={12} />
                    {a.approved ? "Approved" : "Skipped"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agent cards */}
      <div className={styles.agentGrid}>
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`${styles.agentCard} ${agent.status === "active" ? styles.agentCardActive : ""} ${agent.status === "paused" ? styles.agentPaused : ""}`}
          >
            <div className={styles.agentHeader}>
              <div className={styles.agentIconWrap}>{agent.icon}</div>
              <span className={styles.agentName}>{agent.name}</span>
              <div
                className={`${styles.agentStatusDot} ${agent.status === "active" ? styles.agentStatusDotActive : styles.agentStatusDotIdle}`}
              />
            </div>

            <p className={styles.agentDesc}>{agent.desc}</p>

            <div className={styles.agentLastAction}>
              <span className={styles.agentLastLabel}>Last action</span>
              <span className={styles.agentLastText}>{agent.lastAction}</span>
            </div>

            <div className={styles.agentNext}>
              <span className={styles.agentNextLabel}>Next: </span>
              {agent.nextAction}
            </div>

            <div className={styles.agentStats}>
              <div className={styles.agentStat}>
                <span className={styles.agentStatVal}>{agent.actionsToday}</span>
                <span className={styles.agentStatLbl}>actions today</span>
              </div>
              {agent.ticketsHandled > 0 && (
                <div className={styles.agentStat}>
                  <span className={styles.agentStatVal}>{agent.ticketsHandled}</span>
                  <span className={styles.agentStatLbl}>tickets</span>
                </div>
              )}
            </div>

            <div className={styles.agentFooter}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>
                {agent.status === "active" ? "Running" : agent.status === "paused" ? "Paused" : "Idle"}
              </span>
              <button
                className={`${styles.agentBtn} ${styles.agentBtnPause}`}
                onClick={() => toggleAgent(agent.id)}
              >
                {agent.status === "paused" ? <><RiPlayLine size={11} /> Resume</> : <><RiPauseLine size={11} /> Pause</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem", color: "var(--text-3)" }}>
        <RiSparklingLine size={12} color="var(--accent)" />
        Agents operate continuously. You receive approval requests for actions above your risk threshold. Everything else, agents handle autonomously.
      </div>
    </div>
  );
}
