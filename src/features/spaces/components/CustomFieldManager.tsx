import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
} from "@/services/api";
import type { CustomFieldDefinition } from "@/services/api";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEditLine,
  RiListSettingsLine,
} from "react-icons/ri";
import SideDrawer from "@/components/ui/SideDrawer";
import styles from "./CustomFieldManager.module.css";

interface Props {
  pod: string;
}

const FIELD_TYPE_OPTIONS: { value: CustomFieldDefinition["field_type"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
];

export default function CustomFieldManager({ pod }: Props) {
  const qc = useQueryClient();
  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["custom-fields", pod],
    queryFn: () => fetchCustomFields(pod),
  });

  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState<CustomFieldDefinition | null>(null);

  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldDefinition["field_type"]>("text");
  const [optionsStr, setOptionsStr] = useState("");
  const [isRequired, setIsRequired] = useState(false);

  const resetForm = () => {
    setName("");
    setFieldType("text");
    setOptionsStr("");
    setIsRequired(false);
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setShowDrawer(true);
  };

  const openEdit = (field: CustomFieldDefinition) => {
    setEditing(field);
    setName(field.name);
    setFieldType(field.field_type);
    setOptionsStr(field.options?.join("\n") ?? "");
    setIsRequired(field.is_required);
    setShowDrawer(true);
  };

  const closeDrawer = () => {
    setShowDrawer(false);
    resetForm();
  };

  const parseOptions = () =>
    optionsStr.split("\n").map((s) => s.trim()).filter(Boolean);

  const createMut = useMutation({
    mutationFn: () =>
      createCustomField(pod, {
        name,
        field_type: fieldType,
        options: fieldType === "select" ? parseOptions() : undefined,
        is_required: isRequired,
        display_order: fields.length,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-fields", pod] });
      toast.success("Custom field created");
      closeDrawer();
    },
    onError: () => toast.error("Failed to create custom field"),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      updateCustomField(pod, editing!.id, {
        name,
        field_type: fieldType,
        options: fieldType === "select" ? parseOptions() : undefined,
        is_required: isRequired,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-fields", pod] });
      toast.success("Custom field updated");
      closeDrawer();
    },
    onError: () => toast.error("Failed to update custom field"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCustomField(pod, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-fields", pod] });
      toast.success("Custom field deleted");
    },
    onError: () => toast.error("Failed to delete custom field"),
  });

  const save = () => {
    if (!name.trim()) { toast.error("Field name is required"); return; }
    if (fieldType === "select" && parseOptions().length === 0) {
      toast.error("Dropdown fields need at least one option");
      return;
    }
    if (editing) updateMut.mutate();
    else createMut.mutate();
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.newBtn} onClick={openCreate}>
            <RiAddLine size={14} />
            Add Field
          </button>
        </div>

        {isLoading && <div className={styles.empty}>Loading…</div>}

        {!isLoading && fields.length === 0 && (
          <div className={styles.empty}>
            No custom fields defined yet.
          </div>
        )}

        <div className={styles.fieldList}>
          {fields.map((field) => (
            <div key={field.id} className={styles.fieldCard}>
              <div className={styles.fieldLeft}>
                <div className={styles.fieldName}>
                  {field.name}
                  <span className={styles.fieldTypeBadge}>{field.field_type}</span>
                  {field.is_required && <span className={styles.requiredBadge}>required</span>}
                </div>
                {field.field_type === "select" && field.options && (
                  <div className={styles.fieldOptions}>{field.options.join(" · ")}</div>
                )}
              </div>
              <div className={styles.fieldRight}>
                <button className={styles.iconBtn} onClick={() => openEdit(field)} title="Edit">
                  <RiEditLine size={16} />
                </button>
                <button
                  className={styles.iconBtnDanger}
                  onClick={() => {
                    if (confirm(`Delete custom field "${field.name}"?`)) deleteMut.mutate(field.id);
                  }}
                  title="Delete"
                >
                  <RiDeleteBinLine size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Side drawer form ── */}
      <SideDrawer
        open={showDrawer}
        onClose={closeDrawer}
        size="xs"
        title={editing ? "Edit Field" : "New Custom Field"}
        avatar={<RiListSettingsLine size={18} />}
      >
        <div className={styles.drawerBody}>

          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Field name</label>
            <input
              className={styles.textInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Severity"
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Field type</label>
            <select
              className={styles.select}
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as CustomFieldDefinition["field_type"])}
            >
              {FIELD_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {fieldType === "select" && (
            <div className={styles.formGroup}>
              <label className={styles.fieldLabel}>Options (one per line)</label>
              <textarea
                className={styles.textarea}
                value={optionsStr}
                onChange={(e) => setOptionsStr(e.target.value)}
                placeholder={"Low\nMedium\nHigh"}
                rows={4}
              />
            </div>
          )}

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
            />
            <span>Required field</span>
          </label>

          <div className={styles.drawerActions}>
            <button className={styles.secondaryBtn} onClick={closeDrawer}>
              Cancel
            </button>
            <button className={styles.primaryBtn} onClick={save} disabled={isPending}>
              {isPending ? "Saving…" : editing ? "Save Changes" : "Create Field"}
            </button>
          </div>
        </div>
      </SideDrawer>
    </>
  );
}
