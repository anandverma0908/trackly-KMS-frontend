import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  createTicket,
  updateTicket,
  analyzeTicketNL,
  novaGenerate,
  fetchFilters,
  fetchTicketComments,
  createComment,
  editComment,
  deleteComment,
  fetchTicketActivity,
  logTime,
  fetchTicket,
  fetchTicketCodeContext,
  uploadAttachment,
  fetchTicketAttachments,
  fetchTicketWorklogs,
  fetchTicketLinks,
  createTicketLink,
  deleteTicketLink,
  searchTickets,
  fetchPodEpics,
  fetchPodStories,
  fetchReleases,
  type CodeContextResult,
} from "@/services/api";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/useAuthStore";
import { QUERY_KEYS } from "@/config/queryKeys";
import SideDrawer from "@/components/ui/SideDrawer";
import { formatDate } from "@/utils/formatters";
import type {
  TicketCreate,
  NLAnalysisResult,
  // (unused types removed)
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
  RiCheckLine,
  RiAttachmentLine,
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
  RiAlertLine,
  RiCodeSSlashLine,
  RiGitMergeLine,
  RiImageLine,
  RiFileLine,
  RiVideoLine,
  RiExternalLinkLine,
} from "react-icons/ri";

/* ── Layer inference ── */
type CodeLayer = "frontend" | "backend" | "unknown";

