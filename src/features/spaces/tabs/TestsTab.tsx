import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SideDrawer from "@/components/ui/SideDrawer";
import {
  fetchTestCases,
  createTestCase,
  deleteTestCase,
  generateTestCases,
  fetchTestCycles,
  createTestCycle,
  updateTestCycle,
  deleteTestCycle,
  fetchTestExecutions,
  addTestToCycle,
  updateTestExecution,
  fetchTestCoverage,
  fetchPodTickets,
} from "@/services/api";
import type { TestCase, TestCycle, TestExecution, TestCoverage } from "@/types";
import styles from "./TestsTab.module.css";

import {
  RiAddLine,
  RiSparklingLine,
  RiDeleteBinLine,
  RiCheckLine,
  RiCloseLine,
  RiAlertLine,
  RiSkipForwardLine,
  RiFlashlightLine,
  RiTestTubeLine,
  RiLoopLeftLine,
  RiShieldCheckLine,
  RiTimeLine,
  RiArrowLeftLine,
  RiSearchLine,
} from "react-icons/ri";

function EOSBadge() {
  return (
    <span className={styles.eosBadge}>
      <RiSparklingLine size={9} />
      EOS
    </span>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  high: "var(--red)",
  medium: "var(--amber)",
  low: "var(--green)",
};

const EXEC_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    color: "var(--text-3)",
    icon: <RiTimeLine size={12} />,
  },
  passed: {
    label: "Passed",
    color: "var(--green)",
    icon: <RiCheckLine size={12} />,
  },
  failed: {
    label: "Failed",
    color: "var(--red)",
    icon: <RiCloseLine size={12} />,
  },
  blocked: {
    label: "Blocked",
    color: "var(--amber)",
    icon: <RiAlertLine size={12} />,
  },
  skipped: {
    label: "Skipped",
    color: "var(--text-2)",
    icon: <RiSkipForwardLine size={12} />,
  },
};

type SubTab = "cases" | "cycles" | "coverage";

