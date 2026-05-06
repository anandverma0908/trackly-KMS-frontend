import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore, getAuthHeader } from "@/features/auth/useAuthStore";
import { initials } from "@/utils/formatters";
import LatticeGrid, { Column } from "@/components/ui/LatticeGrid";
import styles from "./UsersPage.module.css";
import { MdModeEdit } from "react-icons/md";
import { TbKeyFilled } from "react-icons/tb";
import { TbTrashFilled } from "react-icons/tb";
import { RiSearchLine } from "react-icons/ri";

const API = import.meta.env.VITE_API_URL || "";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "engineering_manager", label: "Engineering Manager" },
  { value: "tech_lead", label: "Tech Lead" },
  { value: "team_member", label: "Team Member" },
  { value: "finance_viewer", label: "Finance Viewer" },
];

const ALL_PODS = [
  "DPAI", "EDM", "SNOP", "SNOE", "PA", "IAM", "PLAT", "SNPRM", "TMSNG",
];

const COLORS = [
  "#f59e0b", "#34D399", "#FBBF24", "#F87171", "#A78BFA", "#22D3EE", "#64748B",
];
function getColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  pod: string | null;
  title: string | null;
  status: string;
  last_login: string | null;
}

interface ConfirmState {
  title: string;
  message: string;
  onConfirm: () => void;
}

const emptyForm = {
  name: "",
  email: "",
  role: "team_member",
  pods: [] as string[],
  password: "",
};

