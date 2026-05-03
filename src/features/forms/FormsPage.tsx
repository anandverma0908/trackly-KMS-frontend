import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiFileListLine,
  RiAddLine,
  RiDeleteBinLine,
  RiEyeLine,
  RiSendPlaneLine,
  RiCheckLine,
  RiArrowRightLine,
} from "react-icons/ri";
import toast from "react-hot-toast";
import styles from "./FormsPage.module.css";
import {
  fetchFormTemplates,
  createFormTemplate,
  fetchFormSubmissions,
  convertSubmission,
} from "@/services/api";
import FormSubmitModal from "./FormSubmitModal";
import SideDrawer from "@/components/ui/SideDrawer";
import type { FormTemplate, FormField, FormSubmission, FormFieldType } from "@/types";

const FIELD_TYPES: FormFieldType[] = ["text", "number", "select", "checkbox", "textarea"];

function emptyField(): FormField {
  return {
    name: `field_${Date.now()}`,
    type: "text",
    label: "",
    required: false,
    options: [],
  };
}

/* ── Convert drawer ── */
function ConvertDrawer({
  submission,
  onClose,
  onConverted,
}: {
  submission: FormSubmission;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    pod: "",
    client: "",
    issue_type: "Task",
    priority: "Medium",
    assignee: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const summary = Object.entries(submission.responses || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    setForm((f) => ({
      ...f,
      title: `Intake from ${submission.submitter_email}`,
      description: summary,
    }));
  }, [submission]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setLoading(true);
    try {
      await convertSubmission(submission.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        pod: form.pod.trim() || undefined,
        client: form.client.trim() || undefined,
        issue_type: form.issue_type,
        priority: form.priority,
        assignee: form.assignee.trim() || undefined,
      });
      toast.success("Converted to ticket");
      onConverted();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Conversion failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SideDrawer open onClose={onClose} title="Convert to Ticket">
      <form onSubmit={handleSubmit} className={styles.builderForm} style={{ padding: 4 }}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Title *</label>
          <input
            className={styles.formInput}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Description</label>
          <textarea
            className={styles.formTextarea}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Pod</label>
            <input
              className={styles.formInput}
              value={form.pod}
              onChange={(e) => setForm((f) => ({ ...f, pod: e.target.value }))}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Client</label>
            <input
              className={styles.formInput}
              value={form.client}
              onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
            />
          </div>
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Issue Type</label>
            <select
              className={styles.formSelect}
              value={form.issue_type}
              onChange={(e) => setForm((f) => ({ ...f, issue_type: e.target.value }))}
            >
              <option>Task</option>
              <option>Story</option>
              <option>Bug</option>
              <option>Epic</option>
              <option>Improvement</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Priority</label>
            <select
              className={styles.formSelect}
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            >
              <option>Highest</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
              <option>Lowest</option>
            </select>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Assignee</label>
          <input
            className={styles.formInput}
            value={form.assignee}
            onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}
          />
        </div>
        <button type="submit" className={styles.saveBtn} disabled={loading}>
          <RiCheckLine size={15} />
          {loading ? "Converting…" : "Convert to Ticket"}
        </button>
      </form>
    </SideDrawer>
  );
}

/* ── Main page ── */
type TabKey = "builder" | "submissions";

