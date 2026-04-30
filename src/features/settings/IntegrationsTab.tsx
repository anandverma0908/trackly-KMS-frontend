import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegration,
} from "@/services/api";
import type { Integration, IntegrationType, IntegrationEvent } from "@/types";
import {
  RiSlackLine,
  RiAddLine,
  RiDeleteBinLine,
  RiEditLine,
  RiToggleFill,
  RiToggleLine,
  RiSendPlaneLine,
  RiCheckLine,
  RiWebhookLine,
} from "react-icons/ri";
import SideDrawer from "@/components/ui/SideDrawer";
import styles from "./IntegrationsTab.module.css";

const TYPE_OPTIONS: { value: IntegrationType; label: string; icon: React.ReactNode }[] = [
  { value: "slack", label: "Slack", icon: <RiSlackLine size={16} /> },
  { value: "teams", label: "Microsoft Teams", icon: <span style={{ fontSize: 14 }}>🔵</span> },
  { value: "generic_webhook", label: "Generic Webhook", icon: <RiWebhookLine size={16} /> },
];

const ALL_EVENTS: { value: IntegrationEvent; label: string; description: string }[] = [
  { value: "ticket_created",   label: "Ticket Created",   description: "When any ticket is created" },
  { value: "status_changed",   label: "Status Changed",   description: "When a ticket status changes" },
  { value: "sprint_started",   label: "Sprint Started",   description: "When a sprint begins" },
  { value: "sprint_completed", label: "Sprint Completed", description: "When a sprint ends" },
  { value: "mention",          label: "Mention",          description: "When someone is @mentioned" },
  { value: "comment_added",    label: "Comment Added",    description: "When a comment is posted" },
];

const TYPE_LABELS: Record<IntegrationType, string> = {
  slack:           "Slack",
  teams:           "Teams",
  generic_webhook: "Webhook",
};

interface FormState {
  name: string;
  type: IntegrationType;
  webhook_url: string;
  events: IntegrationEvent[];
  is_active: boolean;
}

const emptyForm = (): FormState => ({
  name: "",
  type: "slack",
  webhook_url: "",
  events: ["ticket_created", "status_changed"],
  is_active: true,
});

