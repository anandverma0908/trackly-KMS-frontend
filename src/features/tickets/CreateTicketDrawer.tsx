import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  createTicket,
  updateTicket,
  analyzeTicketNL,
  novaQuery,
  fetchFilters,
  fetchTicketComments,
  createComment,
  deleteComment,
  fetchTicketActivity,
  logTime,
  fetchTicket,
  fetchTicketCodeContext,
  uploadAttachment,
  fetchTicketAttachments,
  type CodeContextResult,
} from "@/services/api";
import { useAuthStore } from "@/features/auth/useAuthStore";
import { QUERY_KEYS } from "@/config/queryKeys";
import SideDrawer from "@/components/ui/SideDrawer";
import { formatDate } from "@/utils/formatters";
import type {
  TicketCreate,
  NLAnalysisResult,
  DuplicateTicket,
  TicketActivity,
} from "@/types";
import type { ProjectMember } from "@/features/spaces/spacesData";
import styles from "./CreateTicketDrawer.module.css";

// MUI
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Autocomplete from "@mui/material/Autocomplete";

import {
  RiSparklingLine,
  RiAttachmentLine,
  RiTimeLine,
  RiLink,
  RiAddLine,
  RiDeleteBinLine,
  RiBugLine,
  RiBookmarkLine,
  RiCheckboxLine,
  RiFlashlightLine,
  RiCornerDownRightLine,
  RiArrowUpLine,
  RiArrowUpDoubleLine,
  RiArrowUpSLine,
  RiDragMoveLine,
  RiArrowDownSLine,
  RiArrowDownDoubleLine,
  RiCheckboxBlankCircleFill,
  RiArrowDownWideFill,
  RiAlertLine,
  RiCodeSSlashLine,
  RiGitMergeLine,
} from "react-icons/ri";

/* ── Config ── */
const ISSUE_TYPES = [
  {
    value: "Story",
    label: "Story",
    color: "#4F7EFF",
    icon: <RiBookmarkLine size={14} />,
  },
  {
    value: "Bug",
    label: "Bug",
    color: "#F87171",
    icon: <RiBugLine size={14} />,
  },
  {
    value: "Task",
    label: "Task",
    color: "#A78BFA",
    icon: <RiCheckboxLine size={14} />,
  },
  {
    value: "Epic",
    label: "Epic",
    color: "#FBBF24",
    icon: <RiFlashlightLine size={14} />,
  },
  {
    value: "Subtask",
    label: "Subtask",
    color: "#94A3B8",
    icon: <RiCornerDownRightLine size={14} />,
  },
  {
    value: "Improvement",
    label: "Improvement",
    color: "#34D399",
    icon: <RiArrowUpLine size={14} />,
  },
];

const PRIORITIES = [
  {
    value: "Highest",
    label: "Highest",
    color: "#F87171",
    icon: <RiArrowUpDoubleLine size={14} />,
  },
  {
    value: "High",
    label: "High",
    color: "#FB923C",
    icon: <RiArrowUpSLine size={14} />,
  },
  {
    value: "Medium",
    label: "Medium",
    color: "#FBBF24",
    icon: <RiDragMoveLine size={14} />,
  },
  {
    value: "Low",
    label: "Low",
    color: "#94A3B8",
    icon: <RiArrowDownSLine size={14} />,
  },
  {
    value: "Lowest",
    label: "Lowest",
    color: "#64748B",
    icon: <RiArrowDownDoubleLine size={14} />,
  },
];

const STATUSES = [
  { value: "To Do", label: "To Do", color: "#64748B" },
  { value: "In Progress", label: "In Progress", color: "#FBBF24" },
  { value: "In Review", label: "In Review", color: "#A78BFA" },
  { value: "Blocked", label: "Blocked", color: "#F87171" },
  { value: "Done", label: "Done", color: "#34D399" },
];

const LINK_TYPES = [
  "blocks",
  "is blocked by",
  "relates to",
  "duplicates",
  "is duplicated by",
  "cloned from",
];
const STORY_POINTS = [1, 2, 3, 5, 8, 13, 21];

/* ── Types ── */
interface LinkedIssue {
  type: string;
  key: string;
}

interface FormState extends TicketCreate {
  status: string;
  reporter: string;
  epic: string;
  parent: string;
  originalEst: string;
  timeSpent: string;
  remaining: string;
  linkedIssues: LinkedIssue[];
  attachments: File[];
}

export interface CreateTicketDrawerProps {
  open: boolean;
  onClose: () => void;
  defaultStatus?: string;
  defaultPod?: string;
  sprintName?: string;
  sprintId?: number;
  members?: ProjectMember[];
  /** If provided, called instead of API (for local/mock data flows) */
  onCreated?: (data: Partial<FormState>) => void;
  /** Called after a successful create or update (in addition to onCreated) */
  onSuccess?: () => void;
  /** Edit mode: key of the ticket being viewed/edited */
  ticketKey?: string;
  /** Edit mode: initial form values to populate */
  initialData?: Partial<FormState>;
  /** View mode: disables all inputs and hides action buttons */
  readOnly?: boolean;
}

