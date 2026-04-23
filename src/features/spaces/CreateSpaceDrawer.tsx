import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SideDrawer from "@/components/ui/SideDrawer";
import { createSpace, fetchOrgUsers } from "@/services/api";
import styles from "./CreateSpaceDrawer.module.css";
import { RiUserAddLine, RiCloseLine, RiArrowDownSLine, RiCheckLine } from "react-icons/ri";

interface CreateSpaceDrawerProps {
  open: boolean;
  onClose: () => void;
}

function _makeKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words.map((w) => w[0]).join("").toUpperCase();
}

function _initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  engineering_manager: "Eng Manager",
  tech_lead: "Tech Lead",
  team_member: "Member",
  finance_viewer: "Finance",
};

export default function CreateSpaceDrawer({ open, onClose }: CreateSpaceDrawerProps) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("#4F7EFF");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setName(""); setKey(""); setDescription(""); setCategory("");
      setColor("#4F7EFF"); setSelectedIds([]); setDropdownOpen(false); setSearch("");
    }
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { data: orgUsers = [] } = useQuery({
    queryKey: ["org-members"],
    queryFn: fetchOrgUsers,
    enabled: open,
  });

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return orgUsers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [orgUsers, search]);

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

  function toggleMember(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const k = derivedKey;
    if (!k || !name) { toast.error("Name and key are required"); return; }
    createMut.mutate({
      key: k, name: name.trim(), description: description.trim(),
      category: category.trim() || "Engineering", color, member_ids: selectedIds,
    });
  }

  const selectedUsers = orgUsers.filter((u) => selectedIds.includes(u.id));

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      size="md"
      title="Create Space"
      subtitle="Set up a new project space and assign team members"
      footer={
        <div className={styles.footer}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
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

        <div className={styles.field}>
          <label className={styles.label}>Space Name <span className={styles.required}>*</span></label>
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
            placeholder="What does this team work on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Color</label>
          <div className={styles.colorRow}>
            {["#4F7EFF","#34D399","#FBBF24","#F87171","#A78BFA","#22D3EE","#FB923C","#64748B"].map((c) => (
              <button
                key={c} type="button"
                className={`${styles.colorDot} ${color === c ? styles.colorDotActive : ""}`}
                onClick={() => setColor(c)}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        {/* ── Members dropdown ── */}
        <div className={styles.field}>
          <label className={styles.label}>
            <RiUserAddLine size={13} />
            Team Members
            {selectedIds.length > 0 && (
              <span className={styles.memberCount}>{selectedIds.length} selected</span>
            )}
          </label>

          <div className={styles.dropdownWrap} ref={dropdownRef}>
            <button
              type="button"
              className={styles.dropdownTrigger}
              onClick={() => setDropdownOpen((v) => !v)}
            >
              <span className={styles.dropdownPlaceholder}>
                {selectedIds.length === 0
                  ? "Select team members…"
                  : `${selectedIds.length} member${selectedIds.length > 1 ? "s" : ""} selected`}
              </span>
              <RiArrowDownSLine
                size={16}
                className={`${styles.dropdownArrow} ${dropdownOpen ? styles.dropdownArrowOpen : ""}`}
              />
            </button>

            {dropdownOpen && (
              <div className={styles.dropdown}>
                <div className={styles.dropdownSearch}>
                  <input
                    className={styles.dropdownSearchInput}
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className={styles.dropdownList}>
                  {filteredUsers.length === 0 && (
                    <div className={styles.dropdownEmpty}>No users found</div>
                  )}
                  {filteredUsers.map((u) => {
                    const selected = selectedIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={`${styles.dropdownItem} ${selected ? styles.dropdownItemSelected : ""}`}
                        onClick={() => toggleMember(u.id)}
                      >
                        <div className={styles.memberAvatar}>{_initials(u.name)}</div>
                        <div className={styles.memberInfo}>
                          <div className={styles.memberName}>{u.name}</div>
                          <div className={styles.memberMeta}>{ROLE_LABEL[u.role] ?? u.role} · {u.email}</div>
                        </div>
                        {selected && <RiCheckLine size={14} className={styles.checkIcon} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Selected chips */}
          {selectedUsers.length > 0 && (
            <div className={styles.chips}>
              {selectedUsers.map((u) => (
                <span key={u.id} className={styles.chip}>
                  {u.name}
                  <button type="button" className={styles.chipRemove} onClick={() => toggleMember(u.id)}>
                    <RiCloseLine size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

      </form>
    </SideDrawer>
  );
}
