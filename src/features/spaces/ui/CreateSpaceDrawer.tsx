import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SideDrawer from "@/components/ui/SideDrawer";
import { createSpace } from "@/services/api";
import styles from "./CreateSpaceDrawer.module.scss";

import { RiRocketLine, RiBrainLine, RiBrushLine, RiBriefcaseLine, RiSparklingLine } from "react-icons/ri";

interface CreateSpaceDrawerProps {
  open: boolean;
  onClose: () => void;
}

const TEMPLATES = [
  {
    id: "platform",
    label: "Platform Engineering",
    key: "PLAT",
    category: "Platform",
    color: "#34D399",
    description: "Core infrastructure, CI/CD, and developer tooling.",
    icon: <RiRocketLine size={20} />,
  },
  {
    id: "ai",
    label: "AI / ML",
    key: "AIML",
    category: "AI / ML",
    color: "#A78BFA",
    description: "Model training, inference pipelines, and AI products.",
    icon: <RiBrainLine size={20} />,
  },
  {
    id: "product",
    label: "Product / Frontend",
    key: "PROD",
    category: "Product",
    color: "#FBBF24",
    description: "User-facing features, design systems, and web apps.",
    icon: <RiBrushLine size={20} />,
  },
  {
    id: "gtm",
    label: "Sales / GTM",
    key: "GTM",
    category: "GTM",
    color: "#22D3EE",
    description: "Revenue operations, CRM, and go-to-market tooling.",
    icon: <RiBriefcaseLine size={20} />,
  },
];

function _makeKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words.map((w) => w[0]).join("").toUpperCase();
}

export default function CreateSpaceDrawer({ open, onClose }: CreateSpaceDrawerProps) {
  const qc = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("#4F7EFF");

  useEffect(() => {
    if (!open) {
      setSelectedTemplate(null);
      setName("");
      setKey("");
      setDescription("");
      setCategory("");
      setColor("#4F7EFF");
    }
  }, [open]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const t = TEMPLATES.find((x) => x.id === selectedTemplate);
    if (!t) return;
    setKey(t.key);
    setCategory(t.category);
    setColor(t.color);
    setDescription(t.description);
  }, [selectedTemplate]);

  const derivedKey = useMemo(() => {
    if (key) return key.toUpperCase();
    return _makeKey(name);
  }, [name, key]);

  const createMut = useMutation({
    mutationFn: createSpace,
    onSuccess: () => {
      toast.success("Space created");
      qc.invalidateQueries({ queryKey: ["pod-summary"] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const k = derivedKey;
    if (!k || !name) {
      toast.error("Name and key are required");
      return;
    }
    createMut.mutate({
      key: k,
      name: name.trim(),
      description: description.trim(),
      category: category.trim() || "Engineering",
      color,
    });
  }

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      size="md"
      title="Create Space"
      subtitle="Set up a new POD with a smart template"
      badge={
        <span className={styles.badge}>
          <RiSparklingLine size={12} />
          Smart Templates
        </span>
      }
      footer={
        <div className={styles.footer}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-space-form"
            className="btn btn-primary btn-sm"
            disabled={createMut.isPending || !name.trim() || !derivedKey}
          >
            {createMut.isPending ? "Creating…" : "Create Space"}
          </button>
        </div>
      }
    >
      <form id="create-space-form" className={styles.drawerBody} onSubmit={handleSubmit}>
        <div className={styles.templatesSection}>
          <div className={styles.sectionLabel}>Choose a template</div>
          <div className={styles.templatesRow}>
            {TEMPLATES.map((t) => {
              const active = selectedTemplate === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.templateCard} ${active ? styles.templateCardActive : ""}`}
                  onClick={() => {
                    setSelectedTemplate(t.id);
                    setName(t.label);
                  }}
                  style={active ? { borderColor: t.color } : {}}
                >
                  <div
                    className={styles.templateIcon}
                    style={{ background: `${t.color}18`, color: t.color }}
                  >
                    {t.icon}
                  </div>
                  <div className={styles.templateName}>{t.label}</div>
                  <div className={styles.templateKey}>{t.key}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Space Name</label>
          <input
            className={styles.input}
            placeholder="e.g. Platform Engineering"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>Key</label>
            <input
              className={styles.input}
              placeholder="AUTO"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onBlur={() => setKey((v) => v.toUpperCase())}
            />
            <div className={styles.hint}>Auto: {derivedKey || "—"}</div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Category</label>
            <input
              className={styles.input}
              placeholder="Engineering"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Description</label>
          <textarea
            className={styles.textarea}
            rows={3}
            placeholder="What does this team do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Color</label>
          <div className={styles.colorRow}>
            {["#4F7EFF", "#34D399", "#FBBF24", "#F87171", "#A78BFA", "#22D3EE", "#FB923C", "#64748B"].map(
              (c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorDot} ${color === c ? styles.colorDotActive : ""}`}
                  onClick={() => setColor(c)}
                  style={{ background: c }}
                  aria-label={`Select color ${c}`}
                />
              ),
            )}
          </div>
        </div>
      </form>
    </SideDrawer>
  );
}
