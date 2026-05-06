import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SideDrawer from "@/components/ui/SideDrawer";
import {
  fetchAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
} from "@/services/api";
import type { AutomationRule } from "@/services/api";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEditLine,
  RiLightbulbLine,
} from "react-icons/ri";
import styles from "./AutomationRuleBuilder.module.css";

interface Props {
  pod: string;
}

const TRIGGER_OPTIONS: { value: string; label: string }[] = [
  { value: "status_change", label: "Status changed" },
  { value: "ticket_created", label: "Ticket created" },
  { value: "ticket_assigned", label: "Ticket assigned" },
  { value: "sprint_started", label: "Sprint started" },
  { value: "sprint_completed", label: "Sprint completed" },
  { value: "due_date_reached", label: "Due date reached" },
];

const CONDITION_OPTIONS: { value: string; label: string }[] = [
  { value: "always", label: "Always (no condition)" },
  { value: "priority_is", label: "Priority is…" },
  { value: "assignee_is", label: "Assignee is…" },
  { value: "issue_type_is", label: "Issue type is…" },
  { value: "status_is", label: "Status is…" },
];

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "set_status", label: "Set status" },
  { value: "assign_to", label: "Assign to user" },
  { value: "set_priority", label: "Set priority" },
  { value: "add_label", label: "Add label" },
  { value: "post_comment", label: "Post comment" },
  { value: "create_subtask", label: "Create subtask" },
  { value: "notify_slack", label: "Send Slack notification" },
];

const PRIORITY_OPTIONS = ["Highest", "High", "Medium", "Low", "Lowest"];
const ISSUE_TYPE_OPTIONS = ["Story", "Bug", "Task", "Epic", "Subtask"];
const STATUS_OPTIONS = ["To Do", "In Progress", "In Review", "Done"];