/* ── Ticket Picker used in Create Test Case drawer ── */
function TicketPicker({
  pod,
  value,
  onChange,
}: {
  pod: string;
  value: string;
  onChange: (key: string, summary: string) => void;
}) {
  const [searchRaw, setSearchRaw] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSearch(val: string) {
    setSearchRaw(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 300);
  }

  const { data, isFetching } = useQuery({
    queryKey: ["pod-tickets-test", pod, search],
    queryFn: () => fetchPodTickets(pod, search || undefined),
    enabled: open,
    placeholderData: (prev) => prev,
  });

  const tickets = data?.tickets ?? [];

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div className={styles.ticketPickerInput} onClick={() => setOpen(!open)}>
        {value ? (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--accent)",
              fontWeight: 700,
            }}
          >
            {value}
          </span>
        ) : (
          <span style={{ color: "var(--text-3)", fontSize: 13 }}>
            Search & select ticket (optional)
          </span>
        )}
        {value && (
          <button
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "var(--text-3)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onChange("", "");
              setSearchRaw("");
            }}
          >
            <RiCloseLine size={13} />
          </button>
        )}
        {!value && (
          <RiSearchLine
            size={13}
            style={{ marginLeft: "auto", color: "var(--text-3)" }}
          />
        )}
      </div>

      {open && (
        <div className={styles.ticketPickerDropdown}>
          <div className={styles.ticketPickerSearch}>
            <RiSearchLine
              size={13}
              style={{ color: "var(--text-3)", flexShrink: 0 }}
            />
            <input
              className={styles.ticketPickerSearchInput}
              placeholder="Search tickets…"
              value={searchRaw}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.ticketPickerList}>
            {isFetching && tickets.length === 0 && (
              <div className={styles.ticketPickerEmpty}>Searching…</div>
            )}
            {!isFetching && tickets.length === 0 && (
              <div className={styles.ticketPickerEmpty}>No tickets found.</div>
            )}
            {tickets.map((t) => (
              <button
                key={t.key}
                className={styles.ticketPickerItem}
                onClick={() => {
                  onChange(t.key, t.summary);
                  setOpen(false);
                  setSearchRaw("");
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--accent)",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {t.key}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text)",
                    flex: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {t.summary}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Create Test Case Drawer ── */
function CreateTestCaseDrawer({
  pod,
  onClose,
}: {
  pod: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [pre, setPre] = useState("");
  const [priority, setPriority] = useState("medium");
  const [ticketKey, setTicketKey] = useState("");
  const [steps, setSteps] = useState([{ step: "", expected_result: "" }]);

  const createMut = useMutation({
    mutationFn: () =>
      createTestCase(pod, {
        title: title.trim(),
        description: desc || undefined,
        preconditions: pre || undefined,
        steps: steps.filter((s) => s.step.trim()),
        priority,
        ticket_key: ticketKey || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-cases", pod] });
      toast.success("Test case created");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addStep() {
    setSteps([...steps, { step: "", expected_result: "" }]);
  }
  function updateStep(
    idx: number,
    field: "step" | "expected_result",
    val: string,
  ) {
    const updated = [...steps];
    updated[idx][field] = val;
    setSteps(updated);
  }
  function removeStep(idx: number) {
    setSteps(steps.filter((_, i) => i !== idx));
  }

  return (
    <SideDrawer
      open
      onClose={onClose}
      size="md"
      title="New Test Case"
      badge={
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--accent)",
            background: "var(--accent-glow)",
            border: "1px solid var(--accent-border)",
            padding: "2px 10px",
            borderRadius: 99,
          }}
        >
          <RiTestTubeLine size={10} style={{ marginRight: 4 }} />
          Manual
        </span>
      }
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className={styles.footerSaveBtn}
            onClick={() => createMut.mutate()}
            disabled={!title.trim() || createMut.isPending}
          >
            {createMut.isPending ? "Creating…" : "Create Test Case"}
          </button>
          <button className={styles.footerCancelBtn} onClick={onClose}>
            Cancel
          </button>
        </div>
      }
    >
      <div className={styles.drawerForm}>
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Title *</label>
          <input
            className={styles.fieldInput}
            placeholder="e.g. Verify login with valid credentials"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div className={styles.formRow2}>
          <div className={styles.formField} style={{ flex: 1 }}>
            <label className={styles.fieldLabel}>Priority</label>
            <select
              className={styles.fieldSelect}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className={styles.formField} style={{ flex: 2 }}>
            <label className={styles.fieldLabel}>Linked Ticket</label>
            <TicketPicker
              pod={pod}
              value={ticketKey}
              onChange={(key, _summary) => setTicketKey(key)}
            />
          </div>
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Description</label>
          <textarea
            className={styles.fieldTextarea}
            placeholder="What is this test case verifying?"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Preconditions</label>
          <textarea
            className={styles.fieldTextarea}
            placeholder="e.g. User must have a valid account"
            value={pre}
            onChange={(e) => setPre(e.target.value)}
            rows={2}
          />
        </div>

        <div className={styles.formField}>
          <div className={styles.stepsHeader}>
            <label className={styles.fieldLabel} style={{ margin: 0 }}>
              Steps
            </label>
            <button
              type="button"
              className={styles.addStepBtn}
              onClick={addStep}
            >
              <RiAddLine size={12} /> Add Step
            </button>
          </div>
          <div className={styles.stepsBody}>
            {steps.map((s, i) => (
              <div key={i} className={styles.stepRow}>
                <span className={styles.stepNum}>{i + 1}</span>
                <div className={styles.stepInputs}>
                  <input
                    className={styles.fieldInput}
                    placeholder="Action"
                    value={s.step}
                    onChange={(e) => updateStep(i, "step", e.target.value)}
                  />
                  <input
                    className={`${styles.fieldInput} ${styles.expectedInput}`}
                    placeholder="Expected result"
                    value={s.expected_result}
                    onChange={(e) =>
                      updateStep(i, "expected_result", e.target.value)
                    }
                  />
                </div>
                {steps.length > 1 && (
                  <button
                    className={styles.removeStepBtn}
                    onClick={() => removeStep(i)}
                  >
                    <RiCloseLine size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SideDrawer>
  );
}

/* ── Generate with EOS Drawer ── */
function GenerateTestCasesDrawer({
  pod,
  onClose,
}: {
  pod: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [ticketKey, setTicketKey] = useState("");
  const [summary, setSummary] = useState("");
  const [desc, setDesc] = useState("");
  const [count, setCount] = useState(5);

  function handleTicketSelect(key: string, ticketSummary: string) {
    setTicketKey(key);
    if (ticketSummary && !summary) setSummary(ticketSummary);
  }

  const generateMut = useMutation({
    mutationFn: () =>
      generateTestCases(pod, {
        ticket_key: ticketKey,
        ticket_summary: summary,
        ticket_description: desc || undefined,
        count,
      }),
    onSuccess: (newCases) => {
      qc.invalidateQueries({ queryKey: ["test-cases", pod] });
      toast.success(`${newCases.length} test cases generated by EOS`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SideDrawer
      open
      onClose={onClose}
      size="sm"
      title="Generate Test Cases"
      badge={
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--accent)",
            background: "var(--accent-glow)",
            border: "1px solid var(--accent-border)",
            padding: "2px 10px",
            borderRadius: 99,
          }}
        >
          <RiSparklingLine size={10} style={{ marginRight: 4 }} />
          EOS AI
        </span>
      }
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className={styles.footerGenerateBtn}
            onClick={() => generateMut.mutate()}
            disabled={
              !ticketKey.trim() || !summary.trim() || generateMut.isPending
            }
          >
            {generateMut.isPending ? (
              "Generating…"
            ) : (
              <>
                <RiSparklingLine size={13} /> Generate
              </>
            )}
          </button>
          <button className={styles.footerCancelBtn} onClick={onClose}>
            Cancel
          </button>
        </div>
      }
    >
      <div className={styles.drawerForm}>
        <div className={styles.eosHint}>
          <RiSparklingLine size={12} />
          EOS will analyse the ticket and auto-generate detailed test cases
          including edge cases.
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Ticket *</label>
          <TicketPicker
            pod={pod}
            value={ticketKey}
            onChange={handleTicketSelect}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Ticket Summary *</label>
          <input
            className={styles.fieldInput}
            placeholder="Brief description of what's being tested"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>
            Ticket Description{" "}
            <span
              style={{ fontWeight: 400, textTransform: "none", fontSize: 10 }}
            >
              (optional — improves quality)
            </span>
          </label>
          <textarea
            className={styles.fieldTextarea}
            placeholder="Paste the full ticket description for better results…"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={4}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Number of test cases</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="range"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              style={{ flex: 1, accentColor: "var(--accent)" }}
            />
            <span
              style={{
                minWidth: 24,
                textAlign: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                fontWeight: 700,
                color: "var(--accent)",
              }}
            >
              {count}
            </span>
          </div>
        </div>
      </div>
    </SideDrawer>
  );
}

/* ── Create Cycle Drawer ── */
function CreateCycleDrawer({
  pod,
  onClose,
}: {
  pod: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      createTestCycle(pod, {
        name: name.trim(),
        description: desc || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-cycles", pod] });
      toast.success("Test cycle created");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SideDrawer
      open
      onClose={onClose}
      size="sm"
      title="New Test Cycle"
      badge={
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--amber)",
            background: "rgba(251,191,36,0.12)",
            border: "1px solid rgba(251,191,36,0.28)",
            padding: "2px 10px",
            borderRadius: 99,
          }}
        >
          <RiLoopLeftLine size={10} style={{ marginRight: 4 }} />
          Cycle
        </span>
      }
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className={styles.footerSaveBtn}
            onClick={() => createMut.mutate()}
            disabled={!name.trim() || createMut.isPending}
          >
            {createMut.isPending ? "Creating…" : "Create Cycle"}
          </button>
          <button className={styles.footerCancelBtn} onClick={onClose}>
            Cancel
          </button>
        </div>
      }
    >
      <div className={styles.drawerForm}>
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Cycle Name *</label>
          <input
            className={styles.fieldInput}
            placeholder="e.g. Sprint 12 Regression"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Description</label>
          <textarea
            className={styles.fieldTextarea}
            placeholder="What does this cycle cover?"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
          />
        </div>
      </div>
    </SideDrawer>
  );
}

// ── Test Cases View ────────────────────────────────────────────────────────────

function TestCasesView({ pod }: { pod: string }) {
  const qc = useQueryClient();
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["test-cases", pod],
    queryFn: () => fetchTestCases(pod),
  });

  const [drawerCase, setDrawerCase] = useState<TestCase | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const deleteMut = useMutation({
    mutationFn: (caseId: string) => deleteTestCase(pod, caseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-cases", pod] });
      toast.success("Test case deleted");
      setDrawerCase(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading)
    return <div className={styles.loading}>Loading test cases…</div>;

  return (
    <div>
      <div className={styles.subHeader}>
        <div className={styles.actions}>
          <button
            className={styles.generateBtn}
            onClick={() => setShowGenerate(true)}
          >
            <RiSparklingLine size={13} /> Generate with EOS
          </button>
          <button
            className={styles.createBtn}
            onClick={() => setShowCreate(true)}
          >
            <RiAddLine size={14} /> New Test Case
          </button>
        </div>
      </div>

      <div className={styles.caseList}>
        {cases.map((tc) => (
          <div
            key={tc.id}
            className={styles.caseRow}
            onClick={() => setDrawerCase(tc)}
          >
            <div className={styles.caseLeft}>
              <span
                className={styles.priorityDot}
                style={{ background: PRIORITY_COLOR[tc.priority] }}
                title={tc.priority}
              />
              <span className={styles.caseTitle}>{tc.title}</span>
              {tc.ai_generated && <EOSBadge />}
            </div>
            <div className={styles.caseMeta}>
              {tc.ticket_key && (
                <span className={styles.ticketKey}>{tc.ticket_key}</span>
              )}
              <span className={styles.stepsCount}>
                {tc.steps?.length ?? 0} steps
              </span>
            </div>
          </div>
        ))}
        {cases.length === 0 && (
          <div className={styles.empty}>
            No test cases yet. Create one manually or generate with EOS.
          </div>
        )}
      </div>

      {/* Drawers */}
      {showCreate && (
        <CreateTestCaseDrawer pod={pod} onClose={() => setShowCreate(false)} />
      )}
      {showGenerate && (
        <GenerateTestCasesDrawer
          pod={pod}
          onClose={() => setShowGenerate(false)}
        />
      )}

      {/* Case Detail Drawer */}
      {drawerCase && (
        <SideDrawer
          open={Boolean(drawerCase)}
          onClose={() => setDrawerCase(null)}
          size="md"
          title={drawerCase.title}
          badge={
            drawerCase.ai_generated ? (
              <span className={styles.aiGenBadge}>
                <EOSBadge />
              </span>
            ) : undefined
          }
          stats={[
            { label: "Priority", value: drawerCase.priority },
            { label: "Steps", value: String(drawerCase.steps?.length ?? 0) },
            ...(drawerCase.ticket_key
              ? [{ label: "Ticket", value: drawerCase.ticket_key }]
              : []),
          ]}
        >
          <div className={styles.drawerBody}>
            {drawerCase.description && (
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionTitle}>Description</div>
                <p className={styles.drawerText}>{drawerCase.description}</p>
              </div>
            )}
            {drawerCase.preconditions && (
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionTitle}>Preconditions</div>
                <p className={styles.drawerText}>{drawerCase.preconditions}</p>
              </div>
            )}
            {drawerCase.steps && drawerCase.steps.length > 0 && (
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionTitle}>Steps</div>
                <div className={styles.drawerSteps}>
                  {drawerCase.steps.map((s, i) => (
                    <div key={i} className={styles.drawerStep}>
                      <span className={styles.drawerStepNum}>{i + 1}</span>
                      <div className={styles.drawerStepContent}>
                        <div className={styles.drawerStepAction}>{s.step}</div>
                        <div className={styles.drawerStepExpected}>
                          → {s.expected_result}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className={styles.drawerActions}>
              <button
                className={styles.drawerDangerBtn}
                onClick={() => deleteMut.mutate(drawerCase.id)}
                disabled={deleteMut.isPending}
              >
                <RiDeleteBinLine size={13} />{" "}
                {deleteMut.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </SideDrawer>
      )}
    </div>
  );
}

// ── Cycles View ────────────────────────────────────────────────────────────────

function CyclesView({ pod }: { pod: string }) {
  const qc = useQueryClient();
  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ["test-cycles", pod],
    queryFn: () => fetchTestCycles(pod),
  });
  const { data: allCases = [] } = useQuery({
    queryKey: ["test-cases", pod],
    queryFn: () => fetchTestCases(pod),
  });

  const [activeCycle, setActiveCycle] = useState<TestCycle | null>(null);
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [loadingExecs, setLoadingExecs] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddCase, setShowAddCase] = useState(false);

  const deleteMut = useMutation({
    mutationFn: (cycleId: string) => deleteTestCycle(pod, cycleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-cycles", pod] });
      toast.success("Cycle deleted");
      setActiveCycle(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: ({ cycleId, status }: { cycleId: string; status: string }) =>
      updateTestCycle(pod, cycleId, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["test-cycles", pod] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const execMut = useMutation({
    mutationFn: ({
      execId,
      status,
      notes,
    }: {
      execId: string;
      status: string;
      notes?: string;
    }) => updateTestExecution(pod, execId, { status, notes }),
    onSuccess: async () => {
      if (activeCycle) {
        const updated = await fetchTestExecutions(pod, activeCycle.id);
        setExecutions(updated);
      }
      qc.invalidateQueries({ queryKey: ["test-cycles", pod] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCaseMut = useMutation({
    mutationFn: (testCaseId: string) =>
      addTestToCycle(pod, activeCycle!.id, testCaseId),
    onSuccess: async () => {
      if (activeCycle) {
        const updated = await fetchTestExecutions(pod, activeCycle.id);
        setExecutions(updated);
        qc.invalidateQueries({ queryKey: ["test-cycles", pod] });
        toast.success("Test case added to cycle");
      }
      setShowAddCase(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openCycle(cycle: TestCycle) {
    setActiveCycle(cycle);
    setLoadingExecs(true);
    try {
      const execs = await fetchTestExecutions(pod, cycle.id);
      setExecutions(execs);
    } finally {
      setLoadingExecs(false);
    }
  }

  const addedCaseIds = new Set(executions.map((e) => e.test_case_id));
  const availableCases = allCases.filter((c) => !addedCaseIds.has(c.id));

  if (activeCycle) {
    const cfg = (s: string) =>
      EXEC_STATUS_CONFIG[s] ?? EXEC_STATUS_CONFIG.pending;
    const passedPct =
      activeCycle.total > 0
        ? Math.round(
            (executions.filter((e) => e.status === "passed").length /
              activeCycle.total) *
              100,
          )
        : 0;

    return (
      <div>
        <div className={styles.subHeader}>
          <button
            className={styles.backBtn}
            onClick={() => setActiveCycle(null)}
          >
            <RiArrowLeftLine size={14} /> All Cycles
          </button>
          <button
            className={styles.createBtn}
            onClick={() => setShowAddCase(true)}
          >
            <RiAddLine size={14} /> Add Test Case
          </button>
        </div>

        <div className={styles.cycleDetailHeader}>
          <h3 className={styles.cycleDetailName}>{activeCycle.name}</h3>
          <div className={styles.cycleDetailMeta}>
            <div className={styles.cycleProgress}>
              <div className={styles.cycleProgressBar}>
                <div
                  className={styles.cycleProgressFill}
                  style={{ width: `${passedPct}%` }}
                />
              </div>
              <span className={styles.cycleProgressLabel}>
                {passedPct}% passed
              </span>
            </div>
            <div className={styles.cyclePills}>
              <span className={styles.pillPassed}>
                {executions.filter((e) => e.status === "passed").length} passed
              </span>
              <span className={styles.pillFailed}>
                {executions.filter((e) => e.status === "failed").length} failed
              </span>
              <span className={styles.pillBlocked}>
                {executions.filter((e) => e.status === "blocked").length}{" "}
                blocked
              </span>
              <span className={styles.pillPending}>
                {executions.filter((e) => e.status === "pending").length}{" "}
                pending
              </span>
            </div>
          </div>
          <div className={styles.cycleDetailActions}>
            {activeCycle.status === "planning" && (
              <button
                className={styles.startBtn}
                onClick={() =>
                  statusMut.mutate({
                    cycleId: activeCycle.id,
                    status: "active",
                  })
                }
              >
                <RiFlashlightLine size={12} /> Start Cycle
              </button>
            )}
            {activeCycle.status === "active" && (
              <button
                className={styles.completeBtn}
                onClick={() =>
                  statusMut.mutate({
                    cycleId: activeCycle.id,
                    status: "completed",
                  })
                }
              >
                <RiCheckLine size={12} /> Complete
              </button>
            )}
            <button
              className={styles.deleteSmallBtn}
              onClick={() => deleteMut.mutate(activeCycle.id)}
            >
              <RiDeleteBinLine size={12} />
            </button>
          </div>
        </div>

        {showAddCase && (
          <div className={styles.addCasePanel}>
            <div className={styles.addCasePanelTitle}>
              Add test cases to this cycle
            </div>
            {availableCases.length === 0 ? (
              <div className={styles.empty}>
                All test cases are already in this cycle.
              </div>
            ) : (
              availableCases.map((tc) => (
                <div key={tc.id} className={styles.addCaseRow}>
                  <span className={styles.addCaseTitle}>{tc.title}</span>
                  {tc.ticket_key && (
                    <span className={styles.ticketKey}>{tc.ticket_key}</span>
                  )}
                  <button
                    className={styles.addCaseAddBtn}
                    onClick={() => addCaseMut.mutate(tc.id)}
                  >
                    <RiAddLine size={12} />
                  </button>
                </div>
              ))
            )}
            <button
              className={styles.cancelBtn}
              style={{ marginTop: 8 }}
              onClick={() => setShowAddCase(false)}
            >
              Done
            </button>
          </div>
        )}

        {loadingExecs ? (
          <div className={styles.loading}>Loading executions…</div>
        ) : executions.length === 0 ? (
          <div className={styles.empty}>
            No test cases in this cycle yet. Add some above.
          </div>
        ) : (
          <div className={styles.execList}>
            {executions.map((ex) => {
              const c = cfg(ex.status);
              return (
                <div key={ex.id} className={styles.execRow}>
                  <div className={styles.execLeft}>
                    <span style={{ color: c.color }}>{c.icon}</span>
                    <span className={styles.execTitle}>
                      {ex.test_case?.title ?? "—"}
                    </span>
                    {ex.test_case?.ai_generated && <EOSBadge />}
                  </div>
                  <div className={styles.execRight}>
                    {ex.test_case?.ticket_key && (
                      <span className={styles.ticketKey}>
                        {ex.test_case.ticket_key}
                      </span>
                    )}
                    <div className={styles.execBtns}>
                      {["passed", "failed", "blocked", "skipped"].map((s) => (
                        <button
                          key={s}
                          className={`${styles.execBtn} ${ex.status === s ? styles.execBtnActive : ""}`}
                          style={
                            ex.status === s
                              ? {
                                  color: EXEC_STATUS_CONFIG[s].color,
                                  borderColor: EXEC_STATUS_CONFIG[s].color,
                                }
                              : {}
                          }
                          onClick={() =>
                            execMut.mutate({ execId: ex.id, status: s })
                          }
                          title={s}
                        >
                          {EXEC_STATUS_CONFIG[s].icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (isLoading) return <div className={styles.loading}>Loading cycles…</div>;

  return (
    <div>
      <div className={styles.subHeader}>
        <span className={styles.count}>
          {cycles.length} cycle{cycles.length !== 1 ? "s" : ""}
        </span>
        <button
          className={styles.createBtn}
          onClick={() => setShowCreate(true)}
        >
          <RiAddLine size={14} /> New Cycle
        </button>
      </div>

      <div className={styles.cycleGrid}>
        {cycles.map((cycle) => {
          const passedPct =
            cycle.total > 0
              ? Math.round((cycle.passed / cycle.total) * 100)
              : 0;
          const statusColor =
            cycle.status === "completed"
              ? "var(--green)"
              : cycle.status === "active"
                ? "var(--accent)"
                : "var(--text-3)";
          return (
            <div
              key={cycle.id}
              className={styles.cycleCard}
              onClick={() => openCycle(cycle)}
            >
              <div className={styles.cycleCardTop}>
                <span className={styles.cycleName}>{cycle.name}</span>
                <span
                  className={styles.cycleStatus}
                  style={{ color: statusColor }}
                >
                  {cycle.status}
                </span>
              </div>
              {cycle.description && (
                <p className={styles.cycleDesc}>{cycle.description}</p>
              )}
              <div className={styles.cycleBar}>
                <div
                  className={styles.cycleBarFill}
                  style={{ width: `${passedPct}%` }}
                />
              </div>
              <div className={styles.cycleStats}>
                <span className={styles.pillPassed}>{cycle.passed} passed</span>
                <span className={styles.pillFailed}>{cycle.failed} failed</span>
                <span className={styles.pillPending}>
                  {cycle.pending} pending
                </span>
                <span className={styles.cycleTotalStat}>
                  {cycle.total} total
                </span>
              </div>
            </div>
          );
        })}
        {cycles.length === 0 && (
          <div className={styles.empty}>
            No test cycles yet. Create one to start running tests.
          </div>
        )}
      </div>

      {showCreate && (
        <CreateCycleDrawer pod={pod} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

// ── Coverage View ──────────────────────────────────────────────────────────────

function CoverageView({ pod }: { pod: string }) {
  const { data: coverage, isLoading } = useQuery<TestCoverage>({
    queryKey: ["test-coverage", pod],
    queryFn: () => fetchTestCoverage(pod),
    staleTime: 1000 * 60 * 5,
  });

  type UntestedTicket = TestCoverage["untested"][number];
  const [selectedTicket, setSelectedTicket] = useState<UntestedTicket | null>(
    null,
  );

  if (isLoading)
    return <div className={styles.loading}>EOS analysing coverage…</div>;
  if (!coverage)
    return <div className={styles.empty}>No coverage data available.</div>;

  const r = coverage.coverage_pct ?? 0;
  const coverageColor =
    r >= 80 ? "var(--green)" : r >= 50 ? "var(--amber)" : "var(--red)";

  const kpiCards = [
    {
      label: "Coverage",
      value: `${r}%`,
      sub: "of tickets tested",
      icon: <RiShieldCheckLine />,
      color: coverageColor,
    },
    {
      label: "Active Tickets",
      value: String(coverage.total_tickets),
      sub: "in active sprints",
      icon: <RiTestTubeLine />,
      color: "var(--accent)",
    },
    {
      label: "Tested",
      value: String(coverage.tested_tickets),
      sub: "have test cases",
      icon: <RiCheckLine />,
      color: "var(--green)",
    },
    {
      label: "Untested",
      value: String(coverage.untested_tickets),
      sub: "need coverage",
      icon: <RiAlertLine />,
      color: "var(--red)",
    },
  ];

  return (
    <div className={styles.coverageView}>
      {/* ── KPI Cards ── */}
      <div className={styles.kpiRow}>
        {kpiCards.map((card) => (
          <div key={card.label} className={styles.kpiCard}>
            <div className={styles.kpiTopRow}>
              <div className={styles.kpiLabel}>{card.label}</div>
              <span className={styles.kpiIconWrap}>{card.icon}</span>
            </div>
            <div>
              <div className={styles.kpiValue}>{card.value}</div>
              <div className={styles.kpiSub}>{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── EOS Insight Brief Bar ── */}
      {coverage.eos_insight && (
        <div className={styles.coverageBriefBar}>
          <div className={styles.coverageBriefGlow} />
          <div className={styles.coverageBriefContent}>
            <RiSparklingLine
              size={14}
              color="var(--accent)"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <p className={styles.coverageBriefText}>{coverage.eos_insight}</p>
            <span className={styles.eosBadge}>
              <RiSparklingLine size={9} /> EOS
            </span>
          </div>
        </div>
      )}

      {/* ── Untested Tickets Table ── */}
      {coverage.untested.length > 0 && (
        <div className={styles.untestedSection}>
          <div className={styles.untestedTitle}>
            Untested Tickets
            <span className={styles.untestedCount}>
              {coverage.untested.length}
            </span>
          </div>
          <div className={styles.untestedTable}>
            <div className={styles.untestedTableHead}>
              <span>Key</span>
              <span>Summary</span>
              <span>Priority</span>
              <span>Assignee</span>
            </div>
            {coverage.untested.map((t) => (
              <div
                key={t.key}
                className={styles.untestedTableRow}
                onClick={() => setSelectedTicket(t)}
              >
                <span className={styles.ticketKey}>{t.key}</span>
                <span className={styles.untestedSummary}>{t.summary}</span>
                <span
                  className={styles.priorityChip}
                  style={{
                    color:
                      PRIORITY_COLOR[t.priority?.toLowerCase()] ??
                      "var(--text-3)",
                  }}
                >
                  {t.priority ?? "—"}
                </span>
                <span className={styles.untestedAssignee}>
                  {t.assignee ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Ticket Detail Drawer ── */}
      {selectedTicket && (
        <SideDrawer
          open
          onClose={() => setSelectedTicket(null)}
          size="md"
          title={selectedTicket.key}
          badge={
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 99,
                color:
                  PRIORITY_COLOR[selectedTicket.priority?.toLowerCase()] ??
                  "var(--text-3)",
                background: "var(--surface-2)",
                border: "1px solid var(--border-2)",
              }}
            >
              {selectedTicket.priority} priority
            </span>
          }
        >
          <div className={styles.drawerBody}>
            <div className={styles.drawerSection}>
              <div className={styles.drawerSectionTitle}>Summary</div>
              <p className={styles.drawerText}>{selectedTicket.summary}</p>
            </div>
            {selectedTicket.assignee && (
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionTitle}>Assignee</div>
                <p className={styles.drawerText}>{selectedTicket.assignee}</p>
              </div>
            )}
            <div className={styles.drawerSection}>
              <div className={styles.drawerSectionTitle}>Coverage Status</div>
              <p className={styles.drawerText} style={{ color: "var(--red)" }}>
                No test cases are linked to this ticket yet.
              </p>
            </div>
          </div>
        </SideDrawer>
      )}
    </div>
  );
}

// ── Main TestsTab ──────────────────────────────────────────────────────────────

export default function TestsTab({ pod }: { pod: string }) {
  const [subTab, setSubTab] = useState<SubTab>("coverage");

  const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "coverage",
      label: "Coverage",
      icon: <RiShieldCheckLine size={14} />,
    },
    { id: "cases", label: "Test Cases", icon: <RiTestTubeLine size={14} /> },
    { id: "cycles", label: "Cycles", icon: <RiLoopLeftLine size={14} /> },
  ];

  return (
    <div className={styles.tab}>
      <div className={styles.header}>
        <div className={styles.subTabs}>
          {SUB_TABS.map((t) => (
            <button
              key={t.id}
              className={`${styles.subTabBtn} ${subTab === t.id ? styles.subTabBtnActive : ""}`}
              onClick={() => setSubTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === "cases" && <TestCasesView pod={pod} />}
      {subTab === "cycles" && <CyclesView pod={pod} />}
      {subTab === "coverage" && <CoverageView pod={pod} />}
    </div>
  );
}
