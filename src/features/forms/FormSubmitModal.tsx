import { useState } from "react";
import { RiSendPlaneLine, RiCheckLine } from "react-icons/ri";
import toast from "react-hot-toast";
import styles from "./FormSubmitModal.module.css";
import SideDrawer from "@/components/ui/SideDrawer";
import { submitFormResponse } from "@/services/api";
import type { FormTemplate, FormField } from "@/types";

export default function FormSubmitModal({
  template,
  onClose,
  onSubmitted,
}: {
  template: FormTemplate;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function setResponse(name: string, value: any) {
    setResponses((r) => ({ ...r, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    for (const f of template.fields) {
      if (f.required && (responses[f.name] === undefined || responses[f.name] === "")) {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    setSubmitting(true);
    try {
      await submitFormResponse(template.id, {
        submitter_email: email.trim(),
        responses,
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  function renderField(field: FormField) {
    const val = responses[field.name];
    switch (field.type) {
      case "textarea":
        return (
          <textarea
            className={styles.input}
            placeholder={`Enter ${field.label.toLowerCase()}…`}
            value={val ?? ""}
            rows={4}
            onChange={(e) => setResponse(field.name, e.target.value)}
            required={field.required}
          />
        );
      case "number":
        return (
          <input
            type="number"
            className={styles.input}
            placeholder="0"
            value={val ?? ""}
            onChange={(e) => setResponse(field.name, e.target.valueAsNumber || e.target.value)}
            required={field.required}
          />
        );
      case "select":
        return (
          <select
            className={styles.select}
            value={val ?? ""}
            onChange={(e) => setResponse(field.name, e.target.value)}
            required={field.required}
          >
            <option value="">Select an option…</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case "checkbox":
        return (
          <label className={styles.checkboxWrap}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={!!val}
              onChange={(e) => setResponse(field.name, e.target.checked)}
            />
            <span className={styles.checkboxLabel}>{field.label}</span>
          </label>
        );
      default:
        return (
          <input
            type="text"
            className={styles.input}
            placeholder={`Enter ${field.label.toLowerCase()}…`}
            value={val ?? ""}
            onChange={(e) => setResponse(field.name, e.target.value)}
            required={field.required}
          />
        );
    }
  }

  return (
    <SideDrawer
      open
      onClose={onClose}
      title={template.name}
      subtitle={template.description ?? undefined}
    >
      {submitted ? (
        <div className={styles.successState}>
          <div className={styles.successIcon}>
            <RiCheckLine size={28} />
          </div>
          <div className={styles.successTitle}>Submitted!</div>
          <div className={styles.successSub}>
            Your response has been recorded. Thank you.
          </div>
          <button className={styles.doneBtn} onClick={onClose}>Done</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Email field always first */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Your Email <span className={styles.required}>*</span>
            </label>
            <input
              type="email"
              className={styles.input}
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Template fields */}
          {template.fields.map((field) => (
            <div key={field.name} className={styles.fieldGroup}>
              <label className={styles.label}>
                {field.label}
                {field.required && <span className={styles.required}> *</span>}
              </label>
              {renderField(field)}
            </div>
          ))}

          <div className={styles.footer}>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              <RiSendPlaneLine size={15} />
              {submitting ? "Submitting…" : "Submit Response"}
            </button>
          </div>
        </form>
      )}
    </SideDrawer>
  );
}
