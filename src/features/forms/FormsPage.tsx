import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiFileListLine,
  RiAddLine,
  RiDeleteBinLine,
  RiEyeLine,
  RiSendPlaneLine,
  RiCheckLine,
  RiArrowRightLine,
  RiClipboardLine,
  RiLinksLine,
  RiBarChartLine,
  RiTimeLine,
  RiCheckboxCircleLine,
  RiDraftLine,
  RiSearchLine,
  RiExternalLinkLine,
  RiCalendarLine,
  RiArrowRightSLine,
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

/* ── Template detail drawer ── */
function TemplateDetailDrawer({
  template,
  submissions,
  onClose,
  onPreview,
  onViewSubmissions,
}: {
  template: FormTemplate;
  submissions: FormSubmission[];
  onClose: () => void;
  onPreview: () => void;
  onViewSubmissions: () => void;
}) {
  const converted = submissions.filter((s) => s.status === "converted").length;

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/forms/${template.id}`);
    toast.success("Link copied");
  }

  return (
    <SideDrawer open onClose={onClose} title={template.name} subtitle={template.description ?? undefined}>
      <div className={styles.tplDrawerBody}>
        {/* Stats row */}
        <div className={styles.tplDrawerStats}>
          <div className={styles.tplDrawerStat}>
            <span className={styles.tplDrawerStatNum}>{template.fields.length}</span>
            <span className={styles.tplDrawerStatLabel}>Fields</span>
          </div>
          <div className={styles.tplDrawerStat}>
            <span className={styles.tplDrawerStatNum}>{submissions.length}</span>
            <span className={styles.tplDrawerStatLabel}>Submissions</span>
          </div>
          <div className={styles.tplDrawerStat}>
            <span className={styles.tplDrawerStatNum}>{converted}</span>
            <span className={styles.tplDrawerStatLabel}>Converted</span>
          </div>
        </div>

        {/* Fields */}
        <div className={styles.tplDrawerSection}>
          <div className={styles.tplDrawerSectionTitle}>Form Fields</div>
          <div className={styles.tplFieldList}>
            {template.fields.map((f, i) => (
              <div key={i} className={styles.tplFieldRow}>
                <div className={styles.tplFieldLeft}>
                  <span className={styles.tplFieldNum}>{i + 1}</span>
                  <div>
                    <div className={styles.tplFieldLabel}>{f.label}</div>
                    {f.options && f.options.length > 0 && (
                      <div className={styles.tplFieldOptions}>
                        {f.options.join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.tplFieldRight}>
                  <span className={styles.tplFieldType}>{f.type}</span>
                  {f.required && <span className={styles.tplFieldRequired}>required</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Share link */}
        <div className={styles.tplDrawerSection}>
          <div className={styles.tplDrawerSectionTitle}>Public Link</div>
          <div className={styles.tplShareRow}>
            <span className={styles.tplShareUrl}>/forms/{template.id.slice(0, 16)}…</span>
            <button className={styles.tplShareCopy} onClick={copyLink}>
              <RiLinksLine size={13} /> Copy
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.tplDrawerActions}>
          <button className={styles.tplDrawerBtn} onClick={onPreview}>
            <RiEyeLine size={14} /> Preview Form
          </button>
          <button className={`${styles.tplDrawerBtn} ${styles.tplDrawerBtnAccent}`} onClick={onViewSubmissions}>
            <RiSendPlaneLine size={14} /> View Submissions
            {submissions.length > 0 && <span className={styles.tplDrawerBtnBadge}>{submissions.length}</span>}
          </button>
        </div>
      </div>
    </SideDrawer>
  );
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
    if (!form.title.trim()) { toast.error("Title is required"); return; }
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
          <input className={styles.formInput} value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Description</label>
          <textarea className={styles.formTextarea} value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Pod</label>
            <input className={styles.formInput} value={form.pod}
              onChange={(e) => setForm((f) => ({ ...f, pod: e.target.value }))} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Client</label>
            <input className={styles.formInput} value={form.client}
              onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))} />
          </div>
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Issue Type</label>
            <select className={styles.formSelect} value={form.issue_type}
              onChange={(e) => setForm((f) => ({ ...f, issue_type: e.target.value }))}>
              <option>Task</option><option>Story</option><option>Bug</option>
              <option>Epic</option><option>Improvement</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Priority</label>
            <select className={styles.formSelect} value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
              <option>Highest</option><option>High</option><option>Medium</option>
              <option>Low</option><option>Lowest</option>
            </select>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Assignee</label>
          <input className={styles.formInput} value={form.assignee}
            onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))} />
        </div>
        <button type="submit" className={styles.saveBtn} disabled={loading}>
          <RiCheckLine size={15} />
          {loading ? "Converting…" : "Convert to Ticket"}
        </button>
      </form>
    </SideDrawer>
  );
}

/* ── Submission card (vertical layout) ── */
function SubmissionCard({
  submission,
  statusClass,
  onConvert,
}: {
  submission: FormSubmission;
  statusClass: Record<string, string>;
  onConvert: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const responses = submission.responses ?? {};
  const previewEntries = Object.entries(responses).slice(0, 2);

  const dateStr = submission.created_at
    ? new Date(submission.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <div className={styles.subCard}>
      {/* Top row: avatar + email + date */}
      <div className={styles.subCardTop}>
        <div className={styles.subCardLeft}>
          <div className={styles.subAvatar}>
            {(submission.submitter_email?.[0] ?? "?").toUpperCase()}
          </div>
          <div className={styles.subCardMeta}>
            <div className={styles.subEmail}>{submission.submitter_email}</div>
            {dateStr && (
              <div className={styles.subDate}>
                <RiCalendarLine size={10} /> {dateStr}
              </div>
            )}
          </div>
        </div>
        <div className={styles.subCardBadges}>
          <span className={`${styles.statusBadge} ${statusClass[submission.status] ?? styles.statusNew}`}>
            {submission.status}
          </span>
          {submission.ticket_id && (
            <span className={styles.ticketRef}>{submission.ticket_id}</span>
          )}
        </div>
      </div>

      {/* Preview row */}
      {previewEntries.length > 0 && (
        <div className={styles.subCardPreview}>
          {previewEntries.map(([k, v]) => (
            <div key={k} className={styles.subPreviewItem}>
              <span className={styles.subPreviewKey}>{k}</span>
              <span className={styles.subPreviewVal}>{String(v).slice(0, 80)}{String(v).length > 80 ? "…" : ""}</span>
            </div>
          ))}
          {Object.keys(responses).length > 2 && (
            <button
              className={styles.subExpandBtn}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Show less" : `+${Object.keys(responses).length - 2} more fields`}
            </button>
          )}
        </div>
      )}

      {/* Expanded responses */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className={styles.subExpandedBody}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            {Object.entries(responses).slice(2).map(([k, v]) => (
              <div key={k} className={styles.subPreviewItem}>
                <span className={styles.subPreviewKey}>{k}</span>
                <span className={styles.subPreviewVal}>{String(v)}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom action row */}
      {submission.status !== "converted" && (
        <div className={styles.subCardFooter}>
          <button className={styles.convertBtn} onClick={onConvert}>
            <RiArrowRightLine size={13} /> Convert to Ticket
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main page ── */
type TabKey = "builder" | "submissions";

export default function FormsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("builder");
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Record<string, FormSubmission[]>>({});
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [detailTemplate, setDetailTemplate] = useState<FormTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<FormTemplate | null>(null);
  const [convertSubmissionItem, setConvertSubmissionItem] = useState<FormSubmission | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [submissionSearch, setSubmissionSearch] = useState("");

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
      if (data.length > 0 && !selectedTemplate) setSelectedTemplate(data[0]);
    } catch {
      toast.error("Failed to load templates");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSubmissions = useCallback(async (templateId: string) => {
    try {
      const data = await fetchFormSubmissions(templateId);
      setSubmissions(data);
      setAllSubmissions((prev) => ({ ...prev, [templateId]: data }));
    } catch {
      toast.error("Failed to load submissions");
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  useEffect(() => {
    if (selectedTemplate) loadSubmissions(selectedTemplate.id);
  }, [selectedTemplate, loadSubmissions]);

  // Preload submissions for all templates (for KPI totals)
  useEffect(() => {
    templates.forEach((t) => {
      if (!allSubmissions[t.id]) loadSubmissions(t.id);
    });
  }, [templates]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSubmissions = useMemo(
    () => Object.values(allSubmissions).flat().length,
    [allSubmissions]
  );
  const convertedCount = useMemo(
    () => Object.values(allSubmissions).flat().filter((s) => s.status === "converted").length,
    [allSubmissions]
  );

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
    setBuilder((b) => ({ ...b, fields: b.fields.filter((_, i) => i !== index) }));
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!builder.name.trim()) { toast.error("Name is required"); return; }
    if (builder.fields.some((f) => !f.label.trim())) { toast.error("All fields need a label"); return; }
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
      setShowBuilder(false);
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

  const filteredSubmissions = submissions.filter((s) => {
    if (!submissionSearch) return true;
    const q = submissionSearch.toLowerCase();
    return (
      s.submitter_email?.toLowerCase().includes(q) ||
      Object.values(s.responses ?? {}).some((v) => String(v).toLowerCase().includes(q))
    );
  });

  const kpis = [
    { label: "Total Forms", value: templates.length, sub: "Templates created", icon: <RiFileListLine size={18} /> },
    { label: "Active", value: templates.filter((t) => t.is_active !== false).length, sub: "Live forms", icon: <RiCheckboxCircleLine size={18} /> },
    { label: "Submissions", value: totalSubmissions, sub: "Across all forms", icon: <RiClipboardLine size={18} /> },
    { label: "Converted", value: convertedCount, sub: "Turned into tickets", icon: <RiCheckLine size={18} /> },
  ];

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <RiFileListLine size={20} className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>Forms / Intake</h1>
            <p className={styles.subtitle}>Build forms · Collect submissions · Convert to tickets</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.addBtn} onClick={() => setShowBuilder(true)}>
            <RiAddLine size={15} /> New Form
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className={styles.summaryStrip}>
        {kpis.map((k) => (
          <div key={k.label} className={styles.kpiBox}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiLabel}>{k.label}</span>
              <span className={styles.kpiIconWrap}>{k.icon}</span>
            </div>
            <div className={styles.kpiNum}>{k.value}</div>
            <div className={styles.kpiSub}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === "builder" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("builder")}
        >
          <RiDraftLine size={13} /> Templates
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "submissions" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("submissions")}
        >
          <RiClipboardLine size={13} /> Submissions
          {totalSubmissions > 0 && (
            <span className={styles.tabCount}>{totalSubmissions}</span>
          )}
        </button>
      </div>

      <div className={styles.content}>
        <AnimatePresence mode="wait">
          {/* ── Templates tab ── */}
          {activeTab === "builder" ? (
            <motion.div
              key="builder"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className={styles.templateList}
            >
              {templates.length === 0 ? (
                <div className={styles.emptyState}>
                  <RiFileListLine size={32} style={{ opacity: 0.2 }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>No forms yet</p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-3)" }}>Create your first form template to start collecting submissions</p>
                  <button className={styles.addBtn} onClick={() => setShowBuilder(true)}>
                    <RiAddLine size={14} /> Create First Form
                  </button>
                </div>
              ) : (
                templates.map((t, i) => {
                  const submCount = (allSubmissions[t.id] ?? []).length;
                  const convertedInT = (allSubmissions[t.id] ?? []).filter((s) => s.status === "converted").length;
                  return (
                    <motion.div
                      key={t.id}
                      className={styles.templateRow}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setDetailTemplate(t)}
                    >
                      <div className={styles.tRowIcon}>
                        <RiFileListLine size={16} />
                      </div>
                      <div className={styles.tRowBody}>
                        <div className={styles.tRowName}>{t.name}</div>
                        {t.description && <div className={styles.tRowDesc}>{t.description}</div>}
                        <div className={styles.tRowMeta}>
                          <span><RiBarChartLine size={11} /> {t.fields.length} field{t.fields.length !== 1 ? "s" : ""}</span>
                          <span><RiClipboardLine size={11} /> {submCount} submission{submCount !== 1 ? "s" : ""}</span>
                          {convertedInT > 0 && (
                            <span style={{ color: "var(--green)" }}><RiCheckLine size={11} /> {convertedInT} converted</span>
                          )}
                        </div>
                      </div>
                      <div className={styles.tRowRight}>
                        <span className={`${styles.tRowStatus} ${t.is_active !== false ? styles.tRowActive : styles.tRowInactive}`}>
                          {t.is_active !== false ? "Active" : "Inactive"}
                        </span>
                        <RiArrowRightSLine size={18} className={styles.tRowChevron} />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          ) : (
            /* ── Submissions tab ── */
            <motion.div
              key="submissions"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              {/* Template selector */}
              <div className={styles.subHeader}>
                <div className={styles.templateTabs}>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      className={`${styles.templateTab} ${selectedTemplate?.id === t.id ? styles.templateTabActive : ""}`}
                      onClick={() => setSelectedTemplate(t)}
                    >
                      {t.name}
                      <span className={styles.templateTabCount}>
                        {(allSubmissions[t.id] ?? []).length}
                      </span>
                    </button>
                  ))}
                </div>
                {selectedTemplate && (
                  <div className={styles.subHeaderRight}>
                    <span className={styles.publicLink}>
                      /forms/{selectedTemplate.id.slice(0, 8)}…
                    </span>
                    <button
                      className={styles.copyLinkBtn}
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/forms/${selectedTemplate.id}`);
                        toast.success("Link copied");
                      }}
                    >
                      <RiExternalLinkLine size={12} /> Copy Link
                    </button>
                  </div>
                )}
              </div>

              {selectedTemplate ? (
                <>
                  {/* Search + stats row */}
                  <div className={styles.subFilterRow}>
                    <div className={styles.subSearch}>
                      <RiSearchLine size={13} style={{ opacity: 0.5 }} />
                      <input
                        className={styles.subSearchInput}
                        placeholder="Search submissions…"
                        value={submissionSearch}
                        onChange={(e) => setSubmissionSearch(e.target.value)}
                      />
                    </div>
                    <div className={styles.subStats}>
                      <span className={styles.subStat}>
                        <RiClipboardLine size={12} /> {submissions.length} total
                      </span>
                      <span className={`${styles.subStat} ${styles.subStatNew}`}>
                        <RiTimeLine size={12} /> {submissions.filter((s) => s.status === "new").length} new
                      </span>
                      <span className={`${styles.subStat} ${styles.subStatConverted}`}>
                        <RiCheckLine size={12} /> {submissions.filter((s) => s.status === "converted").length} converted
                      </span>
                    </div>
                  </div>

                  {filteredSubmissions.length === 0 ? (
                    <div className={styles.emptyState}>
                      <RiClipboardLine size={28} style={{ opacity: 0.2 }} />
                      <p style={{ margin: 0, fontSize: 14, color: "var(--text-2)" }}>
                        {submissionSearch ? "No submissions match your search" : "No submissions yet"}
                      </p>
                      {!submissionSearch && (
                        <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)" }}>
                          Share the form link to start collecting responses
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className={styles.submissionList}>
                      {filteredSubmissions.map((s) => (
                        <SubmissionCard
                          key={s.id}
                          submission={s}
                          statusClass={statusClass}
                          onConvert={() => setConvertSubmissionItem(s)}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.emptyState}>
                  <RiFileListLine size={28} style={{ opacity: 0.2 }} />
                  <p style={{ margin: 0, fontSize: 14, color: "var(--text-2)" }}>Select a form template</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Form Drawer */}
      <SideDrawer
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        size="md"
        title="New Form Template"
        subtitle="Build a form to collect structured submissions"
      >
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
              placeholder="Short description of the form's purpose"
              value={builder.description}
              onChange={(e) => setBuilderField("description", e.target.value)}
            />
          </div>

          <div className={styles.fieldsHeader}>
            <span className={styles.formLabel}>Fields</span>
            <button type="button" className={styles.addFieldBtn} onClick={addField}>
              <RiAddLine size={12} /> Add Field
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {builder.fields.map((field, i) => (
              <div key={i} className={styles.fieldCard}>
                <div className={styles.fieldHeader}>
                  <span className={styles.fieldTitle}>Field {i + 1}</span>
                  <button type="button" className={styles.removeBtn} onClick={() => removeField(i)} title="Remove">
                    <RiDeleteBinLine size={14} />
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
                  <div className={styles.formGroup} style={{ maxWidth: 140 }}>
                    <label className={styles.formLabel}>Type</label>
                    <select
                      className={styles.formSelect}
                      value={field.type}
                      onChange={(e) => setField(i, "type", e.target.value)}
                    >
                      {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
                        setField(i, "options", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                      }
                    />
                  </div>
                )}
                <label className={styles.checkboxWrap}>
                  <input type="checkbox" checked={field.required}
                    onChange={(e) => setField(i, "required", e.target.checked)} />
                  <span>Required</span>
                </label>
              </div>
            ))}
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setShowBuilder(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              <RiCheckLine size={14} />
              {saving ? "Saving…" : "Save Template"}
            </button>
          </div>
        </form>
      </SideDrawer>

      {/* Template detail drawer */}
      <AnimatePresence>
        {detailTemplate && (
          <TemplateDetailDrawer
            template={detailTemplate}
            submissions={allSubmissions[detailTemplate.id] ?? []}
            onClose={() => setDetailTemplate(null)}
            onPreview={() => {
              setPreviewTemplate(detailTemplate);
              setDetailTemplate(null);
            }}
            onViewSubmissions={() => {
              setSelectedTemplate(detailTemplate);
              setDetailTemplate(null);
              setActiveTab("submissions");
            }}
          />
        )}
      </AnimatePresence>

      {/* Preview modal */}
      <AnimatePresence>
        {previewTemplate && (
          <FormSubmitModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
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