export default function IntegrationsTab() {
  const qc = useQueryClient();
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState<Integration | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: fetchIntegrations,
  });

  const createMut = useMutation({
    mutationFn: () => createIntegration(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integration created");
      setShowDrawer(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create integration"),
  });

  const updateMut = useMutation({
    mutationFn: (payload: Partial<FormState>) => updateIntegration(editing!.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integration updated");
      setShowDrawer(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update integration"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteIntegration(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integration deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateIntegration(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
    onError: (e: any) => toast.error(e.message ?? "Failed to update"),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowDrawer(true);
  };

  const openEdit = (i: Integration) => {
    setEditing(i);
    setForm({
      name: i.name,
      type: i.type,
      webhook_url: i.webhook_url,
      events: i.events,
      is_active: i.is_active,
    });
    setShowDrawer(true);
  };

  const toggleEvent = (ev: IntegrationEvent) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }));
  };

  const save = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.webhook_url.trim()) { toast.error("Webhook URL is required"); return; }
    if (form.events.length === 0) { toast.error("Select at least one event"); return; }
    if (editing) {
      updateMut.mutate(form);
    } else {
      createMut.mutate();
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await testIntegration(id);
      toast.success(result.message ?? "Test sent successfully");
    } catch (e: any) {
      toast.error(e.message ?? "Test failed — check the webhook URL");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.heading}>Integrations</h2>
          <p className={styles.subheading}>
            Connect Trackly to Slack, Microsoft Teams, or any webhook to get real-time notifications.
          </p>
        </div>
        <button className={styles.addBtn} onClick={openCreate}>
          <RiAddLine size={14} />
          Add Integration
        </button>
      </div>

      {isLoading && <div className={styles.empty}>Loading…</div>}

      {!isLoading && integrations.length === 0 && (
        <div className={styles.emptyState}>
          <RiSlackLine size={32} className={styles.emptyIcon} />
          <p className={styles.emptyText}>No integrations yet</p>
          <p className={styles.emptySubtext}>
            Connect to Slack or Teams to get notified when tickets are created, statuses change, and more.
          </p>
          <button className={styles.addBtnLg} onClick={openCreate}>
            <RiAddLine size={14} /> Add your first integration
          </button>
        </div>
      )}

      <div className={styles.list}>
        {integrations.map((item) => (
          <div key={item.id} className={`${styles.card} ${!item.is_active ? styles.cardInactive : ""}`}>
            <div className={styles.cardLeft}>
              <div className={styles.cardTitle}>
                <span className={styles.typeTag}>{TYPE_LABELS[item.type]}</span>
                {item.name}
              </div>
              <div className={styles.cardUrl}>{item.webhook_url.slice(0, 60)}{item.webhook_url.length > 60 ? "…" : ""}</div>
              <div className={styles.eventChips}>
                {item.events.map((ev) => (
                  <span key={ev} className={styles.eventChip}>
                    {ALL_EVENTS.find((e) => e.value === ev)?.label ?? ev}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.cardActions}>
              <button
                className={styles.testBtn}
                onClick={() => handleTest(item.id)}
                disabled={testingId === item.id}
                title="Send test message"
              >
                {testingId === item.id
                  ? <RiCheckLine size={14} />
                  : <RiSendPlaneLine size={14} />}
                {testingId === item.id ? "Sending…" : "Test"}
              </button>
              <button
                className={styles.iconBtn}
                onClick={() => toggleMut.mutate({ id: item.id, is_active: !item.is_active })}
                title={item.is_active ? "Disable" : "Enable"}
              >
                {item.is_active
                  ? <RiToggleFill size={20} color="var(--accent)" />
                  : <RiToggleLine size={20} />}
              </button>
              <button className={styles.iconBtn} onClick={() => openEdit(item)} title="Edit">
                <RiEditLine size={16} />
              </button>
              <button
                className={styles.iconBtnDanger}
                onClick={() => { if (confirm("Delete this integration?")) deleteMut.mutate(item.id); }}
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
        onClose={() => setShowDrawer(false)}
        size="md"
        title={editing ? "Edit Integration" : "New Integration"}
        subtitle="Configure webhook notifications for your team"
        footer={
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className={styles.footerSecondary} onClick={() => setShowDrawer(false)}>Cancel</button>
            <button
              className={styles.footerPrimary}
              onClick={save}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editing ? "Save Changes" : "Create Integration"}
            </button>
          </div>
        }
      >
        <div className={styles.form}>
          <label className={styles.label}>Name</label>
          <input
            className={styles.input}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Engineering Slack Channel"
          />

          <label className={styles.label}>Type</label>
          <div className={styles.typeRow}>
            {TYPE_OPTIONS.map((t) => (
              <button
                key={t.value}
                className={`${styles.typeBtn} ${form.type === t.value ? styles.typeBtnActive : ""}`}
                onClick={() => setForm((f) => ({ ...f, type: t.value }))}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <label className={styles.label}>Webhook URL</label>
          <input
            className={styles.input}
            value={form.webhook_url}
            onChange={(e) => setForm((f) => ({ ...f, webhook_url: e.target.value }))}
            placeholder={
              form.type === "slack"
                ? "https://hooks.slack.com/services/..."
                : form.type === "teams"
                ? "https://outlook.office.com/webhook/..."
                : "https://your-server.com/webhook"
            }
          />

          {form.type === "slack" && (
            <p className={styles.hint}>
              Create an Incoming Webhook in your Slack app settings, then paste the URL above.
            </p>
          )}
          {form.type === "teams" && (
            <p className={styles.hint}>
              Add an Incoming Webhook connector in your Teams channel settings.
            </p>
          )}

          <label className={styles.label}>Notify on</label>
          <div className={styles.eventList}>
            {ALL_EVENTS.map((ev) => (
              <label key={ev.value} className={styles.eventRow}>
                <input
                  type="checkbox"
                  checked={form.events.includes(ev.value)}
                  onChange={() => toggleEvent(ev.value)}
                  className={styles.checkbox}
                />
                <div>
                  <div className={styles.eventLabel}>{ev.label}</div>
                  <div className={styles.eventDesc}>{ev.description}</div>
                </div>
              </label>
            ))}
          </div>

          <label className={styles.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Active
            <button
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
              onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
            >
              {form.is_active
                ? <RiToggleFill size={24} color="var(--accent)" />
                : <RiToggleLine size={24} />}
            </button>
          </label>
        </div>
      </SideDrawer>
    </div>
  );
}