export default function UsersTab() {
  const currentUser = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [resetModal, setResetModal] = useState<UserRow | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [confirmDlg, setConfirmDlg] = useState<ConfirmState | null>(null);

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/users`, { headers: getAuthHeader() });
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await fetch(`${API}/api/users/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          name: body.name,
          email: body.email,
          role: body.role,
          pod: body.pods.join(","),
          password: body.password || undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail ?? "Error");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("User created");
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowModal(false);
      setForm({ ...emptyForm });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (body: { id: string; role: string; pod: string }) => {
      const res = await fetch(`${API}/api/users/${body.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ role: body.role, pod: body.pod }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail ?? "Error");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["users"] });
      setEditUser(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: async ({ id, pwd }: { id: string; pwd: string }) => {
      const res = await fetch(`${API}/api/users/${id}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ password: pwd }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail ?? "Error");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Password reset");
      setResetModal(null);
      setNewPwd("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API}/api/users/${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast.success("User removed");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function askConfirm(title: string, message: string, onConfirm: () => void) {
    setConfirmDlg({ title, message, onConfirm });
  }

  function openEdit(u: UserRow) {
    setEditUser(u);
    setForm({
      name: u.name,
      email: u.email,
      role: u.role,
      pods: u.pod ? u.pod.split(",").map((p) => p.trim()).filter(Boolean) : [],
      password: "",
    });
  }

  function togglePod(pod: string) {
    setForm((f) => ({
      ...f,
      pods: f.pods.includes(pod) ? f.pods.filter((p) => p !== pod) : [...f.pods, pod],
    }));
  }

  const filtered = users.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const COLUMNS: Column<UserRow>[] = [
    {
      key: "name",
      label: "User",
      width: 320,
      sortable: true,
      render: (u) => (
        <div className={styles.userCell}>
          <div
            className={styles.avatar}
            style={{
              background: `linear-gradient(135deg,${getColor(u.name)},${getColor(u.name)}aa)`,
            }}
          >
            {initials(u.name)}
          </div>
          <div>
            <div className={styles.userName}>{u.name}</div>
            <div className={styles.userEmail}>{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      width: 170,
      sortable: true,
      render: (u) => (
        <span className={styles.roleBadge} data-role={u.role}>
          {ROLES.find((r) => r.value === u.role)?.label ?? u.role}
        </span>
      ),
    },
    {
      key: "pod",
      label: "PODs",
      width: 320,
      render: (u) => (
        <div className={styles.pods}>
          {u.pod ? (
            u.pod.split(",").map((p) => p.trim()).filter(Boolean).map((p) => (
              <span key={p} className={styles.podChip}>{p}</span>
            ))
          ) : (
            <span className={styles.noPod}>—</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: 120,
      render: (u) => (
        <span className={`${styles.status} ${u.status === "active" ? styles.active : styles.pending}`}>
          {u.status}
        </span>
      ),
    },
    {
      key: "last_login",
      label: "Last Login",
      width: 120,
      sortable: true,
      render: (u) => (
        <span className={styles.lastLogin}>
          {u.last_login
            ? new Date(u.last_login).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "2-digit",
              })
            : "Never"}
        </span>
      ),
    },
    {
      key: "id",
      label: "",
      width: 120,
      render: (u) => (
        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); openEdit(u); }} title="Edit">
            <MdModeEdit />
          </button>
          <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); setResetModal(u); }} title="Reset password">
            <TbKeyFilled />
          </button>
          {u.id !== currentUser?.id && (
            <button
              className={`${styles.actionBtn} ${styles.deleteBtn}`}
              title="Remove"
              onClick={(e) => {
                e.stopPropagation();
                askConfirm(
                  "Remove user",
                  `Are you sure you want to remove ${u.name}? This cannot be undone.`,
                  () => deleteMutation.mutate(u.id),
                );
              }}
            >
              <TbTrashFilled />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={`${styles.header} fade-up`} style={{ padding: 0, marginBottom: 16 }}>
        <div>
          <h2 className={styles.title}>User Management</h2>
          <p className={styles.subtitle}>{users.length} users in your organisation</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm({ ...emptyForm }); setShowModal(true); }}>
          + Add User
        </button>
      </div>

      <div className={styles.searchWrap}>
        <RiSearchLine size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
        <input className={styles.searchInput} placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <LatticeGrid<UserRow>
        columns={COLUMNS}
        rows={filtered}
        rowKey="id"
        isLoading={isLoading}
        virtualize={false}
        emptyIcon="👥"
        emptyTitle="No users found"
        emptyDesc="Try a different search or add a new user."
        footerLeft={!isLoading ? `${filtered.length} of ${users.length} users` : undefined}
      />

      {/* Create / Edit Modal */}
      {(showModal || editUser) && (
        <div className={styles.overlay} onClick={() => { setShowModal(false); setEditUser(null); }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editUser ? "Edit User" : "Add New User"}</h2>
              <button className={styles.closeBtn} onClick={() => { setShowModal(false); setEditUser(null); }}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {!editUser && (
                <>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Full Name</label>
                    <input className={styles.fieldInput} placeholder="Anand Verma" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Email</label>
                    <input className={styles.fieldInput} placeholder="anand@company.com" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Initial Password <span className={styles.optional}>(optional — user can set later)</span></label>
                    <input className={styles.fieldInput} placeholder="e.g. empCode" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                  </div>
                </>
              )}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Role</label>
                <select className={styles.fieldSelect} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>POD Access</label>
                <div className={styles.podGrid}>
                  {ALL_PODS.map((pod) => (
                    <button type="button" key={pod} className={`${styles.podToggle} ${form.pods.includes(pod) ? styles.podToggleOn : ""}`} onClick={() => togglePod(pod)}>{pod}</button>
                  ))}
                </div>
                <div className={styles.podHint}>
                  {form.pods.length === 0 ? "No PODs selected" : `${form.pods.length} selected: ${form.pods.join(", ")}`}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowModal(false); setEditUser(null); }}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={createMutation.isPending || updateMutation.isPending} onClick={() =>
                editUser ? updateMutation.mutate({ id: editUser.id, role: form.role, pod: form.pods.join(",") }) : createMutation.mutate(form)
              }>
                {createMutation.isPending || updateMutation.isPending ? "Saving…" : editUser ? "Save Changes" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className={styles.overlay} onClick={() => setResetModal(null)}>
          <div className={styles.modal} style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Reset Password</h2>
              <button className={styles.closeBtn} onClick={() => setResetModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.resetInfo}>Setting a new password for <strong>{resetModal.name}</strong></p>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>New Password</label>
                <input className={styles.fieldInput} type="password" placeholder="Min 6 characters" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoFocus />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-ghost btn-sm" onClick={() => setResetModal(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={newPwd.length < 6 || resetMutation.isPending} onClick={() => resetMutation.mutate({ id: resetModal.id, pwd: newPwd })}>
                {resetMutation.isPending ? "Resetting…" : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDlg && (
        <div className={styles.overlay} onClick={() => setConfirmDlg(null)}>
          <div className={styles.modal} style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{confirmDlg.title}</h2>
              <button className={styles.closeBtn} onClick={() => setConfirmDlg(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.resetInfo}>{confirmDlg.message}</p>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDlg(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={() => { confirmDlg.onConfirm(); setConfirmDlg(null); }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
