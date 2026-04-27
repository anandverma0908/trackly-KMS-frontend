import type { TicketCreate } from "@/types";

const ISSUE_TYPES = ["Story", "Bug", "Task", "Epic", "Subtask", "Improvement"];
const PRIORITIES = ["Highest", "High", "Medium", "Low", "Lowest"];
const STATUSES = ["To Do", "In Progress", "In Review", "Blocked", "Done"];
const FIBONACCI = [1, 2, 3, 5, 8, 13, 21];
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_LABEL_LENGTH = 50;
const MAX_FILTER_NAME_LENGTH = 100;

export interface ValidationError {
  field: string;
  message: string;
}

export function validateTicketCreate(data: Partial<TicketCreate>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.title || !data.title.trim()) {
    errors.push({ field: "title", message: "Summary is required" });
  } else if (data.title.trim().length > MAX_TITLE_LENGTH) {
    errors.push({ field: "title", message: `Summary must be under ${MAX_TITLE_LENGTH} characters` });
  }

  if (data.description && data.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push({ field: "description", message: `Description must be under ${MAX_DESCRIPTION_LENGTH} characters` });
  }

  if (data.issue_type && !ISSUE_TYPES.includes(data.issue_type)) {
    errors.push({ field: "issue_type", message: `Invalid issue type: ${data.issue_type}` });
  }

  if (data.priority && !PRIORITIES.includes(data.priority)) {
    errors.push({ field: "priority", message: `Invalid priority: ${data.priority}` });
  }

  if (data.status && !STATUSES.includes(data.status)) {
    errors.push({ field: "status", message: `Invalid status: ${data.status}` });
  }

  if (data.story_points !== undefined && data.story_points !== null) {
    if (typeof data.story_points !== "number" || !Number.isFinite(data.story_points)) {
      errors.push({ field: "story_points", message: "Story points must be a number" });
    } else if (data.story_points < 0) {
      errors.push({ field: "story_points", message: "Story points cannot be negative" });
    } else if (!FIBONACCI.includes(data.story_points)) {
      errors.push({ field: "story_points", message: `Story points must be Fibonacci: ${FIBONACCI.join(", ")}` });
    }
  }

  if (data.due_date) {
    const d = new Date(data.due_date);
    if (isNaN(d.getTime())) {
      errors.push({ field: "due_date", message: "Invalid due date format" });
    }
  }

  if (data.labels) {
    const seen = new Set<string>();
    for (const label of data.labels) {
      if (!label || !label.trim()) {
        errors.push({ field: "labels", message: "Labels cannot contain empty strings" });
        break;
      }
      if (label.trim().length > MAX_LABEL_LENGTH) {
        errors.push({ field: "labels", message: `Label "${label}" exceeds ${MAX_LABEL_LENGTH} chars` });
        break;
      }
      const normalized = label.trim().toLowerCase();
      if (seen.has(normalized)) {
        errors.push({ field: "labels", message: `Duplicate label: "${label}"` });
        break;
      }
      seen.add(normalized);
    }
  }

  return errors;
}

export function validateBoardConfig(columns: { id: string; name: string; status_mapping: string[] }[], wipLimits: Record<string, number>): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const col of columns) {
    if (!col.name || !col.name.trim()) {
      errors.push({ field: "name", message: "Column name cannot be empty" });
    }
    if (col.name && col.name.trim().length > 50) {
      errors.push({ field: "name", message: `Column name "${col.name}" exceeds 50 characters` });
    }
  }

  const ids = new Set<string>();
  for (const col of columns) {
    if (ids.has(col.id)) {
      errors.push({ field: "id", message: `Duplicate column ID: ${col.id}` });
      break;
    }
    ids.add(col.id);
  }

  for (const [colId, limit] of Object.entries(wipLimits)) {
    if (typeof limit !== "number" || !Number.isFinite(limit)) {
      errors.push({ field: "wip_limits", message: `WIP limit for ${colId} must be a number` });
    } else if (limit < 0) {
      errors.push({ field: "wip_limits", message: `WIP limit for ${colId} cannot be negative` });
    } else if (limit > 999) {
      errors.push({ field: "wip_limits", message: `WIP limit for ${colId} cannot exceed 999` });
    }
  }

  return errors;
}

export function validateFilterName(name: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!name || !name.trim()) {
    errors.push({ field: "name", message: "Filter name is required" });
  } else if (name.trim().length > MAX_FILTER_NAME_LENGTH) {
    errors.push({ field: "name", message: `Filter name must be under ${MAX_FILTER_NAME_LENGTH} characters` });
  }
  return errors;
}

/* ── LLM Output Validation ── */

export interface LlmTicketSuggestion {
  title?: string;
  description?: string;
}

export function validateLlmTicketSuggestion(raw: unknown): LlmTicketSuggestion {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const result: LlmTicketSuggestion = {};

  if (typeof obj.title === "string") {
    const trimmed = obj.title.trim();
    if (trimmed && trimmed.length <= MAX_TITLE_LENGTH) {
      result.title = trimmed;
    }
  }

  if (typeof obj.description === "string") {
    const trimmed = obj.description.trim();
    if (trimmed.length <= MAX_DESCRIPTION_LENGTH) {
      result.description = trimmed;
    }
  }

  return result;
}

export function validateLlmStoryPoints(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  const nearest = FIBONACCI.reduce((closest, point) =>
    Math.abs(point - value) < Math.abs(closest - value) ? point : closest,
  FIBONACCI[0]);
  return nearest;
}

export function validateLlmConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.72;
  return Math.max(0, Math.min(1, value));
}

export function validateLlmAssignee(value: unknown, allowedUsers: string[]): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const matched = allowedUsers.find((u) => u.toLowerCase() === trimmed.toLowerCase());
  return matched ?? null;
}

/* ── Status helpers ── */

export function normalizeStatus(status: string): string {
  const map: Record<string, string> = {
    open: "To Do",
    reopened: "To Do",
    todo: "To Do",
    "in-progress": "In Progress",
    inprogress: "In Progress",
    "in-review": "In Review",
    inreview: "In Review",
    blocked: "Blocked",
    done: "Done",
    closed: "Done",
    resolved: "Done",
  };
  const lower = status.toLowerCase().trim();
  return map[lower] ?? status;
}

export function isKnownStatus(status: string): boolean {
  return STATUSES.includes(status);
}

export function getFallbackColumn(): string {
  return "To Do";
}