function inferLayer(repo: string | undefined, path: string): CodeLayer {
  const r = (repo ?? "").toLowerCase();
  if (/front|^fe[-_]|\bweb\b|client|ui/.test(r)) return "frontend";
  if (/back|^be[-_]|\bapi\b|\bserver\b|service/.test(r)) return "backend";
  if (/\.(tsx|jsx)$/.test(path)) return "frontend";
  if (/\/(components|features|pages|hooks|views)\//.test(path)) return "frontend";
  if (/\.(py|go|java|rb|php|rs)$/.test(path)) return "backend";
  if (/\/(routes|models|controllers|migrations|db)\//.test(path)) return "backend";
  if (/\/services\/api\.ts/.test(path)) return "backend";
  if (/\.(ts)$/.test(path)) return "frontend";
  return "unknown";
}

const LAYER_META: Record<CodeLayer, { label: string; short: string; bg: string; color: string }> = {
  frontend: { label: "Frontend",  short: "FE", bg: "rgba(79,126,255,0.10)", color: "var(--accent)" },
  backend:  { label: "Backend",   short: "BE", bg: "rgba(52,211,153,0.10)", color: "var(--green, #34D399)" },
  unknown:  { label: "Unknown",   short: "?",  bg: "var(--surface-2)",      color: "var(--text-3)" },
};

function layerFromDiagnosis(likely_layer?: string): CodeLayer {
  const l = (likely_layer ?? "").toLowerCase();
  if (l.includes("front") || l === "fe") return "frontend";
  if (l.includes("back") || l === "be") return "backend";
  return "unknown";
}

/* ── Config ── */
const ISSUE_TYPES = [
  { value: "Story",       label: "Story",       color: "#4F7EFF", icon: <RiBookmarkLine size={14} /> },
  { value: "Bug",         label: "Bug",         color: "#F87171", icon: <RiBugLine size={14} /> },
  { value: "Task",        label: "Task",        color: "#A78BFA", icon: <RiCheckboxLine size={14} /> },
  { value: "Epic",        label: "Epic",        color: "#FBBF24", icon: <RiFlashlightLine size={14} /> },
  { value: "Subtask",     label: "Subtask",     color: "#94A3B8", icon: <RiCornerDownRightLine size={14} /> },
  { value: "Improvement", label: "Improvement", color: "#34D399", icon: <RiArrowUpLine size={14} /> },
];

const PRIORITIES = [
  { value: "Highest", label: "Highest", color: "#F87171", icon: <RiArrowUpDoubleLine size={14} /> },
  { value: "High",    label: "High",    color: "#FB923C", icon: <RiArrowUpSLine size={14} /> },
  { value: "Medium",  label: "Medium",  color: "#FBBF24", icon: <RiDragMoveLine size={14} /> },
  { value: "Low",     label: "Low",     color: "#94A3B8", icon: <RiArrowDownSLine size={14} /> },
  { value: "Lowest",  label: "Lowest",  color: "#64748B", icon: <RiArrowDownDoubleLine size={14} /> },
];

const STATUSES = [
  { value: "To Do",      label: "To Do",      color: "#64748B" },
  { value: "In Progress",label: "In Progress", color: "#FBBF24" },
  { value: "In Review",  label: "In Review",   color: "#A78BFA" },
  { value: "Blocked",    label: "Blocked",     color: "#F87171" },
  { value: "Done",       label: "Done",        color: "#34D399" },
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

interface StoryEstimate {
  min: number;
  max: number;
  confidence: number;
  basedOn: number;
  reasoning?: string;
}

interface RoutingSuggestion {
  assignee: string;
  reason: string;
}

function extractJSON(raw: string): Record<string, string> | null {
  if (!raw) return null;
  // Strip markdown code fences
  const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  // Try direct parse first
  try { return JSON.parse(clean); } catch {}
  // Extract outermost JSON object
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

function uniqueValues(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function nearestStoryPoint(value: number): number {
  return STORY_POINTS.reduce((closest, point) =>
    Math.abs(point - value) < Math.abs(closest - value) ? point : closest,
  STORY_POINTS[0]);
}

function buildStoryEstimateFromAnalysis(result: NLAnalysisResult): StoryEstimate | null {
  if (!result.story_points) return null;
  const suggested = nearestStoryPoint(result.story_points);
  const index = STORY_POINTS.indexOf(suggested);
  return {
    min: STORY_POINTS[Math.max(0, index - 1)],
    max: suggested,
    confidence: Math.max(0.55, result.confidence ?? 0.72),
    basedOn: result.duplicates?.length ?? 0,
    reasoning: "Based on EOS ticket analysis of the title, description, and similar tickets.",
  };
}

function buildHeuristicStoryEstimate(form: Pick<FormState, "title" | "description" | "issue_type" | "priority">): StoryEstimate | null {
  const text = `${form.title} ${form.description}`.toLowerCase();
  if (text.trim().length < 4) return null;

  let index = Math.max(0, STORY_POINTS.indexOf(
    form.issue_type === "Epic" ? 13 :
    form.issue_type === "Story" ? 3 :
    form.issue_type === "Bug" ? 2 :
    form.issue_type === "Subtask" ? 1 : 2,
  ));

  const complexitySignals = [
    "migration", "refactor", "multi-step", "multi step", "integration", "permissions",
    "authentication", "authorization", "dashboard", "workflow", "analytics", "backend",
    "frontend", "schema", "incident", "performance", "regression", "api",
  ];
  const signalHits = complexitySignals.filter((signal) => text.includes(signal)).length;
  index = Math.min(STORY_POINTS.length - 1, index + Math.min(2, Math.floor(signalHits / 2)));

  if (form.priority === "Highest") index = Math.min(STORY_POINTS.length - 1, index + 1);
  if (text.length < 60) index = Math.max(0, index - 1);

  const point = STORY_POINTS[index];
  return {
    min: STORY_POINTS[Math.max(0, index - 1)],
    max: point,
    confidence: 0.58,
    basedOn: signalHits,
    reasoning: "Estimated from ticket type, complexity keywords, and the amount of implementation detail provided.",
  };
}

function buildRoutingSuggestionFromAnalysis(result: NLAnalysisResult, candidates: string[]): RoutingSuggestion | null {
  if (!result.assignee) return null;
  const matched = candidates.find((candidate) => candidate === result.assignee);
  if (!matched) return null;
  return {
    assignee: matched,
    reason: "EOS matched this ticket to the available team list from the ticket analysis.",
  };
}

function buildRoleAwareRoutingSuggestion(
  form: Pick<FormState, "title" | "description" | "issue_type">,
  members: ProjectMember[],
): RoutingSuggestion | null {
  if (members.length === 0) return null;
  const text = `${form.title} ${form.description}`.toLowerCase();
  if (text.trim().length < 16) return null;

  const ROLE_KEYWORDS: Array<{ match: RegExp; role: RegExp; reason: string }> = [
    { match: /(ui|ux|screen|page|drawer|modal|react|frontend|layout|component|dropdown|form)/i, role: /(frontend|ui|ux)/i, reason: "The ticket reads like frontend/UI work." },
    { match: /(api|backend|service|database|sql|query|auth|permission|endpoint|server)/i, role: /(backend|api|server|platform)/i, reason: "The ticket points to backend or service-layer work." },
    { match: /(deploy|pipeline|infra|incident|production|sre|devops|monitor|ops)/i, role: /(devops|sre|platform)/i, reason: "The issue looks operational and best suited for platform/DevOps ownership." },
    { match: /(test|qa|regression|repro|verification)/i, role: /(qa|quality)/i, reason: "The issue centers on validation and regression coverage." },
  ];

  for (const rule of ROLE_KEYWORDS) {
    if (!rule.match.test(text)) continue;
    const member = members.find((candidate) => rule.role.test(candidate.role));
    if (member) {
      return { assignee: member.name, reason: rule.reason };
    }
  }

  return null;
}

/* ── Types ── */
interface FormState extends TicketCreate {
  status: string;
  reporter: string;
  epic: string;
  parent: string;
  originalEst: string;
  timeSpent: string;
  remaining: string;
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
  onCreated?: (data: Partial<FormState>) => void;
  onSuccess?: () => void;
  ticketKey?: string;
  initialData?: Partial<FormState>;
  readOnly?: boolean;
}

/* ── Attachment helpers ── */
function isImage(filename: string) {
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(filename);
}
function isVideo(filename: string) {
  return /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(filename);
}
function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const navigate = useNavigate();

  // Stabilize members reference — default `[]` in function params creates a new array on every
  // render, which would cause the EOS analysis useEffect to fire on every render.
  const stableMembers = useMemo(
    () => members,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members.map((m) => `${m.name}:${m.role}`).join(",")],
  );

  const DEFAULT_CLIENTS = [
    "Colgate", "Jockey", "SAAS", "BSV", "ReckittBenckiser", "Henkel", "Unilever",
  ];

  /* EOS Form */
  const [eosFormLoading, setEosFormLoading] = useState(false);

  /* Live duplicate detection + story estimation */
  const [liveDupes, setLiveDupes] = useState<{ key: string; summary: string; similarity: number; ai?: boolean }[]>([]);
  const [aiDupeScanning, setAiDupeScanning] = useState(false);
  const [dupeScanDone, setDupeScanDone] = useState(false);
  const [storyEstimate, setStoryEstimate] = useState<StoryEstimate | null>(null);
  const [storyAiLoading, setStoryAiLoading] = useState(false);
  const aiDupeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Intelligent routing */
  const [routingSuggestion, setRoutingSuggestion] = useState<RoutingSuggestion | null>(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingDismissed, setRoutingDismissed] = useState(false);

  /* Code-Aware Context */
  const [codeCtxOpen, setCodeCtxOpen] = useState(true);
  const [codeCtx, setCodeCtx] = useState<CodeContextResult | null>(null);
  const [codeCtxLoading, setCodeCtxLoading] = useState(false);

  /* Tabs */
  const [tab, setTab] = useState(0);

  /* Label input */
  const [labelInput, setLabelInput] = useState("");

  /* Links */
  const [newLinkType, setNewLinkType] = useState(LINK_TYPES[0]);
  const [newLinkKey, setNewLinkKey] = useState("");
  const [linkSuggestions, setLinkSuggestions] = useState<{ key: string; summary: string }[]>([]);
  const linkSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Staged links for create mode (persisted to API after ticket creation)
  const [stagedLinks, setStagedLinks] = useState<{ type: string; key: string; summary?: string }[]>([]);

  /* Comments (edit mode only) */
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  /* Worklogs (edit mode only) */
  const [wlHours, setWlHours] = useState("");
  const [wlComment, setWlComment] = useState("");
  const [wlDate, setWlDate] = useState(new Date().toISOString().split("T")[0]);

  /* File drag */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Lightbox */
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  /* Track whether this open-session has been initialized */
  const hasInitialized = useRef(false);

  /* Hierarchy search */
  const [parentSearch, setParentSearch] = useState("");

  /* Form */
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    issue_type: "Task",
    priority: "Medium",
    status: defaultStatus,
    reporter: user?.name ?? "",
    epic: "",
    parent: "",
    originalEst: "",
    timeSpent: "",
    remaining: "",
    attachments: [],
    labels: [],
    epic_key: undefined,
    parent_key: undefined,
    fix_version: undefined,
  });

  const isEdit = Boolean(ticketKey);
  const codeCtxTitle = form.title.trim();
  const codeCtxDescription = form.description.trim();
  const canFetchCodeCtx = isEdit && !!ticketKey && (!!codeCtxTitle || !!codeCtxDescription);
  const { data: detailedTicket } = useQuery({
    queryKey: ["ticket", ticketKey],
    queryFn: () => fetchTicket(ticketKey!),
    enabled: isEdit,
  });

  const activePod = form.pod ?? defaultPod ?? "";
  const { data: podEpics = [] } = useQuery({
    queryKey: ["pod-epics", activePod],
    queryFn: () => fetchPodEpics(activePod),
    enabled: !!activePod && open,
  });
  const { data: podParents = [] } = useQuery({
    queryKey: ["pod-stories", activePod, parentSearch],
    queryFn: () => fetchPodStories(activePod, parentSearch || undefined),
    enabled: !!activePod && open,
    placeholderData: (prev) => prev,
  });
  const { data: podReleases = [] } = useQuery({
    queryKey: ["releases", activePod],
    queryFn: () => fetchReleases(activePod),
    enabled: !!activePod && open,
  });

  // Populate form exactly once per open-session
  useEffect(() => {
    if (!open) {
      hasInitialized.current = false;
      setCodeCtx(null);
      setCodeCtxLoading(false);
      return;
    }
    if (hasInitialized.current) return;

    const hydratedReporter = initialData?.reporter || detailedTicket?.reporter || (isEdit ? "" : user?.name || "");

    if (isEdit && (initialData || detailedTicket)) {
      hasInitialized.current = true;
      setForm({
        title: initialData?.title || detailedTicket?.summary || initialData?.description?.slice(0, 80) || "",
        description: initialData?.description || detailedTicket?.description || "",
        issue_type: initialData?.issue_type || detailedTicket?.issue_type || "Task",
        priority: initialData?.priority || detailedTicket?.priority || "Medium",
        status: initialData?.status || detailedTicket?.status || defaultStatus,
        reporter: hydratedReporter,
        epic: initialData?.epic || "",
        parent: initialData?.parent || "",
        originalEst: initialData?.originalEst || ((detailedTicket as any)?.original_estimate_hours ? String((detailedTicket as any).original_estimate_hours) : ""),
        timeSpent: initialData?.timeSpent || (detailedTicket?.hours_spent ? String(detailedTicket.hours_spent) : ""),
        remaining: initialData?.remaining || ((detailedTicket as any)?.remaining_estimate_hours ? String((detailedTicket as any).remaining_estimate_hours) : ""),
        attachments: [],
        labels: initialData?.labels || detailedTicket?.labels || [],
        assignee: initialData?.assignee ?? detailedTicket?.assignee,
        pod: initialData?.pod ?? detailedTicket?.pod ?? defaultPod,
        client: initialData?.client ?? detailedTicket?.client,
        story_points: initialData?.story_points ?? detailedTicket?.story_points,
        due_date: initialData?.due_date ?? detailedTicket?.due_date,
        epic_key: (detailedTicket as any)?.epic_key ?? undefined,
        parent_key: (detailedTicket as any)?.parent_key ?? undefined,
        fix_version: (detailedTicket as any)?.fix_version ?? undefined,
      });
      setTab(0);
      setLabelInput("");
      setNewLinkType(LINK_TYPES[0]);
      setNewLinkKey("");
      setStagedLinks([]);
      setLinkSuggestions([]);
      setCommentText("");
      setReplyTo(null);
      setEditingCommentId(null);
      setEditingCommentText("");
      setWlHours("");
      setWlComment("");
      setWlDate(new Date().toISOString().split("T")[0]);
      setCodeCtx(null);
      setCodeCtxLoading(false);
    } else if (!isEdit) {
      hasInitialized.current = true;
      setForm({
        title: "",
        description: "",
        issue_type: "Task",
        priority: "Medium",
        status: defaultStatus,
        reporter: user?.name ?? "",
        epic: "",
        parent: "",
        originalEst: "",
        timeSpent: "",
        remaining: "",
        attachments: [],
        labels: [],
        pod: defaultPod,
        epic_key: undefined,
        parent_key: undefined,
        fix_version: undefined,
      });
      setTab(0);
      setLabelInput("");
      setNewLinkType(LINK_TYPES[0]);
      setNewLinkKey("");
      setStagedLinks([]);
      setLinkSuggestions([]);
      setCommentText("");
      setReplyTo(null);
      setEditingCommentId(null);
      setEditingCommentText("");
      setWlHours("");
      setWlComment("");
      setWlDate(new Date().toISOString().split("T")[0]);
      setCodeCtx(null);
      setCodeCtxLoading(false);
    }
  }, [open, defaultStatus, isEdit, initialData, detailedTicket, defaultPod, user?.name]);

  const set = (k: keyof FormState, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  /* Filters — declared before analysis effect so it's in scope as a dep */
  const { data: filtersData } = useQuery({
    queryKey: QUERY_KEYS.filters(),
    queryFn: fetchFilters,
  });

  /* Reset AI suggestion state when the drawer session changes */
  useEffect(() => {
    if (!open) {
      setLiveDupes([]);
      setAiDupeScanning(false);
      setDupeScanDone(false);
      setStoryEstimate(null);
      setStoryAiLoading(false);
      setRoutingSuggestion(null);
      setRoutingLoading(false);
      return;
    }
    setLiveDupes([]);
    setAiDupeScanning(false);
    setDupeScanDone(false);
    setStoryEstimate(null);
    setStoryAiLoading(false);
    setRoutingSuggestion(null);
    setRoutingLoading(false);
  }, [open, ticketKey]);

  /* EOS analysis for duplicates, story points, and assignee suggestions */
  useEffect(() => {
    const availableUsers = uniqueValues([
      ...stableMembers.map((member) => member.name),
      ...(filtersData?.users ?? []),
      form.assignee,
      detailedTicket?.assignee,
    ]);

    if (isEdit || form.title.length < 4) {
      // Use functional updates to avoid creating new array references when already empty,
      // which would otherwise trigger an infinite render loop.
      setLiveDupes((prev) => (prev.length === 0 ? prev : []));
      setDupeScanDone(false);
      setStoryEstimate(null);
      setRoutingSuggestion(null);
      setAiDupeScanning(false);
      setStoryAiLoading(false);
      setRoutingLoading(false);
      if (aiDupeRef.current) clearTimeout(aiDupeRef.current);
      return;
    }
    setAiDupeScanning(true);
    setStoryAiLoading(true);
    setRoutingLoading(availableUsers.length > 0 && !routingDismissed);
    if (aiDupeRef.current) clearTimeout(aiDupeRef.current);
    aiDupeRef.current = setTimeout(async () => {
      try {
        const text = [form.title, form.description].filter(Boolean).join(" ");
        const r = await analyzeTicketNL(text, availableUsers);
        setLiveDupes(r.duplicates?.length ? r.duplicates.map((d) => ({ ...d, ai: true })) : []);
        if (!form.story_points) {
          setStoryEstimate(buildStoryEstimateFromAnalysis(r) ?? buildHeuristicStoryEstimate(form));
        }
        if (!form.assignee && !routingDismissed) {
          setRoutingSuggestion(
            buildRoutingSuggestionFromAnalysis(r, availableUsers)
              ?? buildRoleAwareRoutingSuggestion(form, stableMembers),
          );
        }
      } catch {
        setLiveDupes((prev) => (prev.length === 0 ? prev : []));
        if (!form.story_points) setStoryEstimate(buildHeuristicStoryEstimate(form));
        if (!form.assignee && !routingDismissed) {
          setRoutingSuggestion(buildRoleAwareRoutingSuggestion(form, stableMembers));
        }
      } finally {
        setAiDupeScanning(false);
        setDupeScanDone(true);
        setStoryAiLoading(false);
        setRoutingLoading(false);
      }
    }, 600);
    return () => { if (aiDupeRef.current) clearTimeout(aiDupeRef.current); };
  }, [form.title, form.description, form.issue_type, form.priority, form.story_points, form.assignee, isEdit, stableMembers, routingDismissed, detailedTicket?.assignee]);

  /* Reset routing when drawer opens/closes */
  useEffect(() => {
    setRoutingSuggestion(null);
    setRoutingDismissed(false);
  }, [open]);

  /* Link key autocomplete */
  useEffect(() => {
    if (newLinkKey.length < 2) {
      setLinkSuggestions([]);
      return;
    }
    if (linkSearchRef.current) clearTimeout(linkSearchRef.current);
    linkSearchRef.current = setTimeout(async () => {
      try {
        const results = await searchTickets(newLinkKey);
        setLinkSuggestions(results);
      } catch {
        setLinkSuggestions([]);
      }
    }, 400);
    return () => { if (linkSearchRef.current) clearTimeout(linkSearchRef.current); };
  }, [newLinkKey]);

  /* Filters (users/clients derived here — query declared above analysis effect) */
  const users = uniqueValues([
    ...(filtersData?.users ?? []),
    ...stableMembers.map((m) => m.name),
    form.assignee,
    detailedTicket?.assignee,
  ]);
  const clients = uniqueValues([
    ...(filtersData?.clients?.length ? filtersData.clients : DEFAULT_CLIENTS),
    form.client,
    detailedTicket?.client,
  ]);

  /* Worklogs from API */
  const { data: serverWorklogs = [], refetch: refetchWorklogs } = useQuery({
    queryKey: ["ticket-worklogs", ticketKey],
    queryFn: () => fetchTicketWorklogs(ticketKey!),
    enabled: isEdit && !!ticketKey,
  });

  /* Links from API */
  const { data: serverLinks = [], refetch: refetchLinks } = useQuery({
    queryKey: ["ticket-links", ticketKey],
    queryFn: () => fetchTicketLinks(ticketKey!),
    enabled: isEdit && !!ticketKey,
  });

  /* Code context */
  useQuery({
    queryKey: ["ticket-code-ctx", ticketKey, codeCtxTitle, codeCtxDescription],
    queryFn: async () => {
      setCodeCtxLoading(true);
      try {
        const result = await fetchTicketCodeContext(ticketKey!, codeCtxTitle, codeCtxDescription);
        setCodeCtx(result);
        return result;
      } finally {
        setCodeCtxLoading(false);
      }
    },
    enabled: canFetchCodeCtx,
    staleTime: 5 * 60 * 1000,
  });

  /* Server-side attachments */
  const { data: serverAttachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ["ticket-attachments", ticketKey],
    queryFn: () => fetchTicketAttachments(ticketKey!),
    enabled: isEdit && !!ticketKey,
  });

  /* Comments */
  const { data: comments = [] } = useQuery({
    queryKey: ["ticket-comments", ticketKey],
    queryFn: () => fetchTicketComments(ticketKey!),
    enabled: isEdit && tab === 0,
  });

  /* Activity */
  const { data: serverActivity = [] } = useQuery({
    queryKey: ["ticket-activity", ticketKey],
    queryFn: () => fetchTicketActivity(ticketKey!),
    enabled: isEdit && tab === 1,
  });

  const commentMut = useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: string }) =>
      createComment(ticketKey!, content, parentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-comments", ticketKey] });
      qc.invalidateQueries({ queryKey: ["ticket-activity", ticketKey] });
      setCommentText("");
      setReplyTo(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCmtMut = useMutation({
    mutationFn: (id: string) => deleteComment(ticketKey!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket-comments", ticketKey] }),
  });

  const logTimeMut = useMutation({
    mutationFn: ({ hours, comment, date }: { hours: number; comment: string; date: string }) =>
      logTime(ticketKey!, hours, comment, date),
    onSuccess: () => {
      toast.success("Time logged");
      setWlHours("");
      setWlComment("");
      refetchWorklogs();
      qc.invalidateQueries({ queryKey: ["ticket", ticketKey] });
      qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addLinkMut = useMutation({
    mutationFn: ({ linkType, targetKey }: { linkType: string; targetKey: string }) =>
      createTicketLink(ticketKey!, linkType, targetKey),
    onSuccess: () => {
      refetchLinks();
      setNewLinkKey("");
      setLinkSuggestions([]);
      toast.success("Link added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeLinkMut = useMutation({
    mutationFn: (linkId: string) => deleteTicketLink(ticketKey!, linkId),
    onSuccess: () => refetchLinks(),
    onError: (e: Error) => toast.error(e.message),
  });

  const editCommentMut = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => editComment(ticketKey!, id, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-comments", ticketKey] });
      qc.invalidateQueries({ queryKey: ["ticket-activity", ticketKey] });
      setEditingCommentId(null);
      setEditingCommentText("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleLogTime() {
    const hours = parseFloat(wlHours);
    if (!hours || hours <= 0) { toast.error("Enter valid hours"); return; }
    logTimeMut.mutate({ hours, comment: wlComment, date: wlDate });
  }

  function handleAddLink() {
    const key = newLinkKey.trim().toUpperCase();
    if (!key) return;
    if (isEdit) {
      addLinkMut.mutate({ linkType: newLinkType, targetKey: key });
    } else {
      const suggestion = linkSuggestions.find((s) => s.key === key);
      setStagedLinks((prev) => [...prev, { type: newLinkType, key, summary: suggestion?.summary }]);
      setNewLinkKey("");
      setLinkSuggestions([]);
    }
  }

  /* Activity merged with worklogs */
  const activity = useMemo<TicketActivity[]>(() => {
    const wlActivity: TicketActivity[] = serverWorklogs.map((wl, idx) => ({
      id: (-1000 - idx) as any,
      ticket_key: ticketKey ?? "",
      actor: wl.author,
      action: "logged time",
      field: `${wl.hours}h`,
      new_value: wl.comment || undefined,
      created_at: wl.log_date,
    }));
    const combined = [...serverActivity, ...wlActivity];
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return combined;
  }, [serverActivity, serverWorklogs, ticketKey]);

  /* Top-level comments + replies */
  const topLevelComments = comments.filter((c) => !c.parent_id);
  const repliesFor = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  /* Create mutation */
  const createMut = useMutation({
    mutationFn: createTicket,
    onSuccess: async (created) => {
      const key = created?.key;
      if (form.attachments.length > 0 && key) {
        await Promise.allSettled(form.attachments.map((f) => uploadAttachment(key, f)));
      }
      if (stagedLinks.length > 0 && key) {
        await Promise.allSettled(stagedLinks.map((lnk) => createTicketLink(key, lnk.type, lnk.key)));
      }
      qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["new-tickets"] });
      if (defaultPod) qc.invalidateQueries({ queryKey: ["space-project", defaultPod] });
      toast.success("Ticket created!");
      onSuccess?.();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* Update mutation */
  const updateMut = useMutation({
    mutationFn: (payload: Partial<TicketCreate>) => updateTicket(ticketKey!, payload),
    onSuccess: async () => {
      if (form.attachments.length > 0 && ticketKey) {
        await Promise.allSettled(form.attachments.map((f) => uploadAttachment(ticketKey, f)));
        refetchAttachments();
        set("attachments", []);
      }
      qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["new-tickets"] });
      qc.invalidateQueries({ queryKey: ["ticket", ticketKey] });
      if (defaultPod) qc.invalidateQueries({ queryKey: ["space-project", defaultPod] });
      toast.success("Ticket updated!");
      onSuccess?.();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── EOS Form: improve title + description ── */
  async function handleEosForm() {
    if (!form.title.trim() && !form.description.trim()) {
      toast.error("Add a title or description first");
      return;
    }
    setEosFormLoading(true);
    try {
      const raw = await novaGenerate(
        `You are improving an engineering ticket. Output ONLY a raw JSON object — no prose, no code fences, no explanation.

Title: ${form.title || "(empty)"}
Description: ${form.description || "(empty)"}

Respond with exactly this structure:
{"title": "concise improved title under 80 chars", "description": "clear expanded description"}`,
        "Output ONLY a raw JSON object. No markdown, no backticks, no explanation. Just the JSON.",
        0.1,
      );

      // 1. Try full JSON parse (strips fences first)
      let title = "";
      let description = "";
      const parsed = extractJSON(raw);
      if (parsed) {
        title = typeof parsed.title === "string" ? parsed.title : "";
        description = typeof parsed.description === "string" ? parsed.description : "";
      }

      // 2. Regex fallback — handles single-quoted or partially malformed JSON
      if (!title) {
        const m = raw.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (m) title = m[1].replace(/\\"/g, '"');
      }
      if (!description) {
        const m = raw.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (m) description = m[1].replace(/\\"/g, '"');
      }

      if (title || description) {
        if (title) set("title", title);
        if (description) set("description", description);
        toast.success("EOS improved the form");
      } else {
        toast.error("EOS couldn't parse the response — try again");
      }
    } catch {
      toast.error("EOS form enhancement failed");
    } finally {
      setEosFormLoading(false);
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

  /* ── Attachments ── */
  function handleFiles(files: FileList | null) {
    if (!files) return;
    set("attachments", [...form.attachments, ...Array.from(files)]);
  }
  function removeAttachment(i: number) {
    set("attachments", form.attachments.filter((_, idx) => idx !== i));
  }

  /* ── Submit ── */
  function handleSubmit() {
    if (!form.title.trim()) { toast.error("Summary is required"); return; }
    if (onCreated) { onCreated({ ...form }); onClose(); return; }
    const payload: TicketCreate = {
      title: form.title,
      description: form.description,
      reporter: form.reporter || (!isEdit ? user?.name || undefined : undefined),
      issue_type: form.issue_type,
      priority: form.priority,
      status: form.status,
      assignee: form.assignee,
      pod: form.pod ?? defaultPod,
      client: form.client,
      story_points: form.story_points,
      labels: form.labels,
      due_date: form.due_date,
      epic_key: form.epic_key || undefined,
      parent_key: form.parent_key || undefined,
      fix_version: form.fix_version || undefined,
    };
    if (sprintId) payload.sprint_id = String(sprintId);
    if (isEdit) {
      updateMut.mutate(payload);
    } else {
      createMut.mutate(payload);
    }
  }

  const typeConfig = ISSUE_TYPES.find((t) => t.value === form.issue_type) ?? ISSUE_TYPES[2];
  const priorityConfig = PRIORITIES.find((p) => p.value === form.priority) ?? PRIORITIES[2];
  const statusConfig = STATUSES.find((s) => s.value === form.status) ?? STATUSES[0];
  const reporterDisplay = form.reporter || (!isEdit ? user?.name || "" : "");

  /* ── Footer ── */
  const footer = readOnly ? (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <button className={styles.btnSecondary} onClick={onClose}>Close</button>
    </div>
  ) : (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
      <button
        className={styles.btnPrimary}
        onClick={handleSubmit}
        disabled={createMut.isPending || updateMut.isPending}
      >
        {createMut.isPending || updateMut.isPending ? (
          <><svg className={styles.spinner} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>{isEdit ? "Saving…" : "Creating…"}</>
        ) : (
          <>{isEdit ? "Save Changes" : "Create Ticket"}</>
        )}
      </button>
    </div>
  );

  return (
    <>
      {/* Lightbox for image/video preview */}
      {lightboxUrl && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setLightboxUrl(null)}
        >
          {isImage(lightboxUrl) ? (
            <img
              src={lightboxUrl}
              alt="preview"
              style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : isVideo(lightboxUrl) ? (
            <video
              src={lightboxUrl}
              controls
              autoPlay
              style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8 }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : null}
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: "absolute", top: 20, right: 24,
              background: "rgba(255,255,255,0.1)", border: "none",
              color: "#fff", fontSize: 24, cursor: "pointer", borderRadius: 6,
              padding: "4px 10px",
            }}
          >✕</button>
        </div>
      )}

      <SideDrawer
        open={open}
        onClose={onClose}
        size="xl"
        title={readOnly ? `View ${ticketKey}` : isEdit ? `Edit ${ticketKey}` : "Create Issue"}
        subtitle={sprintName ? `Sprint: ${sprintName}` : undefined}
        badge={
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent-glow)", border: "1px solid var(--accent-border)", color: "var(--accent)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", padding: "3px 10px", borderRadius: 99 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent)", animation: "pulse 2s infinite" }} />
            EOS AI
          </div>
        }
        footer={footer}
        bodyClassName={styles.bodyFlush}
      >
        <div className={styles.twoColumnLayout}>
          {/* LEFT COLUMN */}
          <div className={styles.leftColumn}>
            {/* Classification */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Classification</div>
              <FormControl size="small" fullWidth disabled={readOnly}>
                <InputLabel>Type</InputLabel>
                <Select label="Type" value={form.issue_type} onChange={(e) => set("issue_type", e.target.value)}
                  renderValue={(v) => { const t = ISSUE_TYPES.find((x) => x.value === v) ?? ISSUE_TYPES[1]; return <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text)" }}><span style={{ color: t.color, display: "flex" }}>{t.icon}</span>{t.label}</span>; }}>
                  {ISSUE_TYPES.map((t) => <MenuItem key={t.value} value={t.value}><span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><span style={{ color: t.color, display: "flex" }}>{t.icon}</span>{t.label}</span></MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth disabled={readOnly}>
                <InputLabel>Priority</InputLabel>
                <Select label="Priority" value={form.priority} onChange={(e) => set("priority", e.target.value)}
                  renderValue={(v) => { const p = PRIORITIES.find((x) => x.value === v)!; return <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text)" }}><span style={{ color: p?.color, display: "flex" }}>{p?.icon}</span>{p?.label}</span>; }}>
                  {PRIORITIES.map((p) => <MenuItem key={p.value} value={p.value}><span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><span style={{ color: p?.color, display: "flex" }}>{p.icon}</span>{p.label}</span></MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth disabled={readOnly}>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={form.status} onChange={(e) => set("status", e.target.value)}
                  renderValue={(v) => { const s = STATUSES.find((x) => x.value === v)!; return <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text)" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: s?.color }} />{s?.label}</span>; }}>
                  {STATUSES.map((s) => <MenuItem key={s.value} value={s.value}><span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />{s.label}</span></MenuItem>)}
                </Select>
              </FormControl>
            </div>

            {/* People */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>People</div>
              <Autocomplete
                options={users}
                value={form.assignee ?? null}
                onChange={(_, v) => set("assignee", v ?? undefined)}
                size="small"
                fullWidth
                disabled={readOnly}
                renderInput={(params) => <TextField {...params} label="Assignee" />}
                sx={{ "& .MuiOutlinedInput-root": { fontSize: 13 } }}
              />
              {/* Reporter: always read-only */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, letterSpacing: "0.05em" }}>Reporter</label>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  border: "1px solid var(--border)", borderRadius: 6,
                  padding: "8px 12px", background: "var(--surface-2)",
                  fontSize: 13, color: "var(--text-2)", minHeight: 40,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "var(--accent-glow)", border: "1px solid var(--accent-border)",
                    color: "var(--accent)", fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {(reporterDisplay || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  {reporterDisplay || "—"}
                </div>
              </div>

            </div>

            {/* Planning */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Planning</div>
              <FormControl size="small" fullWidth disabled={readOnly}>
                <InputLabel>Story Points</InputLabel>
                <Select label="Story Points" value={form.story_points ?? ""} onChange={(e) => set("story_points", e.target.value ? Number(e.target.value) : undefined)}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  {STORY_POINTS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </Select>
              </FormControl>

              <TextField
                type="date" label="Due Date" size="small" fullWidth
                value={form.due_date ?? ""}
                onChange={(e) => set("due_date", e.target.value || undefined)}
                InputLabelProps={{ shrink: true }}
                disabled={readOnly}
              />

            </div>

            {/* Hierarchy */}
            {activePod && (
              <div className={styles.sectionCard}>
                <div className={styles.sectionTitle}>Hierarchy</div>

                {/* Epic */}
                <Autocomplete
                  options={podEpics}
                  getOptionLabel={(o) => typeof o === "string" ? o : `${o.key}: ${o.summary}`}
                  value={podEpics.find((e) => e.key === form.epic_key) ?? null}
                  onChange={(_, v) => set("epic_key", v ? v.key : undefined)}
                  size="small"
                  fullWidth
                  disabled={readOnly}
                  renderInput={(params) => <TextField {...params} label="Epic" placeholder="Link to an Epic" />}
                  sx={{ "& .MuiOutlinedInput-root": { fontSize: 13 } }}
                  isOptionEqualToValue={(o, v) => o.key === v.key}
                />

                {/* Parent Story / Task */}
                <Autocomplete
                  options={podParents.filter((p) => p.key !== ticketKey)}
                  getOptionLabel={(o) => typeof o === "string" ? o : `${o.key}: ${o.summary}`}
                  value={podParents.find((p) => p.key === form.parent_key) ?? null}
                  onChange={(_, v) => set("parent_key", v ? v.key : undefined)}
                  onInputChange={(_, val) => setParentSearch(val)}
                  size="small"
                  fullWidth
                  disabled={readOnly}
                  renderInput={(params) => <TextField {...params} label="Parent" placeholder="Link to a parent ticket" />}
                  sx={{ "& .MuiOutlinedInput-root": { fontSize: 13 } }}
                  isOptionEqualToValue={(o, v) => o.key === v.key}
                />

                {/* Release */}
                <FormControl size="small" fullWidth disabled={readOnly}>
                  <InputLabel>Release</InputLabel>
                  <Select
                    label="Release"
                    value={form.fix_version ?? ""}
                    onChange={(e) => set("fix_version", e.target.value || undefined)}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {podReleases.map((r) => (
                      <MenuItem key={r.id} value={r.name}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                          {r.name}
                          <span style={{ fontSize: 10, color: r.status === "released" ? "var(--green)" : "var(--amber)", fontWeight: 700, textTransform: "uppercase" }}>
                            {r.status}
                          </span>
                        </span>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
            )}

            {/* Context */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Context</div>
              <FormControl size="small" fullWidth disabled={readOnly}>
                <InputLabel>Client</InputLabel>
                <Select label="Client" value={form.client ?? ""} onChange={(e) => set("client", e.target.value || undefined)}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  {clients.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
              {/* POD display — read-only badge */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, letterSpacing: "0.05em" }}>POD</label>
                <div style={{
                  display: "flex", alignItems: "center",
                  border: "1px solid var(--accent-border)", borderRadius: 6,
                  padding: "8px 12px", background: "var(--accent-glow)",
                  fontSize: 13, fontWeight: 700, color: "var(--accent)", minHeight: 40,
                }}>
                  {form.pod ?? defaultPod ?? "—"}
                </div>
              </div>
            </div>

            {/* Time Tracking */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Time Tracking</div>
              <div className={styles.timeTrackingStack}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Original Est.</label>
                  <input className={styles.textInput} placeholder="e.g. 2h 30m" value={form.originalEst} onChange={(e) => set("originalEst", e.target.value)} readOnly={readOnly} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Time Spent</label>
                  <input className={styles.textInput} placeholder="e.g. 1h" value={form.timeSpent} onChange={(e) => set("timeSpent", e.target.value)} readOnly={readOnly} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Remaining</label>
                  <input className={styles.textInput} placeholder="e.g. 1h 30m" value={form.remaining} onChange={(e) => set("remaining", e.target.value)} readOnly={readOnly} />
                </div>
              </div>
            </div>

            {/* Labels */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Labels</div>
              <div className={styles.labelsBox}>
                {(form.labels ?? []).map((l) => (
                  <span key={l} className={styles.labelTag}>
                    {l}
                    {!readOnly && <button className={styles.labelRemove} onClick={() => set("labels", (form.labels ?? []).filter((x) => x !== l))}>✕</button>}
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

            {/* Summary chips */}
            <div className={styles.summaryBar}>
              <span className={styles.summaryChip} style={{ background: `${typeConfig.color}18`, color: typeConfig.color, borderColor: `${typeConfig.color}44` }}>
                <span style={{ display: "flex" }}>{typeConfig.icon}</span>{typeConfig.label}
              </span>
              <span className={styles.summaryChip} style={{ background: `${priorityConfig.color}18`, color: priorityConfig.color, borderColor: `${priorityConfig.color}44` }}>
                <span style={{ display: "flex" }}>{priorityConfig.icon}</span>{priorityConfig.label}
              </span>
              <span className={styles.summaryChip} style={{ background: `${statusConfig.color}18`, color: statusConfig.color, borderColor: `${statusConfig.color}44` }}>
                <RiCheckboxBlankCircleFill size={8} />{statusConfig.label}
              </span>
              {form.assignee && <span className={`${styles.summaryChip} ${styles.summaryChipDefault}`}>@ {form.assignee}</span>}
              {form.story_points && <span className={`${styles.summaryChip} ${styles.summaryChipDefault}`}>{form.story_points} pts</span>}
              {(form.pod ?? defaultPod) && (
                <span className={`${styles.summaryChip} ${styles.summaryChipDefault}`} style={{ color: "var(--accent)", borderColor: "var(--accent-border)" }}>
                  {form.pod ?? defaultPod}
                </span>
              )}
              {form.epic_key && (
                <span className={`${styles.summaryChip} ${styles.summaryChipDefault}`} style={{ color: "#FBBF24", borderColor: "rgba(251,191,36,0.4)" }}>
                  ⚡ {form.epic_key}
                </span>
              )}
              {form.parent_key && (
                <span className={`${styles.summaryChip} ${styles.summaryChipDefault}`} style={{ color: "#A78BFA", borderColor: "rgba(167,139,250,0.4)" }}>
                  ↳ {form.parent_key}
                </span>
              )}
              {form.fix_version && (
                <span className={`${styles.summaryChip} ${styles.summaryChipDefault}`} style={{ color: "var(--green)", borderColor: "rgba(52,211,153,0.4)" }}>
                  🚀 {form.fix_version}
                </span>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className={styles.rightColumn}>
            {/* EOS Form Button */}
            {!readOnly && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className={styles.eosFormBtn} disabled={eosFormLoading || (!form.title.trim() && !form.description.trim())} onClick={handleEosForm}>
                  {eosFormLoading ? <svg className={styles.spinner} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> : <RiSparklingLine size={14} />}
                  EOS Form
                </button>
              </div>
            )}

            {/* AI Suggestions row */}
            {!readOnly && !isEdit && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Intelligent routing suggestion */}
                {(routingLoading || routingSuggestion) && !form.assignee && (
                  <div className={styles.routingCard}>
                    <RiSparklingLine size={13} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
                    {routingLoading ? (
                      <span className={styles.routingText} style={{ color: "var(--text-3)" }}>EOS is finding the best assignee…</span>
                    ) : routingSuggestion ? (
                      <>
                        <div className={styles.routingBody}>
                          <span className={styles.routingText}>Assign to <strong>{routingSuggestion.assignee}</strong> — {routingSuggestion.reason}</span>
                        </div>
                        <button type="button" className={styles.routingAccept} onClick={() => { set("assignee", routingSuggestion.assignee); setRoutingSuggestion(null); setRoutingDismissed(true); }}>Assign</button>
                        <button type="button" className={styles.routingDismiss} onClick={() => { setRoutingSuggestion(null); setRoutingDismissed(true); }} title="Dismiss">✕</button>
                      </>
                    ) : null}
                  </div>
                )}

                {/* Story Point AI Callout */}
                {!form.story_points && (storyAiLoading || storyEstimate) && (
                  <div className={styles.storyEstCard}>
                    {storyAiLoading ? (
                      <div className={styles.storyEstLeft}><svg className={styles.spinner} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg><span className={styles.storyEstMeta}>EOS estimating story points…</span></div>
                    ) : storyEstimate ? (
                      <>
                        <div className={styles.storyEstLeft}>
                          <RiSparklingLine size={15} className={styles.storyEstIcon} />
                          <div>
                            <span className={styles.storyEstTitle}>EOS estimates {storyEstimate.min}–{storyEstimate.max} story points</span>
                            <span className={styles.storyEstMeta}>{storyEstimate.reasoning ?? `Confidence ${Math.round(storyEstimate.confidence * 100)}%`}</span>
                          </div>
                        </div>
                        <div className={styles.storyEstActions}>
                          <button className={styles.storyEstAccept} onClick={() => { set("story_points", storyEstimate.max); setStoryEstimate(null); }}>Accept {storyEstimate.max} pts</button>
                          <button className={styles.storyEstDismiss} onClick={() => setStoryEstimate(null)}>✕</button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Summary *</label>
              <input
                className={`${styles.textInput} ${styles.summaryInput}`}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Short, descriptive summary"
                readOnly={readOnly}
              />
            </div>

            {/* Live Duplicate Detection */}
            {!isEdit && (aiDupeScanning || liveDupes.length > 0 || dupeScanDone) && form.title.length >= 4 && (
              <div className={styles.liveDupeBanner} style={dupeScanDone && liveDupes.length === 0 ? { borderColor: "rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.05)" } : undefined}>
                <div className={styles.liveDupeHeader}>
                  {aiDupeScanning ? (
                    <><svg className={styles.spinner} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg><span>EOS scanning for duplicates…</span></>
                  ) : liveDupes.length > 0 ? (
                    <><RiAlertLine size={13} /><span>{liveDupes.length === 1 ? "A similar ticket" : `${liveDupes.length} similar tickets`} may already exist — review before creating</span></>
                  ) : (
                    <><RiCheckLine size={13} style={{ color: "var(--green)" }} /><span style={{ color: "var(--green)" }}>No duplicate tickets found</span></>
                  )}
                  <button className={styles.liveDupeClose} onClick={() => { setLiveDupes([]); setAiDupeScanning(false); setDupeScanDone(false); }}>✕</button>
                </div>
                {liveDupes.map((d) => (
                  <div key={d.key} className={styles.liveDupeItem}>
                    <span className={styles.liveDupeKey}>{d.key}</span>
                    <span className={styles.liveDupeSummary}>{d.summary.length > 60 ? d.summary.slice(0, 60) + "…" : d.summary}</span>
                    <span className={styles.liveDupePct} style={{ color: d.ai ? "var(--accent)" : undefined }}>{d.ai ? "AI match" : `${Math.round(d.similarity * 100)}% similar`}</span>
                  </div>
                ))}
                {!aiDupeScanning && <div className={styles.liveDupeEos}><RiSparklingLine size={9} /> EOS semantic + keyword analysis</div>}
              </div>
            )}

            {/* Description */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Description</label>
              <textarea
                className={`${styles.textInput} ${styles.textArea}`}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Acceptance criteria, steps to reproduce, notes…"
                readOnly={readOnly}
              />
            </div>

            {/* Linked Issues */}
            <div className={styles.contentSection}>
              <div className={styles.sectionTitle}>Linked Issues</div>

              {/* Existing links — edit mode (from API) */}
              {isEdit && serverLinks.map((lnk) => (
                <div key={lnk.id} className={styles.linkItem}>
                  <RiLink size={13} color="var(--text-3)" />
                  <span className={styles.linkType}>{lnk.link_type}</span>
                  <button
                    className={styles.linkKey}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", textDecoration: "underline", padding: 0, fontSize: 12 }}
                    onClick={() => { onClose(); navigate(`/tickets?key=${lnk.target_key}`); }}
                  >
                    {lnk.target_key}
                  </button>
                  {lnk.target_summary && <span style={{ fontSize: 12, color: "var(--text-2)", flex: 1 }}>{lnk.target_summary.slice(0, 50)}{lnk.target_summary.length > 50 ? "…" : ""}</span>}
                  {!readOnly && (
                    <button className={styles.linkDelete} onClick={() => removeLinkMut.mutate(lnk.id)}>
                      <RiDeleteBinLine size={14} />
                    </button>
                  )}
                </div>
              ))}

              {/* Staged links — create mode (posted after ticket creation) */}
              {!isEdit && stagedLinks.map((lnk, i) => (
                <div key={i} className={styles.linkItem}>
                  <RiLink size={13} color="var(--text-3)" />
                  <span className={styles.linkType}>{lnk.type}</span>
                  <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 12 }}>{lnk.key}</span>
                  {lnk.summary && <span style={{ fontSize: 12, color: "var(--text-2)", flex: 1 }}>{lnk.summary.slice(0, 50)}{lnk.summary.length > 50 ? "…" : ""}</span>}
                  <button className={styles.linkDelete} onClick={() => setStagedLinks((prev) => prev.filter((_, idx) => idx !== i))}>
                    <RiDeleteBinLine size={14} />
                  </button>
                </div>
              ))}

              {/* Add new link — both modes */}
              {!readOnly && (
                <div style={{ position: "relative" }}>
                  <div className={styles.linkAddRow}>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <Select value={newLinkType} onChange={(e) => setNewLinkType(e.target.value)}>
                        {LINK_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <input
                      className={styles.textInput}
                      placeholder="Ticket key or search…"
                      value={newLinkKey}
                      onChange={(e) => setNewLinkKey(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddLink()}
                    />
                    <button className={styles.iconBtn} onClick={handleAddLink} disabled={addLinkMut.isPending}>
                      <RiAddLine size={16} />
                    </button>
                  </div>
                  {/* Autocomplete suggestions */}
                  {linkSuggestions.length > 0 && (
                    <div style={{
                      position: "absolute", top: "100%", left: 150, right: 40, zIndex: 100,
                      background: "var(--surface)", border: "1px solid var(--border)",
                      borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", maxHeight: 200, overflowY: "auto",
                    }}>
                      {linkSuggestions.map((s) => (
                        <div
                          key={s.key}
                          style={{ padding: "8px 12px", cursor: "pointer", display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}
                          onMouseDown={() => {
                            setNewLinkKey(s.key);
                            setLinkSuggestions([]);
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                          onMouseOut={(e) => (e.currentTarget.style.background = "")}
                        >
                          <span style={{ fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>{s.key}</span>
                          <span style={{ color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!isEdit && stagedLinks.length === 0 && (
                <p className={styles.emptyHint} style={{ fontSize: 12, margin: "4px 0 8px" }}>Search for a ticket above to link it. Links will be saved when you create the ticket.</p>
              )}
            </div>

            {/* Attachments */}
            <div className={styles.contentSection}>
              <div className={styles.sectionHeader}>
                <RiAttachmentLine size={14} color="var(--text-3)" />
                <span className={styles.sectionHeaderText}>Attachments</span>
              </div>

              {!readOnly && (
                <div
                  className={styles.dropZone}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                >
                  <RiAttachmentLine size={24} color="var(--text-3)" />
                  <div className={styles.dropZoneText}>Drop files here or <span className={styles.dropZoneAccent}>browse</span></div>
                  <div className={styles.dropZoneHint}>Images, videos, documents · Max 25 MB</div>
                </div>
              )}
              {!readOnly && <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />}

              {/* Server-side attachments — card grid */}
              {serverAttachments.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginTop: 12 }}>
                  {serverAttachments.map((a) => (
                    <AttachmentCard
                      key={a.id}
                      filename={a.filename}
                      url={a.url || ""}
                      size={a.size}
                      onPreview={(url) => (isImage(a.filename) || isVideo(a.filename)) ? setLightboxUrl(url) : window.open(url, "_blank")}
                    />
                  ))}
                </div>
              )}

              {/* Locally staged files */}
              {form.attachments.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginTop: 8 }}>
                  {form.attachments.map((f, i) => (
                    <div
                      key={i}
                      style={{
                        border: "1px solid var(--border)", borderRadius: 8,
                        padding: 10, display: "flex", flexDirection: "column",
                        gap: 6, background: "var(--surface-2)", position: "relative",
                      }}
                    >
                      <div style={{ fontSize: 24, color: "var(--text-3)" }}>
                        {isImage(f.name) ? <RiImageLine size={24} color="var(--accent)" /> : isVideo(f.name) ? <RiVideoLine size={24} color="#A78BFA" /> : <RiFileLine size={24} color="var(--text-3)" />}
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.name}>{f.name}</span>
                      <span style={{ fontSize: 10, color: "var(--text-3)" }}>{humanSize(f.size)} · uploading after save</span>
                      {!readOnly && (
                        <button
                          onClick={() => removeAttachment(i)}
                          style={{ position: "absolute", top: 6, right: 6, background: "rgba(248,113,113,0.12)", border: "none", color: "#F87171", cursor: "pointer", borderRadius: 4, padding: "2px 5px", fontSize: 12 }}
                        >✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Code Context */}
            {isEdit && (
              <div className={`${styles.codeCtxCard} ${styles.contentSection}`}>
                <div className={styles.codeCtxHeader} onClick={() => setCodeCtxOpen((v) => !v)}>
                  <RiCodeSSlashLine size={13} color="var(--accent)" />
                  <span className={styles.codeCtxTitle}>Code Context</span>
                  {codeCtxLoading && <svg className={styles.spinner} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>}
                  <span className={styles.codeCtxChevron}>{codeCtxOpen ? "▲" : "▼"}</span>
                </div>
                {codeCtxOpen && (
                  <div className={styles.codeCtxBody}>
                    {codeCtxLoading && <div className={styles.codeCtxNote}><svg className={styles.spinner} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>AI is analysing ticket and searching repositories…</div>}
                    {!codeCtxLoading && codeCtx && !codeCtx.connected && (
                      <div className={styles.codeCtxNoAccess}><RiGitMergeLine size={18} color="var(--text-3)" /><span className={styles.codeCtxNoAccessTitle}>Cannot reach repository</span></div>
                    )}
                    {!codeCtxLoading && codeCtx?.connected && (
                      <>
                        {/* Diagnosis row — AI layer verdict + summary */}
                        {codeCtx.diagnosis && (
                          <div className={styles.codeCtxDiagRow}>
                            {codeCtx.diagnosis.likely_layer && (() => {
                              const layer = layerFromDiagnosis(codeCtx.diagnosis!.likely_layer);
                              const isFullStack = (codeCtx.diagnosis!.likely_layer ?? "").toLowerCase().includes("full");
                              if (isFullStack) {
                                return (
                                  <span className={styles.layerBadge} style={{ background: "rgba(251,191,36,0.12)", color: "var(--amber, #FBBF24)" }}>
                                    Full-stack
                                  </span>
                                );
                              }
                              const m = LAYER_META[layer];
                              return (
                                <span className={styles.layerBadge} style={{ background: m.bg, color: m.color }}>
                                  {m.label}
                                </span>
                              );
                            })()}
                            <RiSparklingLine size={9} color="var(--accent)" style={{ flexShrink: 0 }} />
                            <span className={styles.codeCtxDiagText}>
                              {codeCtx.diagnosis.feature_area && <span>{codeCtx.diagnosis.feature_area}</span>}
                              {codeCtx.diagnosis.summary && <span>{codeCtx.diagnosis.feature_area ? " — " : ""}{codeCtx.diagnosis.summary}</span>}
                            </span>
                          </div>
                        )}

                        {codeCtx.search_terms && codeCtx.search_terms.length > 0 && (
                          <div className={styles.codeCtxNote}><RiSparklingLine size={9} color="var(--accent)" />AI searched: {codeCtx.search_terms.join(", ")}</div>
                        )}

                        {/* Files grouped by FE / BE */}
                        {codeCtx.files.length > 0 && (() => {
                          const grouped: Record<CodeLayer, typeof codeCtx.files> = { frontend: [], backend: [], unknown: [] };
                          codeCtx.files.forEach(f => grouped[inferLayer(f.repo, f.path)].push(f));
                          const hasMultipleGroups = (grouped.frontend.length > 0 && grouped.backend.length > 0);

                          const renderFile = (f: typeof codeCtx.files[0]) => (
                            <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className={styles.codeFile} style={{ textDecoration: "none" }}>
                              <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                                <span className={styles.codeFilePath}>{f.path}</span>
                                {(f.reason || f.symbol || f.matched_terms?.length) && (
                                  <span className={styles.codeFileReason}>
                                    {f.symbol ? `${f.symbol} · ` : ""}
                                    {f.reason ?? ""}
                                    {f.matched_terms?.length ? ` (${f.matched_terms.slice(0, 2).join(", ")})` : ""}
                                  </span>
                                )}
                              </span>
                              <span className={styles.codeFileReason}>
                                {typeof f.confidence === "number" ? `${Math.round(f.confidence * 100)}%` : "↗"}
                              </span>
                            </a>
                          );

                          return (
                            <div className={styles.codeCtxSection}>
                              <div className={styles.codeCtxSectionTitle}><RiCodeSSlashLine size={11} /> Likely files to inspect</div>
                              {hasMultipleGroups ? (
                                (["frontend", "backend", "unknown"] as CodeLayer[]).map(layer => {
                                  const files = grouped[layer];
                                  if (!files.length) return null;
                                  const m = LAYER_META[layer];
                                  return (
                                    <div key={layer} className={styles.layerGroup}>
                                      <div className={styles.layerGroupHeader} style={{ color: m.color }}>
                                        <span className={styles.layerGroupBadge} style={{ background: m.bg, color: m.color }}>{m.short}</span>
                                        {m.label}
                                      </div>
                                      {files.map(renderFile)}
                                    </div>
                                  );
                                })
                              ) : (
                                codeCtx.files.map(renderFile)
                              )}
                            </div>
                          );
                        })()}

                        {/* PRs with FE/BE badge */}
                        {codeCtx.prs.length > 0 && (
                          <div className={styles.codeCtxSection}>
                            <div className={styles.codeCtxSectionTitle}><RiGitMergeLine size={11} /> Related PRs</div>
                            {codeCtx.prs.map((pr) => {
                              const layer = inferLayer(pr.repo, pr.touched_files?.[0] ?? "");
                              const m = LAYER_META[layer];
                              return (
                                <a key={pr.url} href={pr.url} target="_blank" rel="noreferrer" className={styles.codePr} style={{ textDecoration: "none" }}>
                                  <span className={styles.layerBadgeSm} style={{ background: m.bg, color: m.color }}>{m.short}</span>
                                  <span className={styles.codePrKey}>{pr.number}</span>
                                  <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                                    <span className={styles.codePrTitle}>{pr.title}</span>
                                    {(pr.reason || pr.touched_files?.length) && (
                                      <span className={styles.codeFileReason}>
                                        {pr.reason}
                                        {pr.touched_files?.length ? ` (${pr.touched_files.slice(0, 2).join(", ")})` : ""}
                                      </span>
                                    )}
                                  </span>
                                  <span className={`${styles.codePrStatus} ${pr.status === "merged" ? styles.codePrMerged : styles.codePrOpen}`}>
                                    {typeof pr.confidence === "number" ? `${pr.status} · ${Math.round(pr.confidence * 100)}%` : pr.status}
                                  </span>
                                </a>
                              );
                            })}
                          </div>
                        )}

                        {codeCtx.files.length === 0 && codeCtx.prs.length === 0 && (
                          <div className={styles.codeCtxNote}>No related files or PRs found across configured repositories.</div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tabs: Comments | Activity | Worklogs */}
            {isEdit && (
              <>
                <div className={styles.tabRoot}>
                  <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                    <Tab label={`Comments${comments.length > 0 ? ` (${comments.length})` : ""}`} />
                    <Tab label="Activity" />
                    <Tab label={`Worklogs${serverWorklogs.length > 0 ? ` (${serverWorklogs.length})` : ""}`} />
                  </Tabs>
                </div>

                {/* ── Tab: Comments ── */}
                {tab === 0 && (
                  <div className={styles.tabPanel}>
                    <div className={styles.commentsList}>
                      {topLevelComments.length === 0 && <p className={styles.emptyHint}>No comments yet. Be the first!</p>}
                      {topLevelComments.map((c) => (
                        <div key={c.id} className={styles.commentItem}>
                          <div className={styles.commentAvatar}>
                            {(c.author || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div className={styles.commentBody}>
                            <div className={styles.commentMeta}>
                              <span className={styles.commentAuthor}>{c.author}</span>
                              <span className={styles.commentDate}>{formatDate(c.created_at, "MMM d, yyyy · h:mm a")}</span>
                              {editingCommentId !== String(c.id) && (
                                <>
                                  <button className={styles.commentAction} onClick={() => setReplyTo(String(c.id))}>Reply</button>
                                  <button className={styles.commentAction} onClick={() => { setEditingCommentId(String(c.id)); setEditingCommentText(c.content); }}>Edit</button>
                                  <button className={styles.commentAction} style={{ color: "#F87171" }} onClick={() => deleteCmtMut.mutate(String(c.id))}>Delete</button>
                                </>
                              )}
                            </div>
                            {editingCommentId === String(c.id) ? (
                              <div style={{ marginTop: 6 }}>
                                <textarea
                                  className={`${styles.textInput} ${styles.textArea}`}
                                  value={editingCommentText}
                                  onChange={(e) => setEditingCommentText(e.target.value)}
                                  rows={3}
                                  autoFocus
                                />
                                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                                  <button className={styles.btnGhost} style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => { setEditingCommentId(null); setEditingCommentText(""); }}>Cancel</button>
                                  <button
                                    className={styles.btnPrimary}
                                    style={{ fontSize: 12, padding: "5px 12px" }}
                                    disabled={!editingCommentText.trim() || editCommentMut.isPending}
                                    onClick={() => editCommentMut.mutate({ id: String(c.id), content: editingCommentText })}
                                  >
                                    {editCommentMut.isPending ? "Saving…" : "Save"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className={styles.commentText} style={{ whiteSpace: "pre-wrap" }}>{c.content}</p>
                            )}
                            {repliesFor(String(c.id)).map((r) => (
                              <div key={r.id} className={styles.replyItem}>
                                <div className={styles.commentAvatar} style={{ width: 24, height: 24, fontSize: 10 }}>
                                  {(r.author || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                                <div className={styles.commentBody}>
                                  <div className={styles.commentMeta}>
                                    <span className={styles.commentAuthor}>{r.author}</span>
                                    <span className={styles.commentDate}>{formatDate(r.created_at, "MMM d, yyyy · h:mm a")}</span>
                                    <button className={styles.commentAction} style={{ color: "#F87171" }} onClick={() => deleteCmtMut.mutate(String(r.id))}>Delete</button>
                                  </div>
                                  <p className={styles.commentText} style={{ whiteSpace: "pre-wrap" }}>{r.content}</p>
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
                          Replying to comment
                          <button className={styles.cancelReply} onClick={() => setReplyTo(null)}>✕</button>
                        </div>
                      )}
                      <textarea
                        className={`${styles.textInput} ${styles.textArea}`}
                        placeholder="Write a comment…"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        rows={3}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                        <button
                          className={styles.btnPrimary}
                          disabled={!commentText.trim() || commentMut.isPending}
                          onClick={() => commentMut.mutate({ content: commentText, parentId: replyTo ?? undefined })}
                          style={{ padding: "7px 16px", fontSize: 12 }}
                        >
                          {commentMut.isPending ? "Posting…" : "Post Comment"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Tab: Activity ── */}
                {tab === 1 && (
                  <div className={styles.tabPanel}>
                    {activity.length === 0 && <p className={styles.emptyHint}>No activity recorded yet.</p>}
                    <div className={styles.timeline}>
                      {activity.map((a) => (
                        <div key={`${a.id}-${a.created_at}`} className={styles.activityEntry}>
                          <div className={styles.activityIcon}>{getActivityIcon(a.action)}</div>
                          <div className={styles.activityContent}>
                            <span className={styles.activityActor}>{a.actor}</span>{" "}
                            {getActivityText(a)}
                            <span className={styles.activityTime}> · {formatDate(a.created_at, "MMM d, yyyy · h:mm a")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Tab: Worklogs ── */}
                {tab === 2 && (
                  <div className={styles.tabPanel}>
                    <div className={styles.worklogForm}>
                      <div className={styles.formRow3}>
                        <div className={styles.field}>
                          <label className={styles.fieldLabel}>Hours *</label>
                          <input className={styles.textInput} type="number" step="0.1" min="0.1" placeholder="e.g. 2.5" value={wlHours} onChange={(e) => setWlHours(e.target.value)} />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.fieldLabel}>Date</label>
                          <input className={styles.textInput} type="date" value={wlDate} onChange={(e) => setWlDate(e.target.value)} />
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Comment (optional)</label>
                        <input className={styles.textInput} placeholder="What did you work on?" value={wlComment} onChange={(e) => setWlComment(e.target.value)} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button className={styles.btnPrimary} onClick={handleLogTime} disabled={logTimeMut.isPending} style={{ padding: "7px 16px", fontSize: 12 }}>
                          {logTimeMut.isPending ? "Logging…" : "+ Log Time"}
                        </button>
                      </div>
                    </div>

                    <div className={styles.worklogList}>
                      {serverWorklogs.length === 0 && <p className={styles.emptyHint}>No time logged yet.</p>}
                      {serverWorklogs.map((wl) => (
                        <div key={wl.id} className={styles.worklogItem}>
                          <div className={styles.worklogHeader}>
                            <span className={styles.worklogAuthor}>{wl.author}</span>
                            <span className={styles.worklogDate}>{formatDate(wl.log_date, "MMM d, yyyy")}</span>
                            <span className={styles.worklogHours}>{wl.hours}h</span>
                          </div>
                          {wl.comment && <div className={styles.worklogComment}>{wl.comment}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {/* end rightColumn */}
        </div>
        {/* end twoColumnLayout */}

      </SideDrawer>
    </>
  );
}

/* ── Attachment Card component ── */
function AttachmentCard({ filename, url, size, onPreview }: { filename: string; url: string; size: number; onPreview: (url: string) => void }) {
  const img = isImage(filename);
  const vid = isVideo(filename);

  return (
    <div
      style={{
        border: "1px solid var(--border)", borderRadius: 8,
        overflow: "hidden", background: "var(--surface-2)",
        display: "flex", flexDirection: "column", cursor: "pointer",
        transition: "border-color 0.15s",
      }}
      onClick={() => onPreview(url)}
      onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
      onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      {/* Preview area */}
      <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", overflow: "hidden" }}>
        {img ? (
          <img src={url} alt={filename} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : vid ? (
          <RiVideoLine size={32} color="#A78BFA" />
        ) : (
          <RiFileLine size={32} color="var(--text-3)" />
        )}
      </div>
      {/* Info row */}
      <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 11, color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={filename}>{filename}</span>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>{humanSize(size)}</span>
          <a
            href={url}
            download={filename}
            style={{ fontSize: 10, color: "var(--accent)" }}
            onClick={(e) => e.stopPropagation()}
            title="Download"
          >
            <RiExternalLinkLine size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Activity helpers ── */
function getActivityIcon(action: string): string {
  const map: Record<string, string> = {
    created: "🆕", updated: "✏️", changed: "📝", assigned: "👤",
    "logged time": "⏱️", commented: "💬", deleted: "🗑️",
    moved: "➡️", transitioned: "➡️", linked: "🔗", "attached file": "📎",
    status_changed: "🔄",
  };
  for (const key of Object.keys(map)) {
    if (action.toLowerCase().includes(key)) return map[key];
  }
  return "•";
}

function getActivityText(entry: TicketActivity): string {
  if (entry.action === "logged time") return `logged ${entry.field || "time"}${entry.new_value ? ` — "${entry.new_value}"` : ""}`;
  if (entry.action === "created") return "created this ticket";
  if (entry.action === "commented") return "added a comment";
  if (entry.action === "attached file") return `attached a file`;
  if (entry.action === "linked") return `linked a ticket`;
  if (entry.field) {
    let txt = `${entry.action} ${entry.field}`;
    if (entry.old_value) txt += ` from "${entry.old_value}"`;
    if (entry.new_value) txt += ` to "${entry.new_value}"`;
    return txt;
  }
  return entry.action;
}