export default function FormsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("builder");
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<FormTemplate | null>(null);
  const [convertSubmissionItem, setConvertSubmissionItem] = useState<FormSubmission | null>(null);

  const [builder, setBuilder] = useState<{
    name: string;
    description: string;
    fields: FormField[];
  }>({ name: "", description: "", fields: [emptyField()] });

  const [saving, setSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await fetchFormTemplates();
      setTemplates(data);
    } catch {
      toast.error("Failed to load templates");
    }
  }, []);

  const loadSubmissions = useCallback(async (templateId: string) => {
    try {
      const data = await fetchFormSubmissions(templateId);
      setSubmissions(data);
    } catch {
      toast.error("Failed to load submissions");
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (activeTab === "submissions" && selectedTemplate) {
      loadSubmissions(selectedTemplate.id);
    }
  }, [activeTab, selectedTemplate, loadSubmissions]);

  function setBuilderField(k: "name" | "description", v: string) {
    setBuilder((b) => ({ ...b, [k]: v }));
  }

  function setField(index: number, k: keyof FormField, v: any) {
    setBuilder((b) => {
      const fields = [...b.fields];
      fields[index] = { ...fields[index], [k]: v };
      return { ...b, fields };
    });
  }

  function addField() {
    setBuilder((b) => ({ ...b, fields: [...b.fields, emptyField()] }));
  }

  function removeField(index: number) {
    setBuilder((b) => ({
      ...b,
      fields: b.fields.filter((_, i) => i !== index),
    }));
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!builder.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (builder.fields.some((f) => !f.label.trim())) {
      toast.error("All fields need a label");
      return;
    }
    setSaving(true);
    try {
      await createFormTemplate({
        name: builder.name.trim(),
        description: builder.description.trim() || undefined,
        fields: builder.fields.map((f) => ({
          ...f,
          name: f.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
          options: f.type === "select" ? (f.options ?? []).filter(Boolean) : undefined,
        })),
        is_active: true,
      });
      toast.success("Template created");
      setBuilder({ name: "", description: "", fields: [emptyField()] });
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to create template");
    } finally {
      setSaving(false);
    }
  }

  const statusClass: Record<string, string> = {
    new: styles.statusNew,
    reviewed: styles.statusReviewed,
    converted: styles.statusConverted,
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <RiFileListLine size={22} className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>Forms / Intake</h1>
            <p className={styles.subtitle}>Build forms and manage submissions</p>
          </div>
        </div>
      </div>

      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === "builder" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("builder")}
        >
          Form Builder
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "submissions" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("submissions")}
        >
          Submissions
        </button>
      </div>

      <div className={styles.content}>
        <AnimatePresence mode="wait">
          {activeTab === "builder" ? (
            <motion.div
              key="builder"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              style={{ display: "flex", flexDirection: "column", gap: 20 }}
            >
              {/* Existing templates */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 10px" }}>
                  Your Templates
                </h3>
                {templates.length === 0 ? (
                  <div className={styles.emptyState}>No templates yet. Create your first one below.</div>
                ) : (
                  <div className={styles.templateList}>
                    {templates.map((t) => (
                      <div key={t.id} className={styles.templateCard}>
                        <div>
                          <div className={styles.templateName}>{t.name}</div>
                          <div className={styles.templateMeta}>
                            {t.fields.length} field{t.fields.length !== 1 ? "s" : ""}
                            {t.description ? ` · ${t.description}` : ""}
                          </div>
                        </div>
                        <div className={styles.templateActions}>
                          <button
                            className={styles.actionBtn}
                            title="Preview / Submit"
                            onClick={() => setPreviewTemplate(t)}
                          >
                            <RiEyeLine size={16} />
                          </button>
                          <button
                            className={styles.actionBtn}
                            title="View Submissions"
                            onClick={() => {
                              setSelectedTemplate(t);
                              setActiveTab("submissions");
                            }}
                          >
                            <RiSendPlaneLine size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Create form */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 10px" }}>
                  Create New Template
                </h3>
                <form onSubmit={handleSaveTemplate} className={styles.builderForm}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Name *</label>
                    <input
                      className={styles.formInput}
                      placeholder="e.g. Bug Report Intake"
                      value={builder.name}
                      onChange={(e) => setBuilderField("name", e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Description</label>
                    <input
                      className={styles.formInput}
                      placeholder="Short description"
                      value={builder.description}
                      onChange={(e) => setBuilderField("description", e.target.value)}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {builder.fields.map((field, i) => (
                      <div key={i} className={styles.fieldCard}>
                        <div className={styles.fieldHeader}>
                          <span className={styles.fieldTitle}>Field {i + 1}</span>
                          <button
                            type="button"
                            className={styles.removeBtn}
                            onClick={() => removeField(i)}
                            title="Remove field"
                          >
                            <RiDeleteBinLine size={15} />
                          </button>
                        </div>
                        <div className={styles.fieldRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Label *</label>
                            <input
                              className={styles.formInput}
                              placeholder="Field label"
                              value={field.label}
                              onChange={(e) => setField(i, "label", e.target.value)}
                              required
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Type</label>
                            <select
                              className={styles.formSelect}
                              value={field.type}
                              onChange={(e) => setField(i, "type", e.target.value)}
                            >
                              {FIELD_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {field.type === "select" && (
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Options (comma-separated)</label>
                            <input
                              className={styles.formInput}
                              placeholder="Option 1, Option 2, Option 3"
                              value={(field.options ?? []).join(", ")}
                              onChange={(e) =>
                                setField(
                                  i,
                                  "options",
                                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                                )
                              }
                            />
                          </div>
                        )}
                        <label className={styles.checkboxWrap}>
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => setField(i, "required", e.target.checked)}
                          />
                          <span>Required</span>
                        </label>
                      </div>
                    ))}
                  </div>
                  <button type="button" className={styles.addFieldBtn} onClick={addField}>
                    <RiAddLine size={15} />
                    Add Field
                  </button>
                  <button type="submit" className={styles.saveBtn} disabled={saving}>
                    <RiCheckLine size={15} />
                    {saving ? "Saving…" : "Save Template"}
                  </button>
                </form>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="submissions"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                  Template:
                </span>
                {templates.map((t) => (
                  <button
                    key={t.id}
                    className={`${styles.tabBtn} ${selectedTemplate?.id === t.id ? styles.tabBtnActive : ""}`}
                    onClick={() => {
                      setSelectedTemplate(t);
                      loadSubmissions(t.id);
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>

              {selectedTemplate ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                      Public link: /forms/{selectedTemplate.id}
                    </span>
                    <button
                      className={styles.linkBtn}
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/forms/${selectedTemplate.id}`);
                        toast.success("Link copied");
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  {submissions.length === 0 ? (
                    <div className={styles.emptyState}>No submissions yet.</div>
                  ) : (
                    <div className={styles.submissionList}>
                      {submissions.map((s) => (
                        <div key={s.id} className={styles.submissionCard}>
                          <div className={styles.submissionHeader}>
                            <span className={styles.submissionEmail}>{s.submitter_email}</span>
                            <span className={`${styles.statusBadge} ${statusClass[s.status] ?? styles.statusNew}`}>
                              {s.status}
                            </span>
                          </div>
                          <div className={styles.submissionBody}>
                            <pre>{JSON.stringify(s.responses, null, 2)}</pre>
                          </div>
                          {s.status !== "converted" && (
                            <button
                              className={styles.convertBtn}
                              onClick={() => setConvertSubmissionItem(s)}
                            >
                              <RiArrowRightLine size={14} />
                              Convert to Ticket
                            </button>
                          )}
                          {s.ticket_id && (
                            <div style={{ fontSize: 12, color: "var(--green)" }}>
                              Ticket: {s.ticket_id}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.emptyState}>Select a template to view submissions.</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Preview / Submit modal */}
      <AnimatePresence>
        {previewTemplate && (
          <FormSubmitModal
            template={previewTemplate}
            onClose={() => setPreviewTemplate(null)}
          />
        )}
      </AnimatePresence>

      {/* Convert drawer */}
      <AnimatePresence>
        {convertSubmissionItem && (
          <ConvertDrawer
            submission={convertSubmissionItem}
            onClose={() => setConvertSubmissionItem(null)}
            onConverted={() => {
              if (selectedTemplate) loadSubmissions(selectedTemplate.id);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
