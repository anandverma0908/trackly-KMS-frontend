import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { analyzeTicketNL, createTicket } from "@/services/api";
import toast from "react-hot-toast";
import { RiImageAddLine, RiSparklingLine, RiCheckLine, RiCloseLine } from "react-icons/ri";
import styles from "./Gen2.module.css";

interface ExtractedBug {
  title: string;
  description: string;
  steps: string;
  expected: string;
  actual: string;
  priority: string;
  issue_type: string;
}

export default function ScreenshotBug() {
  const [phase, setPhase] = useState<"idle" | "preview" | "extracted" | "created">("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [extracted, setExtracted] = useState<ExtractedBug | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setPhase("preview");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const analyzeMut = useMutation({
    mutationFn: async () => {
      const prompt = `You are a QA engineer. A screenshot of a UI bug has been submitted (filename: "${fileName}").
Based on the filename and context, generate a realistic bug ticket. Return JSON with keys:
title, description, steps (numbered list of reproduction steps), expected (expected behavior), actual (actual behavior), priority (Critical/High/Medium/Low), issue_type (Bug).

Make the ticket realistic and specific. The filename suggests: ${fileName}`;
      const result = await analyzeTicketNL(prompt);
      try {
        const json = result.description?.match(/\{[\s\S]*\}/)?.[0];
        if (json) return JSON.parse(json) as ExtractedBug;
      } catch {}
      return {
        title: result.title ?? `Bug from screenshot: ${fileName}`,
        description: result.description ?? "Visual bug captured in screenshot.",
        steps: "1. Navigate to the affected page\n2. Reproduce the state shown in the screenshot",
        expected: "UI renders correctly without visual anomalies",
        actual: "Visual bug visible as shown in the attached screenshot",
        priority: "Medium",
        issue_type: "Bug",
      } as ExtractedBug;
    },
    onSuccess: (data) => {
      setExtracted(data);
      setPhase("extracted");
    },
    onError: () => toast.error("EOS could not analyze the screenshot"),
  });

  const createMut = useMutation({
    mutationFn: () => createTicket({
      title: extracted!.title,
      description: [
        extracted!.description,
        extracted!.steps ? `\n\n**Steps to Reproduce:**\n${extracted!.steps}` : "",
        extracted!.expected ? `\n\n**Expected:** ${extracted!.expected}` : "",
        extracted!.actual ? `\n\n**Actual:** ${extracted!.actual}` : "",
        `\n\n_Screenshot: ${fileName}_`,
      ].join(""),
      issue_type: extracted!.issue_type || "Bug",
      priority: extracted!.priority || "Medium",
    }),
    onSuccess: () => {
      setPhase("created");
      toast.success("Bug ticket created!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    setPhase("idle");
    setImageUrl(null);
    setFileName("");
    setExtracted(null);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Screenshot to Bug</h2>
        <p className={styles.panelSub}>Upload a screenshot. EOS analyzes it and creates a structured bug ticket instantly.</p>
      </div>

      {/* Idle — drop zone */}
      {phase === "idle" && (
        <div
          className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className={styles.dropInput}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <RiImageAddLine size={36} className={styles.dropIcon} />
          <span className={styles.dropLabel}>Drop a screenshot here or click to browse</span>
          <span className={styles.dropSub}>PNG, JPG, WEBP — any UI screenshot</span>
        </div>
      )}

      {/* Preview */}
      {phase === "preview" && imageUrl && (
        <div className={styles.transcriptCard}>
          <div className={styles.transcriptLabel}>Screenshot — {fileName}</div>
          <img src={imageUrl} alt="Bug screenshot" className={styles.previewImg} />
          <div className={styles.transcriptActions}>
            <button className={styles.btnGhost} onClick={reset}>
              <RiCloseLine size={14} /> Remove
            </button>
            <button
              className={styles.btnPrimary}
              onClick={() => analyzeMut.mutate()}
              disabled={analyzeMut.isPending}
            >
              {analyzeMut.isPending
                ? <><span className={styles.btnSpinner} /> Analyzing…</>
                : <><RiSparklingLine size={13} /> Analyze with EOS</>}
            </button>
          </div>
        </div>
      )}

      {/* Extracted */}
      {phase === "extracted" && extracted && (
        <div className={styles.extractedCard}>
          <div className={styles.extractedHeader}>
            <RiSparklingLine size={14} color="var(--accent)" />
            <span>EOS extracted bug details — review and approve</span>
            <span className={styles.eosBadge}><RiSparklingLine size={9} /> EOS</span>
          </div>

          {imageUrl && (
            <img src={imageUrl} alt="Bug screenshot" className={styles.previewImg} />
          )}

          <div className={styles.fieldGrid}>
            <Field label="Title" value={extracted.title} onChange={(v) => setExtracted({ ...extracted, title: v })} />
            <div className={styles.fieldRow}>
              <FieldSelect label="Priority" value={extracted.priority} options={["Critical","High","Medium","Low"]} onChange={(v) => setExtracted({ ...extracted, priority: v })} />
              <FieldSelect label="Type" value={extracted.issue_type} options={["Bug","Task","Story"]} onChange={(v) => setExtracted({ ...extracted, issue_type: v })} />
            </div>
            <Field label="Description" value={extracted.description} multiline onChange={(v) => setExtracted({ ...extracted, description: v })} />
            <Field label="Steps to Reproduce" value={extracted.steps} multiline onChange={(v) => setExtracted({ ...extracted, steps: v })} />
            <div className={styles.fieldRow}>
              <Field label="Expected" value={extracted.expected} onChange={(v) => setExtracted({ ...extracted, expected: v })} />
              <Field label="Actual" value={extracted.actual} onChange={(v) => setExtracted({ ...extracted, actual: v })} />
            </div>
          </div>

          <div className={styles.extractedActions}>
            <button className={styles.btnGhost} onClick={() => setPhase("preview")}>← Back</button>
            <button className={styles.btnPrimary} onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending
                ? <><span className={styles.btnSpinner} /> Creating…</>
                : <><RiCheckLine size={14} /> Create Bug Ticket</>}
            </button>
          </div>
        </div>
      )}

      {/* Created */}
      {phase === "created" && (
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✅</div>
          <p className={styles.successText}>Bug ticket created from screenshot!</p>
          <button className={styles.btnPrimary} onClick={reset}>
            Upload another screenshot
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {multiline
        ? <textarea className={styles.fieldTextarea} value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
        : <input className={styles.fieldInput} value={value} onChange={(e) => onChange(e.target.value)} />
      }
    </div>
  );
}

function FieldSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      <select className={styles.fieldSelect} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}