export default function AutomationRuleBuilder({ pod }: Props) {
  const qc = useQueryClient();
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["automations", pod],
    queryFn: () => fetchAutomations(pod),
  });

  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);

  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("ticket_created");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [conditionType, setConditionType] = useState("always");
  const [conditionConfig, setConditionConfig] = useState<Record<string, any>>(
    {},
  );
  const [actionType, setActionType] = useState("set_status");
  const [actionConfig, setActionConfig] = useState<Record<string, any>>({});

  const resetForm = () => {
    setName("");
    setTriggerType("ticket_created");
    setTriggerConfig({});
    setConditionType("always");
    setConditionConfig({});
    setActionType("set_status");
    setActionConfig({});
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setShowDrawer(true);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditing(rule);
    setName(rule.name);
    setTriggerType(rule.trigger_type);
    setTriggerConfig(rule.trigger_config ?? {});
    setConditionType(rule.condition_type ?? "always");
    setConditionConfig(rule.condition_config ?? {});
    setActionType(rule.action_type);
    setActionConfig(rule.action_config ?? {});
    setShowDrawer(true);
  };

  const createMut = useMutation({
    mutationFn: () =>
      createAutomation(pod, {
        name,
        is_active: true,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        condition_type: conditionType === "always" ? undefined : conditionType,
        condition_config:
          conditionType === "always" ? undefined : conditionConfig,
        action_type: actionType,
        action_config: actionConfig,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations", pod] });
      toast.success("Automation rule created");
      setShowDrawer(false);
      resetForm();
    },
    onError: () => toast.error("Failed to create rule"),
  });

  const updateMut = useMutation({
    mutationFn: (payload: Partial<AutomationRule>) =>
      updateAutomation(pod, editing!.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations", pod] });
      toast.success("Automation rule updated");
    },
    onError: () => toast.error("Failed to update rule"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAutomation(pod, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations", pod] });
      toast.success("Rule deleted");
    },
    onError: () => toast.error("Failed to delete rule"),
  });

  const saveForm = () => {
    if (!name.trim()) {
      toast.error("Rule name is required");
      return;
    }
    if (editing) {
      updateMut.mutate({
        name,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        condition_type: conditionType === "always" ? undefined : conditionType,
        condition_config:
          conditionType === "always" ? undefined : conditionConfig,
        action_type: actionType,
        action_config: actionConfig,
      });
      setShowDrawer(false);
      resetForm();
    } else {
      createMut.mutate();
    }
  };

  const triggerLabel = useMemo(
    () =>
      TRIGGER_OPTIONS.find((o) => o.value === triggerType)?.label ??
      triggerType,
    [triggerType],
  );
  const actionLabel = useMemo(
    () =>
      ACTION_OPTIONS.find((o) => o.value === actionType)?.label ?? actionType,
    [actionType],
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.newBtn} onClick={openCreate}>
          <RiAddLine size={14} />
          New Rule
        </button>
      </div>

      {isLoading && <div className={styles.empty}>Loading…</div>}

      {!isLoading && rules.length === 0 && (
        <div className={styles.empty}>
          No automation rules yet.
          <br />
          <button className={styles.emptyBtn} onClick={openCreate}>
            Create your first rule
          </button>
        </div>
      )}

      <div className={styles.ruleList}>
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`${styles.ruleCard} ${!rule.is_active ? styles.inactive : ""}`}
          >
            <div className={styles.ruleLeft}>
              <div className={styles.ruleName}>
                <RiLightbulbLine size={14} className={styles.ruleIcon} />
                {rule.name}
              </div>
              <div className={styles.ruleMeta}>
                {TRIGGER_OPTIONS.find((o) => o.value === rule.trigger_type)
                  ?.label ?? rule.trigger_type}
                {" → "}
                {rule.condition_type && rule.condition_type !== "always"
                  ? (CONDITION_OPTIONS.find(
                      (o) => o.value === rule.condition_type,
                    )?.label ?? rule.condition_type)
                  : "Always"}
                {" → "}
                {ACTION_OPTIONS.find((o) => o.value === rule.action_type)
                  ?.label ?? rule.action_type}
              </div>
            </div>

            <div className={styles.ruleRight}>
              <span className={styles.runCount}>
                {rule.run_count ?? 0} runs
              </span>
              {/* <button
                className={styles.iconBtn}
                onClick={() => toggleActive(rule)}
                title={rule.is_active ? "Disable" : "Enable"}
              >
                {rule.is_active ? (
                  <RiToggleFill size={18} color="var(--accent)" />
                ) : (
                  <RiToggleLine size={18} />
                )}
              </button> */}
              <button
                className={styles.iconBtn}
                onClick={() => openEdit(rule)}
                title="Edit"
              >
                <RiEditLine size={16} />
              </button>
              <button
                className={styles.iconBtnDanger}
                onClick={() => {
                  if (confirm("Delete this automation rule?"))
                    deleteMut.mutate(rule.id);
                }}
                title="Delete"
              >
                <RiDeleteBinLine size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Drawer ── */}
      <SideDrawer
        open={showDrawer}
        onClose={() => {
          setShowDrawer(false);
          resetForm();
        }}
        size="xs"
        title={editing ? "Edit Rule" : "New Automation Rule"}
        subtitle={`${triggerLabel} → ${actionLabel}`}
        footer={
          <div className={styles.footerBar}>
            <button
              className={styles.footerSecondary}
              onClick={() => {
                setShowDrawer(false);
                resetForm();
              }}
            >
              Cancel
            </button>
            <button
              className={styles.footerPrimary}
              onClick={saveForm}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editing ? "Save Changes" : "Create Rule"}
            </button>
          </div>
        }
      >
        <div className={styles.form}>
          {/* Name */}
          <label className={styles.fieldLabel}>Rule name</label>
          <input
            className={styles.textInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Auto-assign bugs to QA"
          />

          {/* ── Trigger ── */}
          <div className={styles.sectionTitle}>1. Trigger</div>
          <label className={styles.fieldLabel}>When this happens…</label>
          <select
            className={styles.select}
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value)}
          >
            {TRIGGER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {triggerType === "status_change" && (
            <>
              <label className={styles.fieldLabel}>
                From status (optional)
              </label>
              <select
                className={styles.select}
                value={triggerConfig.from_status ?? ""}
                onChange={(e) =>
                  setTriggerConfig({
                    ...triggerConfig,
                    from_status: e.target.value || undefined,
                  })
                }
              >
                <option value="">Any status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <label className={styles.fieldLabel}>To status (optional)</label>
              <select
                className={styles.select}
                value={triggerConfig.to_status ?? ""}
                onChange={(e) =>
                  setTriggerConfig({
                    ...triggerConfig,
                    to_status: e.target.value || undefined,
                  })
                }
              >
                <option value="">Any status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </>
          )}

          {/* ── Condition ── */}
          <div className={styles.sectionTitle}>2. Condition</div>
          <label className={styles.fieldLabel}>If…</label>
          <select
            className={styles.select}
            value={conditionType}
            onChange={(e) => {
              setConditionType(e.target.value);
              setConditionConfig({});
            }}
          >
            {CONDITION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {conditionType === "priority_is" && (
            <>
              <label className={styles.fieldLabel}>Priority</label>
              <select
                className={styles.select}
                value={conditionConfig.priority ?? ""}
                onChange={(e) =>
                  setConditionConfig({ priority: e.target.value })
                }
              >
                <option value="">Select…</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </>
          )}

          {conditionType === "issue_type_is" && (
            <>
              <label className={styles.fieldLabel}>Issue type</label>
              <select
                className={styles.select}
                value={conditionConfig.issue_type ?? ""}
                onChange={(e) =>
                  setConditionConfig({ issue_type: e.target.value })
                }
              >
                <option value="">Select…</option>
                {ISSUE_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </>
          )}

          {conditionType === "status_is" && (
            <>
              <label className={styles.fieldLabel}>Status</label>
              <select
                className={styles.select}
                value={conditionConfig.status ?? ""}
                onChange={(e) => setConditionConfig({ status: e.target.value })}
              >
                <option value="">Select…</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </>
          )}

          {conditionType === "assignee_is" && (
            <>
              <label className={styles.fieldLabel}>Assignee user ID</label>
              <input
                className={styles.textInput}
                value={conditionConfig.assignee ?? ""}
                onChange={(e) =>
                  setConditionConfig({ assignee: e.target.value })
                }
                placeholder="User ID"
              />
            </>
          )}

          {/* ── Action ── */}
          <div className={styles.sectionTitle}>3. Action</div>
          <label className={styles.fieldLabel}>Then do this…</label>
          <select
            className={styles.select}
            value={actionType}
            onChange={(e) => {
              setActionType(e.target.value);
              setActionConfig({});
            }}
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {actionType === "set_status" && (
            <>
              <label className={styles.fieldLabel}>Set status to</label>
              <select
                className={styles.select}
                value={actionConfig.status ?? ""}
                onChange={(e) => setActionConfig({ status: e.target.value })}
              >
                <option value="">Select…</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </>
          )}

          {actionType === "assign_to" && (
            <>
              <label className={styles.fieldLabel}>Assign to user ID</label>
              <input
                className={styles.textInput}
                value={actionConfig.user_id ?? ""}
                onChange={(e) => setActionConfig({ user_id: e.target.value })}
                placeholder="User ID"
              />
            </>
          )}

          {actionType === "set_priority" && (
            <>
              <label className={styles.fieldLabel}>Set priority to</label>
              <select
                className={styles.select}
                value={actionConfig.priority ?? ""}
                onChange={(e) => setActionConfig({ priority: e.target.value })}
              >
                <option value="">Select…</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </>
          )}

          {actionType === "add_label" && (
            <>
              <label className={styles.fieldLabel}>Label to add</label>
              <input
                className={styles.textInput}
                value={actionConfig.label ?? ""}
                onChange={(e) => setActionConfig({ label: e.target.value })}
                placeholder="e.g. needs-review"
              />
            </>
          )}

          {actionType === "post_comment" && (
            <>
              <label className={styles.fieldLabel}>Comment body</label>
              <textarea
                className={styles.textarea}
                value={actionConfig.comment_body ?? ""}
                onChange={(e) =>
                  setActionConfig({ comment_body: e.target.value })
                }
                placeholder="Write the automated comment…"
                rows={3}
              />
            </>
          )}

          {actionType === "create_subtask" && (
            <>
              <label className={styles.fieldLabel}>Subtask summary</label>
              <input
                className={styles.textInput}
                value={actionConfig.subtask_summary ?? ""}
                onChange={(e) =>
                  setActionConfig({ subtask_summary: e.target.value })
                }
                placeholder="e.g. Write tests"
              />
            </>
          )}

          {actionType === "notify_slack" && (
            <>
              <label className={styles.fieldLabel}>Slack webhook URL</label>
              <input
                className={styles.textInput}
                value={actionConfig.webhook_url ?? ""}
                onChange={(e) =>
                  setActionConfig({
                    ...actionConfig,
                    webhook_url: e.target.value,
                  })
                }
                placeholder="https://hooks.slack.com/services/..."
              />
              <label className={styles.fieldLabel}>Message (optional)</label>
              <input
                className={styles.textInput}
                value={actionConfig.message ?? ""}
                onChange={(e) =>
                  setActionConfig({ ...actionConfig, message: e.target.value })
                }
                placeholder="e.g. Ticket status updated"
              />
            </>
          )}
        </div>
      </SideDrawer>
    </div>
  );
}