/* ────────────────────────────────────────── */
export default function CreateTicketDrawer({
  open,
  onClose,
  defaultStatus = "To Do",
  defaultPod,
  sprintName,
  sprintId,
  members = [],
  onCreated,
  onSuccess,
  ticketKey,
  initialData,
  readOnly = false,
}: CreateTicketDrawerProps) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  /* Default fallback values when API returns empty */
  const DEFAULT_PODS = ["DPAI", "SNOP", "EDM", "PLAT", "SNOE", "PA"];
  const DEFAULT_CLIENTS = [
    "Colgate",
    "Jockey",
    "SAAS",
    "BSV",
    "ReckittBenckiser",
    "Henkel",
    "Unilever",
  ];

  /* NOVA */
  const [novaOpen, setNovaOpen] = useState(true);
  const [nlText, setNlText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateTicket[]>([]);

  /* Live duplicate detection + story estimation */
  const [liveDupes, setLiveDupes] = useState<
    { key: string; summary: string; similarity: number; ai?: boolean }[]
  >([]);
  const [aiDupeScanning, setAiDupeScanning] = useState(false);
  const [storyEstimate, setStoryEstimate] = useState<{
    min: number;
    max: number;
    confidence: number;
    basedOn: number;
    reasoning?: string;
  } | null>(null);
  const [storyAiLoading, setStoryAiLoading] = useState(false);
  const aiDupeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Intelligent routing */
  const [routingSuggestion, setRoutingSuggestion] = useState<{
    assignee: string;
    reason: string;
  } | null>(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingDismissed, setRoutingDismissed] = useState(false);
  const routingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Code-Aware Context */
  const [codeCtxOpen, setCodeCtxOpen] = useState(true);
  const [codeCtx, setCodeCtx] = useState<CodeContextResult | null>(null);
  const [codeCtxLoading, setCodeCtxLoading] = useState(false);
  const storyAiRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Tabs */
  const [tab, setTab] = useState(0);

  /* Label input */
  const [labelInput, setLabelInput] = useState("");

  /* Link input */
  const [newLinkType, setNewLinkType] = useState(LINK_TYPES[0]);
  const [newLinkKey, setNewLinkKey] = useState("");

  /* Comments (edit mode only) */
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);

  /* Worklogs (edit mode only) */
  const [wlHours, setWlHours] = useState("");
  const [wlComment, setWlComment] = useState("");
  const [wlDate, setWlDate] = useState(new Date().toISOString().split("T")[0]);

  /* File drag */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Track whether this open-session has been initialized, so user edits
     are never overwritten by a stale initialData reference change */
  const hasInitialized = useRef(false);

  /* Form — reporter pre-seeded from auth store so it shows immediately */
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    issue_type: "Task",
    priority: "Medium",
    status: defaultStatus,
    reporter: isAdmin ? "" : (user?.name ?? ""),
    epic: "",
    parent: "",
    originalEst: "",
    timeSpent: "",
    remaining: "",
    linkedIssues: [],
    attachments: [],
    labels: [],
  });

  const isEdit = Boolean(ticketKey);

  // Populate form exactly once per open-session
  useEffect(() => {
    if (!open) {
      // Drawer closed — reset the initialization flag for the next open
      hasInitialized.current = false;
      return;
    }

    // Already initialized this session — do not overwrite user edits
    if (hasInitialized.current) return;

    if (isEdit && initialData) {
      // Edit mode — data arrived, populate form once
      hasInitialized.current = true;
      setForm({
        title: initialData.title || "",
        description: initialData.description || "",
        issue_type: initialData.issue_type || "Task",
        priority: initialData.priority || "Medium",
        status: initialData.status || defaultStatus,
        reporter: initialData.reporter || (!isAdmin ? (user?.name ?? "") : ""),
        epic: initialData.epic || "",
        parent: initialData.parent || "",
        originalEst: initialData.originalEst || "",
        timeSpent: initialData.timeSpent || "",
        remaining: initialData.remaining || "",
        linkedIssues: initialData.linkedIssues || [],
        attachments: initialData.attachments || [],
        labels: initialData.labels || [],
        assignee: initialData.assignee,
        pod: initialData.pod,
        client: initialData.client,
        story_points: initialData.story_points,
        due_date: initialData.due_date,
      });
      setNovaOpen(false);
      setNlText("");
      setConfidence(null);
      setDuplicates([]);
      setTab(0);
      setLabelInput("");
      setNewLinkType(LINK_TYPES[0]);
      setNewLinkKey("");
      setCommentText("");
      setReplyTo(null);
      setWlHours("");
      setWlComment("");
      setWlDate(new Date().toISOString().split("T")[0]);
    } else if (!isEdit) {
      // Create mode — blank form, pre-fill pod from context if provided
      hasInitialized.current = true;
      setForm({
        title: "",
        description: "",
        issue_type: "Task",
        priority: "Medium",
        status: defaultStatus,
        reporter: isAdmin ? "" : (user?.name ?? ""),
        epic: "",
        parent: "",
        originalEst: "",
        timeSpent: "",
        remaining: "",
        linkedIssues: [],
        attachments: [],
        labels: [],
        pod: defaultPod,
      });
      setNovaOpen(true);
      setNlText("");
      setConfidence(null);
      setDuplicates([]);
      setTab(0);
      setLabelInput("");
      setNewLinkType(LINK_TYPES[0]);
      setNewLinkKey("");
      setCommentText("");
      setReplyTo(null);
      setWlHours("");
      setWlComment("");
      setWlDate(new Date().toISOString().split("T")[0]);
    }
    // isEdit && !initialData → still loading, wait for next render
  }, [open, defaultStatus, isEdit, initialData]);

  const set = (k: keyof FormState, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  /* AI-only duplicate detection — runs on title + description change */
  useEffect(() => {
    if (isEdit || form.title.length < 4) {
      setLiveDupes([]);
      setAiDupeScanning(false);
      if (aiDupeRef.current) clearTimeout(aiDupeRef.current);
      return;
    }

    // Show scanning immediately so user sees feedback right away
    setAiDupeScanning(true);

    if (aiDupeRef.current) clearTimeout(aiDupeRef.current);
    aiDupeRef.current = setTimeout(async () => {
      try {
        const query = [form.title, form.description].filter(Boolean).join("\n");
        const r = await analyzeTicketNL(query);
        if (r.duplicates && r.duplicates.length > 0) {
          setLiveDupes(r.duplicates.map((d) => ({ ...d, ai: true })));
        } else {
          setLiveDupes([]);
        }
      } catch {
        setLiveDupes([]);
      } finally {
        setAiDupeScanning(false);
      }
    }, 600);

    return () => {
      if (aiDupeRef.current) clearTimeout(aiDupeRef.current);
    };
  }, [form.title, form.description, isEdit]);

  /* AI story point estimation */
  useEffect(() => {
    if (isEdit || form.story_points || form.title.length < 8) {
      if (storyAiRef.current) clearTimeout(storyAiRef.current);
      return;
    }
    if (storyAiRef.current) clearTimeout(storyAiRef.current);
    storyAiRef.current = setTimeout(async () => {
      setStoryAiLoading(true);
      try {
        const res = await novaQuery(
          `Estimate Fibonacci story points for this ${form.issue_type} ticket: "${form.title}".${form.description ? ` Description: ${form.description.slice(0, 200)}` : ""}
Valid values: 1, 2, 3, 5, 8, 13. Return JSON only: {"min": number, "max": number, "confidence": 0.0-1.0, "reasoning": string}`,
        );
        const m = res.answer.match(/\{[\s\S]*?\}/);
        if (m) {
          const p = JSON.parse(m[0]);
          if (p.min && p.max)
            setStoryEstimate({
              min: p.min,
              max: p.max,
              confidence: p.confidence ?? 0.8,
              basedOn: 0,
              reasoning: p.reasoning,
            });
        }
      } catch {
        /* silently fail */
      } finally {
        setStoryAiLoading(false);
      }
    }, 1200);
    return () => {
      if (storyAiRef.current) clearTimeout(storyAiRef.current);
    };
  }, [
    form.title,
    form.description,
    form.issue_type,
    form.story_points,
    isEdit,
  ]);

  /* Intelligent routing — suggest best assignee after title is meaningful */
  useEffect(() => {
    const availableUsers = members.map((m) => m.name).filter(Boolean);
    if (isEdit || form.title.length < 8 || availableUsers.length === 0 || routingDismissed) return;
    if (routingRef.current) clearTimeout(routingRef.current);
    routingRef.current = setTimeout(async () => {
      setRoutingLoading(true);
      try {
        const memberList = availableUsers.slice(0, 20).join(", ");
        const res = await novaQuery(
          `You are an engineering team lead. Based on this ticket, suggest the single best assignee from the list and explain why in one short sentence.

Ticket title: "${form.title}"
${form.description ? `Description: ${form.description.slice(0, 300)}` : ""}
Type: ${form.issue_type}, Priority: ${form.priority}
Available team members: ${memberList}

Return ONLY valid JSON, no prose: {"assignee": "Exact Name", "reason": "one sentence explanation"}`,
        );
        const m = res.answer.match(/\{[\s\S]*?\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (parsed.assignee && availableUsers.includes(parsed.assignee)) {
            setRoutingSuggestion({ assignee: parsed.assignee, reason: parsed.reason });
          }
        }
      } catch {
        // silently ignore
      } finally {
        setRoutingLoading(false);
      }
    }, 1400);
    return () => { if (routingRef.current) clearTimeout(routingRef.current); };
  }, [form.title, form.description, form.issue_type, form.priority, isEdit, members, routingDismissed]);

  /* Reset routing suggestion when assignee is manually changed or form resets */
  useEffect(() => {
    setRoutingSuggestion(null);
    setRoutingDismissed(false);
  }, [open]);

  /* Filters */
  const { data: filtersData } = useQuery({
    queryKey: QUERY_KEYS.filters(),
    queryFn: fetchFilters,
  });
  const users = filtersData?.users ?? members.map((m) => m.name);
  const pods = filtersData?.pods?.length ? filtersData.pods : DEFAULT_PODS;
  const clients = filtersData?.clients?.length
    ? filtersData.clients
    : DEFAULT_CLIENTS;

  /* Ticket detail (for worklogs) — only in edit mode */
  const { data: ticketDetail } = useQuery({
    queryKey: ["ticket", ticketKey],
    queryFn: () => fetchTicket(ticketKey!),
    enabled: isEdit,
  });

  /* Code context — only in edit mode */
  useQuery({
    queryKey: ["ticket-code-ctx", ticketKey],
    queryFn: async () => {
      setCodeCtxLoading(true);
      try {
        const result = await fetchTicketCodeContext(
          ticketKey!,
          form.title,
          form.description,
        );
        setCodeCtx(result);
        return result;
      } finally {
        setCodeCtxLoading(false);
      }
    },
    enabled: isEdit && !!ticketKey,
    staleTime: 5 * 60 * 1000,
  });

  /* Server-side attachments — only in edit mode */
  const { data: serverAttachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ["ticket-attachments", ticketKey],
    queryFn: () => fetchTicketAttachments(ticketKey!),
    enabled: isEdit && !!ticketKey,
  });

  /* Comments — only in edit mode */
  const { data: comments = [] } = useQuery({
    queryKey: ["ticket-comments", ticketKey],
    queryFn: () => fetchTicketComments(ticketKey!),
    enabled: isEdit && tab === 3,
  });

  /* Activity — only in edit mode */
  const { data: serverActivity = [] } = useQuery({
    queryKey: ["ticket-activity", ticketKey],
    queryFn: () => fetchTicketActivity(ticketKey!),
    enabled: isEdit && tab === 4,
  });

  const commentMut = useMutation({
    mutationFn: ({
      content,
      parentId,
    }: {
      content: string;
      parentId?: number;
    }) => createComment(ticketKey!, content, parentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-comments", ticketKey] });
      setCommentText("");
      setReplyTo(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCmtMut = useMutation({
    mutationFn: (id: number) => deleteComment(ticketKey!, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["ticket-comments", ticketKey] }),
  });

  const logTimeMut = useMutation({
    mutationFn: ({
      hours,
      comment,
      date,
    }: {
      hours: number;
      comment: string;
      date: string;
    }) => logTime(ticketKey!, hours, comment, date),
    onSuccess: () => {
      toast.success("Time logged");
      setWlHours("");
      setWlComment("");
      qc.invalidateQueries({ queryKey: ["ticket", ticketKey] });
      qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleLogTime() {
    const hours = parseFloat(wlHours);
    if (!hours || hours <= 0) {
      toast.error("Enter valid hours");
      return;
    }
    logTimeMut.mutate({ hours, comment: wlComment, date: wlDate });
  }

  /* Activity merged with worklogs */
  const activity = useMemo<TicketActivity[]>(() => {
    const wlActivity: TicketActivity[] = (ticketDetail?.worklogs ?? []).map(
      (wl, idx) => ({
        id: -1000 - idx,
        ticket_key: ticketKey ?? "",
        actor: wl.author,
        action: "logged time",
        field: `${wl.hours}h`,
        new_value: wl.comment || undefined,
        created_at: wl.date,
      }),
    );
    const combined = [...serverActivity, ...wlActivity];
    combined.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return combined;
  }, [serverActivity, ticketDetail, ticketKey]);

  /* Top-level comments + replies */
  const topLevelComments = comments.filter((c) => !c.parent_id);
  const repliesFor = (parentId: number) =>
    comments.filter((c) => c.parent_id === parentId);

  /* Create mutation */
  const createMut = useMutation({
    mutationFn: createTicket,
    onSuccess: async (created) => {
      // Upload any pending attachments after the ticket is created
      if (form.attachments.length > 0) {
        const key = created?.key;
        if (key) {
          await Promise.allSettled(form.attachments.map((f) => uploadAttachment(key, f)));
        }
      }
      qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["new-tickets"] });
      if (defaultPod) {
        qc.invalidateQueries({ queryKey: ["space-project", defaultPod] });
      }
      toast.success("Ticket created!");
      onSuccess?.();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* Update mutation */
  const updateMut = useMutation({
    mutationFn: (payload: Partial<TicketCreate>) =>
      updateTicket(ticketKey!, payload),
    onSuccess: async () => {
      // Upload any new attachments added during edit
      if (form.attachments.length > 0 && ticketKey) {
        await Promise.allSettled(form.attachments.map((f) => uploadAttachment(ticketKey, f)));
        refetchAttachments();
        set("attachments", []);
      }
      qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["new-tickets"] });
      if (defaultPod) {
        qc.invalidateQueries({ queryKey: ["space-project", defaultPod] });
      }
      toast.success("Ticket updated!");
      onSuccess?.();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── NOVA: analyze NL ── */
  async function handleAnalyze() {
    if (!nlText.trim()) return;
    setAnalyzing(true);
    try {
      const r: NLAnalysisResult = await analyzeTicketNL(nlText);
      setForm((p) => ({
        ...p,
        title: r.title ?? p.title,
        description: r.description ?? p.description,
        pod: r.pod ?? p.pod,
        client: r.client ?? p.client,
        issue_type: r.issue_type ?? p.issue_type,
        priority: r.priority ?? p.priority,
        story_points: r.story_points ?? p.story_points,
        assignee: r.assignee ?? p.assignee,
        labels: r.labels ?? p.labels,
      }));
      setConfidence(r.confidence ?? null);
      if (r.duplicates?.length) setDuplicates(r.duplicates);
      if (r.story_points) {
        const basePts = r.story_points;
        setStoryEstimate({
          min: Math.max(1, basePts - 1),
          max: basePts + 1,
          confidence: r.confidence ?? 0.82,
          basedOn: 11,
        });
      }
      setNovaOpen(false);
      toast.success("EOS filled the form!");
    } catch {
      toast.error("EOS analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  /* ── NOVA: enhance description ── */
  async function handleEnhanceDesc() {
    if (!form.title.trim()) {
      toast.error("Add a title first");
      return;
    }
    setEnhancing(true);
    try {
      const res = await novaQuery(
        `You are EOS. Improve and expand this description for a ${form.issue_type} ticket titled "${form.title}".
Current description: "${form.description || "(empty)"}"
Write a clear, structured description covering: what it is, why it matters, acceptance criteria, and any edge cases.
Return only the improved description text — no labels, no JSON, just the description.`,
      );
      if (res.answer) set("description", res.answer.trim());
      toast.success("Description enhanced by EOS");
    } catch {
      toast.error("Enhancement failed");
    } finally {
      setEnhancing(false);
    }
  }

  /* ── Labels ── */
  function addLabel(e: React.KeyboardEvent) {
    if (e.key === "Enter" && labelInput.trim()) {
      e.preventDefault();
      set("labels", [...(form.labels ?? []), labelInput.trim()]);
      setLabelInput("");
    }
  }

  /* ── Linked issues ── */
  function addLink() {
    if (!newLinkKey.trim()) return;
    set("linkedIssues", [
      ...form.linkedIssues,
      { type: newLinkType, key: newLinkKey.trim().toUpperCase() },
    ]);
    setNewLinkKey("");
  }
  function removeLink(i: number) {
    set(
      "linkedIssues",
      form.linkedIssues.filter((_, idx) => idx !== i),
    );
  }

  /* ── Attachments ── */
  function handleFiles(files: FileList | null) {
    if (!files) return;
    set("attachments", [...form.attachments, ...Array.from(files)]);
  }
  function removeAttachment(i: number) {
    set(
      "attachments",
      form.attachments.filter((_, idx) => idx !== i),
    );
  }

  /* ── Submit ── */
  function handleSubmit() {
    if (!form.title.trim()) {
      toast.error("Summary is required");
      return;
    }
    if (onCreated) {
      onCreated({ ...form });
      onClose();
      return;
    }
    const payload: TicketCreate = {
      title: form.title,
      description: form.description,
      issue_type: form.issue_type,
      priority: form.priority,
      status: form.status,
      assignee: form.assignee,
      pod: form.pod,
      client: form.client,
      story_points: form.story_points,
      labels: form.labels,
      due_date: form.due_date,
    };
    if (sprintId) payload.sprint_id = String(sprintId);
    if (isEdit) {
      updateMut.mutate(payload);
    } else {
      createMut.mutate(payload);
    }
  }

  const typeConfig =
    ISSUE_TYPES.find((t) => t.value === form.issue_type) ?? ISSUE_TYPES[2];
  const priorityConfig =
    PRIORITIES.find((p) => p.value === form.priority) ?? PRIORITIES[2];
  const statusConfig =
    STATUSES.find((s) => s.value === form.status) ?? STATUSES[0];

  /* ── Footer ── */
  const footer = readOnly ? (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <button className={styles.btnSecondary} onClick={onClose}>
        Close
      </button>
    </div>
  ) : (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <button className={styles.btnSecondary} onClick={onClose}>
        Cancel
      </button>
      <button
        className={styles.btnPrimary}
        onClick={handleSubmit}
        disabled={createMut.isPending || updateMut.isPending}
      >
        {createMut.isPending || updateMut.isPending ? (
          <>
            <svg
              className={styles.spinner}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            {isEdit ? "Saving…" : "Creating…"}
          </>
        ) : (
          <>{isEdit ? "Save Changes" : "Create Ticket"}</>
        )}
      </button>
    </div>
  );

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      size="lg"
      title={
        readOnly
          ? `View ${ticketKey}`
          : isEdit
            ? `Edit ${ticketKey}`
            : "Create Issue"
      }
      subtitle={sprintName ? `Sprint: ${sprintName}` : undefined}
      badge={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "var(--accent-glow)",
            border: "1px solid var(--accent-border)",
            color: "var(--accent)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            padding: "3px 10px",
            borderRadius: 99,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 6px var(--accent)",
              animation: "pulse 2s infinite",
            }}
          />
          EOS AI
        </div>
      }
      footer={footer}
      bodyClassName={styles.bodyFlush}
    >
      <div className={styles.twoColumnLayout}>
        {/* LEFT COLUMN — Core ticket fields */}
        <div className={styles.leftColumn}>
          {!readOnly && (
            <div className={styles.novaPanel}>
              <div
                className={styles.novaHeader}
                onClick={() => setNovaOpen((v) => !v)}
              >
                <div className={styles.novaIcon}>
                  <RiSparklingLine size={14} />
                </div>
                <div className={styles.novaTitle}>
                  Describe in plain English — EOS will fill the form
                </div>
                <RiArrowDownWideFill
                  size={16}
                  className={`${styles.novaChevron} ${novaOpen ? styles.novaChevronOpen : ""}`}
                />
              </div>
              {novaOpen && (
                <div className={styles.novaBody}>
                  <textarea
                    className={styles.novaInput}
                    rows={2}
                    placeholder='e.g. "Fix login timeout in DPAI — high priority bug, affects Colgate users, ~3 story points"'
                    value={nlText}
                    onChange={(e) => setNlText(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && e.ctrlKey && handleAnalyze()
                    }
                  />
                  <div className={styles.novaActions}>
                    <button
                      className={styles.btnPrimary}
                      disabled={analyzing || !nlText.trim()}
                      onClick={handleAnalyze}
                      style={{ padding: "6px 12px", fontSize: 11 }}
                    >
                      {analyzing ? (
                        <>
                          <svg
                            className={styles.spinner}
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                          Analyzing…
                        </>
                      ) : (
                        <>
                          <RiSparklingLine size={12} />
                          Analyze with EOS
                        </>
                      )}
                    </button>
                    <button
                      className={styles.btnGhost}
                      onClick={() => setNovaOpen(false)}
                    >
                      Fill manually
                    </button>
                    <span className={styles.novaHint}>Ctrl+Enter</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── NOVA Confidence ── */}
          {confidence !== null && (
            <div className={styles.confidenceRow}>
              <span className={styles.confidenceLabel}>EOS confidence</span>
              <div className={styles.confidenceBar}>
                <div
                  className={styles.confidenceFill}
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span className={styles.confidenceValue}>
                {Math.round(confidence * 100)}%
              </span>
            </div>
          )}

          {/* ── Duplicate Warning ── */}
          {duplicates.length > 0 && (
            <div className={styles.duplicateAlert}>
              <div className={styles.duplicateHeader}>
                <div className={styles.duplicateTitle}>
                  <RiAlertLine size={13} />
                  Similar tickets found
                </div>
                <button
                  className={styles.duplicateClose}
                  onClick={() => setDuplicates([])}
                >
                  ✕
                </button>
              </div>
              {duplicates.map((d) => (
                <div key={d.key} className={styles.duplicateItem}>
                  <span className={styles.duplicateKey}>{d.key}</span>
                  <span className={styles.duplicateSummary}>{d.summary}</span>
                  <span className={styles.duplicateScore}>
                    {Math.round(d.similarity * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Summary ── */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Summary *</label>
            <input
              className={styles.textInput}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Short, descriptive summary"
              readOnly={readOnly}
            />
          </div>

          {/* ── Live Duplicate Detection Banner ── */}
          {!isEdit &&
            (aiDupeScanning || liveDupes.length > 0) &&
            form.title.length >= 4 && (
              <div className={styles.liveDupeBanner}>
                <div className={styles.liveDupeHeader}>
                  {aiDupeScanning ? (
                    <>
                      <svg
                        className={styles.spinner}
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      <span>EOS scanning for duplicates…</span>
                    </>
                  ) : (
                    <>
                      <RiAlertLine size={13} />
                      <span>
                        {liveDupes.length === 1
                          ? "A similar ticket"
                          : `${liveDupes.length} similar tickets`}{" "}
                        may already exist — review before creating
                      </span>
                    </>
                  )}
                  <button
                    className={styles.liveDupeClose}
                    onClick={() => {
                      setLiveDupes([]);
                      setAiDupeScanning(false);
                    }}
                  >
                    ✕
                  </button>
                </div>
                {liveDupes.map((d) => (
                  <div key={d.key} className={styles.liveDupeItem}>
                    <span className={styles.liveDupeKey}>{d.key}</span>
                    <span className={styles.liveDupeSummary}>
                      {d.summary.length > 60
                        ? d.summary.slice(0, 60) + "…"
                        : d.summary}
                    </span>
                    <span
                      className={styles.liveDupePct}
                      style={{ color: d.ai ? "var(--accent)" : undefined }}
                    >
                      {d.ai
                        ? "AI match"
                        : `${Math.round(d.similarity * 100)}% similar`}
                    </span>
                  </div>
                ))}
                {!aiDupeScanning && (
                  <div className={styles.liveDupeEos}>
                    <RiSparklingLine size={9} /> EOS semantic + keyword analysis
                  </div>
                )}
              </div>
            )}

          {/* ── Description + AI Enhance ── */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Description</label>
            <div className={styles.descWrap}>
              <textarea
                className={`${styles.textInput} ${styles.textArea}`}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Acceptance criteria, steps to reproduce, notes…"
                readOnly={readOnly}
              />
              {!readOnly && (
                <button
                  className={styles.enhanceBtn}
                  disabled={enhancing}
                  onClick={handleEnhanceDesc}
                  title="Enhance description with EOS AI"
                >
                  {enhancing ? (
                    <svg
                      className={styles.spinner}
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <RiSparklingLine size={14} />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* ── Current selections summary ── */}
          <div className={styles.summaryBar}>
            <span
              className={styles.summaryChip}
              style={{
                background: `${typeConfig.color}18`,
                color: typeConfig.color,
                borderColor: `${typeConfig.color}44`,
              }}
            >
              <span style={{ display: "flex" }}>{typeConfig.icon}</span>
              {typeConfig.label}
            </span>
            <span
              className={styles.summaryChip}
              style={{
                background: `${priorityConfig.color}18`,
                color: priorityConfig.color,
                borderColor: `${priorityConfig.color}44`,
              }}
            >
              <span style={{ display: "flex" }}>{priorityConfig.icon}</span>
              {priorityConfig.label}
            </span>
            <span
              className={styles.summaryChip}
              style={{
                background: `${statusConfig.color}18`,
                color: statusConfig.color,
                borderColor: `${statusConfig.color}44`,
              }}
            >
              <RiCheckboxBlankCircleFill size={8} />
              {statusConfig.label}
            </span>
            {form.assignee && (
              <span
                className={`${styles.summaryChip} ${styles.summaryChipDefault}`}
              >
                @ {form.assignee}
              </span>
            )}
            {form.story_points && (
              <span
                className={`${styles.summaryChip} ${styles.summaryChipDefault}`}
              >
                {form.story_points} pts
              </span>
            )}
          </div>
        </div>
        {/* end leftColumn */}

        {/* RIGHT COLUMN — Context, Tabs & Details */}
        <div className={styles.rightColumn}>
          {/* ── Code Context ── */}
          {isEdit && (
            <div className={styles.codeCtxCard}>
              <div
                className={styles.codeCtxHeader}
                onClick={() => setCodeCtxOpen((v) => !v)}
              >
                <RiCodeSSlashLine size={13} color="var(--accent)" />
                <span className={styles.codeCtxTitle}>Code Context</span>
                {codeCtxLoading && (
                  <svg
                    className={styles.spinner}
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="3"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                )}
                <span className={styles.codeCtxChevron}>
                  {codeCtxOpen ? "▲" : "▼"}
                </span>
              </div>
              {codeCtxOpen && (
                <div className={styles.codeCtxBody}>
                  {codeCtxLoading && (
                    <div className={styles.codeCtxNote}>
                      <svg
                        className={styles.spinner}
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      AI is analysing ticket and searching repositories…
                    </div>
                  )}
                  {!codeCtxLoading && codeCtx && !codeCtx.connected && (
                    <div className={styles.codeCtxNoAccess}>
                      <RiGitMergeLine size={18} color="var(--text-3)" />
                      <span className={styles.codeCtxNoAccessTitle}>
                        Cannot reach repository
                      </span>
                    </div>
                  )}
                  {!codeCtxLoading && codeCtx?.connected && (
                    <>
                      {codeCtx.search_terms &&
                        codeCtx.search_terms.length > 0 && (
                          <div className={styles.codeCtxNote}>
                            <RiSparklingLine size={9} color="var(--accent)" />
                            AI searched: {codeCtx.search_terms.join(", ")}
                          </div>
                        )}
                      {codeCtx.files.length > 0 && (
                        <div className={styles.codeCtxSection}>
                          <div className={styles.codeCtxSectionTitle}>
                            <RiCodeSSlashLine size={11} /> Related files
                          </div>
                          {codeCtx.files.map((f) => (
                            <a
                              key={f.url}
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.codeFile}
                              style={{ textDecoration: "none" }}
                            >
                              <span className={styles.codeFilePath}>
                                {f.path}
                              </span>
                              <span className={styles.codeFileReason}>
                                {f.repo ?? "↗"}
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                      {codeCtx.prs.length > 0 && (
                        <div className={styles.codeCtxSection}>
                          <div className={styles.codeCtxSectionTitle}>
                            <RiGitMergeLine size={11} /> Related PRs
                          </div>
                          {codeCtx.prs.map((pr) => (
                            <a
                              key={pr.url}
                              href={pr.url}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.codePr}
                              style={{ textDecoration: "none" }}
                            >
                              <span className={styles.codePrKey}>
                                {pr.number}
                              </span>
                              <span className={styles.codePrTitle}>
                                {pr.title}
                              </span>
                              <span
                                className={`${styles.codePrStatus} ${pr.status === "merged" ? styles.codePrMerged : styles.codePrOpen}`}
                              >
                                {pr.status}
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                      {codeCtx.files.length === 0 &&
                        codeCtx.prs.length === 0 && (
                          <div className={styles.codeCtxNote}>
                            No related files or PRs found across configured
                            repositories.
                          </div>
                        )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Classification (Type / Priority / Status) ── */}
          <div className={styles.classificationCard}>
            <div className={styles.classificationGrid}>
              <FormControl size="small" fullWidth disabled={readOnly}>
                <InputLabel>Type</InputLabel>
                <Select
                  label="Type"
                  value={form.issue_type}
                  onChange={(e) => set("issue_type", e.target.value)}
                  renderValue={(v) => {
                    const t =
                      ISSUE_TYPES?.find((x) => x.value === v)! ??
                      ISSUE_TYPES[1];
                    return (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          color: "var(--text)",
                        }}
                      >
                        <span style={{ color: t.color, display: "flex" }}>
                          {t.icon}
                        </span>
                        {t.label}
                      </span>
                    );
                  }}
                >
                  {ISSUE_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                        }}
                      >
                        <span style={{ color: t.color, display: "flex" }}>
                          {t.icon}
                        </span>
                        {t.label}
                      </span>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth disabled={readOnly}>
                <InputLabel>Priority</InputLabel>
                <Select
                  label="Priority"
                  value={form.priority}
                  onChange={(e) => set("priority", e.target.value)}
                  renderValue={(v) => {
                    const p = PRIORITIES.find((x) => x.value === v)!;
                    return (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          color: "var(--text)",
                        }}
                      >
                        <span style={{ color: p?.color, display: "flex" }}>
                          {p?.icon}
                        </span>
                        {p?.label}
                      </span>
                    );
                  }}
                >
                  {PRIORITIES.map((p) => (
                    <MenuItem key={p.value} value={p.value}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                        }}
                      >
                        <span style={{ color: p?.color, display: "flex" }}>
                          {p.icon}
                        </span>
                        {p.label}
                      </span>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth disabled={readOnly}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                  renderValue={(v) => {
                    const s = STATUSES.find((x) => x.value === v)!;
                    return (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          color: "var(--text)",
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: s?.color,
                          }}
                        />
                        {s?.label}
                      </span>
                    );
                  }}
                >
                  {STATUSES.map((s) => (
                    <MenuItem key={s.value} value={s.value}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: s.color,
                          }}
                        />
                        {s.label}
                      </span>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className={styles.tabRoot}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab label="Details" />
              <Tab label="Links" />
              <Tab label="Time & Files" />
              {isEdit && (
                <Tab
                  label={`Comments${comments.length > 0 ? ` (${comments.length})` : ""}`}
                />
              )}
              {isEdit && <Tab label="Activity" />}
              {isEdit && (
                <Tab
                  label={`Worklogs${(ticketDetail?.worklogs?.length ?? 0) > 0 ? ` (${ticketDetail!.worklogs!.length})` : ""}`}
                />
              )}
            </Tabs>
          </div>

          {/* ── Tab: Details ── */}
          {tab === 0 && (
            <div className={styles.tabPanel}>
              <div className={styles.detailsCard}>
                {/* Intelligent routing suggestion */}
                {!isEdit && !readOnly && (routingLoading || routingSuggestion) && !form.assignee && (
                  <div className={styles.routingCard}>
                    <RiSparklingLine size={13} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
                    {routingLoading ? (
                      <span className={styles.routingText} style={{ color: "var(--text-3)" }}>
                        EOS is finding the best assignee…
                      </span>
                    ) : routingSuggestion ? (
                      <>
                        <div className={styles.routingBody}>
                          <span className={styles.routingText}>
                            Assign to <strong>{routingSuggestion.assignee}</strong> — {routingSuggestion.reason}
                          </span>
                        </div>
                        <button
                          type="button"
                          className={styles.routingAccept}
                          onClick={() => {
                            set("assignee", routingSuggestion.assignee);
                            setRoutingSuggestion(null);
                            setRoutingDismissed(true);
                          }}
                        >
                          Assign
                        </button>
                        <button
                          type="button"
                          className={styles.routingDismiss}
                          onClick={() => {
                            setRoutingSuggestion(null);
                            setRoutingDismissed(true);
                          }}
                          title="Dismiss"
                        >
                          ✕
                        </button>
                      </>
                    ) : null}
                  </div>
                )}

                {/* Assignee + Reporter */}
                <div className={styles.formRow}>
                  <Autocomplete
                    options={users}
                    value={form.assignee ?? null}
                    onChange={(_, v) => set("assignee", v ?? undefined)}
                    size="small"
                    fullWidth
                    disabled={readOnly}
                    renderInput={(params) => (
                      <TextField {...params} label="Assignee" />
                    )}
                    sx={{ "& .MuiOutlinedInput-root": { fontSize: 13 } }}
                  />
                  <Autocomplete
                    options={users}
                    value={form.reporter || null}
                    onChange={(_, v) =>
                      set("reporter", typeof v === "string" ? v : "")
                    }
                    onInputChange={(_, v, reason) => {
                      if (reason === "input") set("reporter", v);
                    }}
                    freeSolo
                    size="small"
                    fullWidth
                    disabled={readOnly}
                    renderInput={(params) => (
                      <TextField {...params} label="Reporter" />
                    )}
                    sx={{ "& .MuiOutlinedInput-root": { fontSize: 13 } }}
                  />
                </div>

                {/* Story Points + Due Date */}
                <div className={styles.formRow}>
                  <FormControl size="small" fullWidth disabled={readOnly}>
                    <InputLabel>Story Points</InputLabel>
                    <Select
                      label="Story Points"
                      value={form.story_points ?? ""}
                      onChange={(e) =>
                        set(
                          "story_points",
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {STORY_POINTS.map((p) => (
                        <MenuItem key={p} value={p}>
                          {p}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    type="date"
                    label="Due Date"
                    size="small"
                    fullWidth
                    value={form.due_date ?? ""}
                    onChange={(e) =>
                      set("due_date", e.target.value || undefined)
                    }
                    InputLabelProps={{ shrink: true }}
                    disabled={readOnly}
                  />
                </div>

                {/* ── Story Point Estimation Callout ── */}
                {!readOnly &&
                  !form.story_points &&
                  (storyAiLoading || storyEstimate) && (
                    <div className={styles.storyEstCard}>
                      {storyAiLoading ? (
                        <div className={styles.storyEstLeft}>
                          <svg
                            className={styles.spinner}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="var(--accent)"
                            strokeWidth="3"
                          >
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                          <span className={styles.storyEstMeta}>
                            EOS estimating story points…
                          </span>
                        </div>
                      ) : storyEstimate ? (
                        <>
                          <div className={styles.storyEstLeft}>
                            <RiSparklingLine
                              size={15}
                              className={styles.storyEstIcon}
                            />
                            <div>
                              <span className={styles.storyEstTitle}>
                                EOS estimates {storyEstimate.min}–
                                {storyEstimate.max} story points
                              </span>
                              <span className={styles.storyEstMeta}>
                                {storyEstimate.reasoning ??
                                  `Confidence ${Math.round(storyEstimate.confidence * 100)}%`}
                              </span>
                            </div>
                          </div>
                          <div className={styles.storyEstActions}>
                            <button
                              className={styles.storyEstAccept}
                              onClick={() => {
                                set("story_points", storyEstimate.max);
                                setStoryEstimate(null);
                              }}
                            >
                              Accept {storyEstimate.max} pts
                            </button>
                            <button
                              className={styles.storyEstDismiss}
                              onClick={() => setStoryEstimate(null)}
                            >
                              ✕
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}

                {/* POD + Client */}
                <div className={styles.formRow}>
                  {/* Hide POD selector when it's auto-set from the current space context */}
                  {!defaultPod || isEdit ? (
                    <FormControl size="small" fullWidth disabled={readOnly}>
                      <InputLabel>POD</InputLabel>
                      <Select
                        label="POD"
                        value={form.pod ?? ""}
                        onChange={(e) =>
                          set("pod", e.target.value || undefined)
                        }
                      >
                        <MenuItem value="">
                          <em>None</em>
                        </MenuItem>
                        {pods.map((p) => (
                          <MenuItem key={p} value={p}>
                            {p}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "var(--text-2)",
                        padding: "6px 0",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "var(--accent)" }}>
                        POD:
                      </span>
                      <span
                        style={{
                          background: "var(--accent-glow)",
                          border: "1px solid var(--accent-border)",
                          color: "var(--accent)",
                          borderRadius: 6,
                          padding: "2px 8px",
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        {defaultPod}
                      </span>
                    </div>
                  )}
                  <FormControl size="small" fullWidth disabled={readOnly}>
                    <InputLabel>Client</InputLabel>
                    <Select
                      label="Client"
                      value={form.client ?? ""}
                      onChange={(e) =>
                        set("client", e.target.value || undefined)
                      }
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {clients.map((c) => (
                        <MenuItem key={c} value={c}>
                          {c}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>

                {/* Labels */}
                <div>
                  <div className={styles.sectionTitle}>Labels</div>
                  <div className={styles.labelsBox}>
                    {(form.labels ?? []).map((l) => (
                      <span key={l} className={styles.labelTag}>
                        {l}
                        {!readOnly && (
                          <button
                            className={styles.labelRemove}
                            onClick={() =>
                              set(
                                "labels",
                                (form.labels ?? []).filter((x) => x !== l),
                              )
                            }
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    ))}
                    {!readOnly && (
                      <input
                        className={styles.labelInput}
                        placeholder="Type and press Enter…"
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                        onKeyDown={addLabel}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Links ── */}
          {tab === 1 && (
            <div className={styles.tabPanel}>
              {/* Epic + Parent */}
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Epic Link</label>
                  <input
                    className={styles.textInput}
                    placeholder="e.g. DPAI-100"
                    value={form.epic}
                    onChange={(e) => set("epic", e.target.value)}
                    readOnly={readOnly}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Parent Issue</label>
                  <input
                    className={styles.textInput}
                    placeholder="e.g. DPAI-50"
                    value={form.parent}
                    onChange={(e) => set("parent", e.target.value)}
                    readOnly={readOnly}
                  />
                </div>
              </div>

              {/* Linked Issues */}
              <div>
                <div className={styles.sectionTitle}>Linked Issues</div>
                {form.linkedIssues.map((lnk, i) => (
                  <div key={i} className={styles.linkItem}>
                    <RiLink size={13} color="var(--text-3)" />
                    <span className={styles.linkType}>{lnk.type}</span>
                    <span className={styles.linkKey}>{lnk.key}</span>
                    {!readOnly && (
                      <button
                        className={styles.linkDelete}
                        onClick={() => removeLink(i)}
                      >
                        <RiDeleteBinLine size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <div className={styles.linkAddRow}>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <Select
                        value={newLinkType}
                        onChange={(e) => setNewLinkType(e.target.value)}
                      >
                        {LINK_TYPES.map((t) => (
                          <MenuItem key={t} value={t}>
                            {t}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <input
                      className={styles.textInput}
                      placeholder="Ticket key…"
                      value={newLinkKey}
                      onChange={(e) => setNewLinkKey(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addLink()}
                    />
                    <button className={styles.iconBtn} onClick={addLink}>
                      <RiAddLine size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Time & Files ── */}
          {tab === 2 && (
            <div className={styles.tabPanel}>
              {/* Time fields */}
              <div>
                <div className={styles.sectionHeader}>
                  <RiTimeLine size={14} color="var(--text-3)" />
                  <span className={styles.sectionHeaderText}>
                    Time Tracking
                  </span>
                </div>
                <div className={styles.formRow3}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Original Est.</label>
                    <input
                      className={styles.textInput}
                      placeholder="e.g. 2h 30m"
                      value={form.originalEst}
                      onChange={(e) => set("originalEst", e.target.value)}
                      readOnly={readOnly}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Time Spent</label>
                    <input
                      className={styles.textInput}
                      placeholder="e.g. 1h"
                      value={form.timeSpent}
                      onChange={(e) => set("timeSpent", e.target.value)}
                      readOnly={readOnly}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Remaining</label>
                    <input
                      className={styles.textInput}
                      placeholder="e.g. 1h 30m"
                      value={form.remaining}
                      onChange={(e) => set("remaining", e.target.value)}
                      readOnly={readOnly}
                    />
                  </div>
                </div>
              </div>

              {/* Attachments */}
              <div>
                <div className={styles.sectionHeader}>
                  <RiAttachmentLine size={14} color="var(--text-3)" />
                  <span className={styles.sectionHeaderText}>Attachments</span>
                </div>

                {!readOnly && (
                  <div
                    className={styles.dropZone}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleFiles(e.dataTransfer.files);
                    }}
                  >
                    <RiAttachmentLine size={24} color="var(--text-3)" />
                    <div className={styles.dropZoneText}>
                      Drop files here or{" "}
                      <span className={styles.dropZoneAccent}>browse</span>
                    </div>
                    <div className={styles.dropZoneHint}>
                      Max 25 MB per file
                    </div>
                  </div>
                )}
                {!readOnly && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                )}

                {/* Server-side attachments (edit mode) */}
                {serverAttachments.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                    {serverAttachments.map((a) => (
                      <div key={a.id} className={styles.fileItem}>
                        <RiAttachmentLine size={14} color="var(--text-3)" />
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.fileName}
                          style={{ textDecoration: "none", color: "var(--accent)" }}
                        >
                          {a.filename}
                        </a>
                        <span className={styles.fileSize}>
                          {a.size ? `${(a.size / 1024).toFixed(0)} KB` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Locally staged (not yet uploaded) */}
                {form.attachments.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    {form.attachments.map((f, i) => (
                      <div key={i} className={styles.fileItem}>
                        <RiAttachmentLine size={14} color="var(--text-3)" />
                        <span className={styles.fileName}>{f.name}</span>
                        <span className={styles.fileSize}>
                          {(f.size / 1024).toFixed(0)} KB
                        </span>
                        {!readOnly && (
                          <button
                            className={styles.linkDelete}
                            onClick={() => removeAttachment(i)}
                          >
                            <RiDeleteBinLine size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Comments ── */}
          {tab === 3 && isEdit && (
            <div className={styles.tabPanel}>
              <div className={styles.commentsList}>
                {topLevelComments.length === 0 && (
                  <p className={styles.emptyHint}>
                    No comments yet. Be the first!
                  </p>
                )}
                {topLevelComments.map((c) => (
                  <div key={c.id} className={styles.commentItem}>
                    <div className={styles.commentAvatar}>
                      {c.author
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className={styles.commentBody}>
                      <div className={styles.commentMeta}>
                        <span className={styles.commentAuthor}>{c.author}</span>
                        <span className={styles.commentDate}>
                          {formatDate(c.created_at, "MMM d, yyyy")}
                        </span>
                        <button
                          className={styles.commentAction}
                          onClick={() => setReplyTo(c.id)}
                        >
                          Reply
                        </button>
                        <button
                          className={styles.commentAction}
                          onClick={() => deleteCmtMut.mutate(c.id)}
                        >
                          Delete
                        </button>
                      </div>
                      <p className={styles.commentText}>{c.content}</p>
                      {repliesFor(c.id).map((r) => (
                        <div key={r.id} className={styles.replyItem}>
                          <div
                            className={styles.commentAvatar}
                            style={{ width: 24, height: 24, fontSize: 10 }}
                          >
                            {r.author
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className={styles.commentBody}>
                            <div className={styles.commentMeta}>
                              <span className={styles.commentAuthor}>
                                {r.author}
                              </span>
                              <span className={styles.commentDate}>
                                {formatDate(r.created_at, "MMM d, yyyy")}
                              </span>
                            </div>
                            <p className={styles.commentText}>{r.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.commentCompose}>
                {replyTo && (
                  <div className={styles.replyIndicator}>
                    Replying to comment #{replyTo}
                    <button
                      className={styles.cancelReply}
                      onClick={() => setReplyTo(null)}
                    >
                      ✕
                    </button>
                  </div>
                )}
                <textarea
                  className={`${styles.textInput} ${styles.textArea}`}
                  placeholder="Write a comment…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 8,
                  }}
                >
                  <button
                    className={styles.btnPrimary}
                    disabled={!commentText.trim() || commentMut.isPending}
                    onClick={() =>
                      commentMut.mutate({
                        content: commentText,
                        parentId: replyTo ?? undefined,
                      })
                    }
                    style={{ padding: "7px 16px", fontSize: 12 }}
                  >
                    {commentMut.isPending ? "Posting…" : "Post Comment"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Activity ── */}
          {tab === 4 && isEdit && (
            <div className={styles.tabPanel}>
              {activity.length === 0 && (
                <p className={styles.emptyHint}>No activity recorded yet.</p>
              )}
              <div className={styles.timeline}>
                {activity.map((a) => (
                  <div
                    key={`${a.id}-${a.created_at}`}
                    className={styles.activityEntry}
                  >
                    <div className={styles.activityIcon}>
                      {getActivityIcon(a.action)}
                    </div>
                    <div className={styles.activityContent}>
                      <span className={styles.activityActor}>{a.actor}</span>{" "}
                      {getActivityText(a)}
                      <span className={styles.activityTime}>
                        {" "}
                        · {formatDate(a.created_at, "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab: Worklogs ── */}
          {tab === 5 && isEdit && (
            <div className={styles.tabPanel}>
              <div className={styles.worklogForm}>
                <div className={styles.formRow3}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Hours *</label>
                    <input
                      className={styles.textInput}
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="e.g. 2.5"
                      value={wlHours}
                      onChange={(e) => setWlHours(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Date</label>
                    <input
                      className={styles.textInput}
                      type="date"
                      value={wlDate}
                      onChange={(e) => setWlDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>
                    Comment (optional)
                  </label>
                  <input
                    className={styles.textInput}
                    placeholder="What did you work on?"
                    value={wlComment}
                    onChange={(e) => setWlComment(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className={styles.btnPrimary}
                    onClick={handleLogTime}
                    disabled={logTimeMut.isPending}
                    style={{ padding: "7px 16px", fontSize: 12 }}
                  >
                    {logTimeMut.isPending ? "Logging…" : "+ Log Time"}
                  </button>
                </div>
              </div>

              <div className={styles.worklogList}>
                {(ticketDetail?.worklogs ?? []).length === 0 && (
                  <p className={styles.emptyHint}>No time logged yet.</p>
                )}
                {(ticketDetail?.worklogs ?? [])
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime(),
                  )
                  .map((wl, idx) => (
                    <div key={idx} className={styles.worklogItem}>
                      <div className={styles.worklogHeader}>
                        <span className={styles.worklogAuthor}>
                          {wl.author}
                        </span>
                        <span className={styles.worklogDate}>
                          {formatDate(wl.date, "MMM d, yyyy")}
                        </span>
                        <span className={styles.worklogHours}>{wl.hours}h</span>
                      </div>
                      {wl.comment && (
                        <div className={styles.worklogComment}>
                          {wl.comment}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
        {/* end rightColumn */}
      </div>
      {/* end twoColumnLayout */}
    </SideDrawer>
  );
}

/* ── Activity helpers ── */
function getActivityIcon(action: string): string {
  const map: Record<string, string> = {
    created: "🆕",
    updated: "✏️",
    changed: "📝",
    assigned: "👤",
    "logged time": "⏱️",
    commented: "💬",
    deleted: "🗑️",
    moved: "➡️",
    transitioned: "➡️",
  };
  for (const key of Object.keys(map)) {
    if (action.toLowerCase().includes(key)) return map[key];
  }
  return "•";
}

function getActivityText(entry: TicketActivity): string {
  if (entry.action === "logged time")
    return `logged ${entry.field || "time"}${entry.new_value ? ` — "${entry.new_value}"` : ""}`;
  if (entry.action === "created") return `created this ticket`;
  if (entry.field) {
    let txt = `${entry.action} ${entry.field}`;
    if (entry.old_value) txt += ` from "${entry.old_value}"`;
    if (entry.new_value) txt += ` to "${entry.new_value}"`;
    return txt;
  }
  return entry.action;
}
