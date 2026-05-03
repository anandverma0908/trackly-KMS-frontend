import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RiCloseLine, RiSendPlaneLine } from "react-icons/ri";
import toast from "react-hot-toast";
import styles from "./FormsPage.module.css";
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
      toast.success("Submitted successfully!");
      onSubmitted?.();
      onClose();
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
            className={styles.formTextarea}
            placeholder={field.label}
            value={val ?? ""}
            onChange={(e) => setResponse(field.name, e.target.value)}
            required={field.required}
          />
        );
      case "number":
        return (
          <input
            type="number"
            className={styles.formInput}
            placeholder={field.label}
            value={val ?? ""}
            onChange={(e) => setResponse(field.name, e.target.valueAsNumber || e.target.value)}
            required={field.required}
          />
        );
      case "select":
        return (
          <select
            className={styles.formSelect}
            value={val ?? ""}
            onChange={(e) => setResponse(field.name, e.target.value)}
            required={field.required}
          >
            <option value="">Select…</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      case "checkbox":
        return (
          <label className={styles.checkboxWrap}>
            <input
              type="checkbox"
              checked={!!val}
              onChange={(e) => setResponse(field.name, e.target.checked)}
            />
            <span>{field.label}</span>
          </label>
        );
      default:
        return (
          <input
            type="text"
            className={styles.formInput}
            placeholder={field.label}
            value={val ?? ""}
            onChange={(e) => setResponse(field.name, e.target.value)}
            required={field.required}
          />
        );
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className={styles.modalOverlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>{template.name}</h3>
            <button className={styles.closeBtn} onClick={onClose}>
              <RiCloseLine size={20} />
            </button>
          </div>
          {template.description && (
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>
              {template.description}
            </p>
          )}
          <form onSubmit={handleSubmit} className={styles.modalBody}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Your email *</label>
              <input
                type="email"
                className={styles.formInput}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {template.fields.map((field) => (
              <div key={field.name} className={styles.formGroup}>
                <label className={styles.formLabel}>
                  {field.label}
                  {field.required && <span style={{ color: "var(--red)" }}> *</span>}
                </label>
                {renderField(field)}
              </div>
            ))}
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              <RiSendPlaneLine size={15} />
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
