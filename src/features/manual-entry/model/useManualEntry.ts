import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { parseTimeEntries, localParseEntries } from "../lib/aiParser";
import type { ManualEntry, ParsedEntry, PersonRole } from "./types";

export type EntryStep = "input" | "parsing" | "preview" | "confirmed";

const PARSING_STEPS = [
  "Extracting dates and durations",
  "Matching PODs and clients from your workspace",
  "Classifying activity types",
  "Building structured rows",
];

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getAuthHeader(): Record<string, string> {
  const stored = localStorage.getItem("eap-auth");
  if (!stored) return {};
  try {
    const { state } = JSON.parse(stored);
    return state?.token ? { Authorization: `Bearer ${state.token}` } : {};
  } catch {
    return {};
  }
}

export function useManualEntry(pods: string[], clients: string[]) {
  const [step, setStep] = useState<EntryStep>("input");
  const [inputText, setInputText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedEntry[]>([]);
  const [confirmedRows, setConfirmedRows] = useState<ManualEntry[]>([]);
  const [parsingStep, setParsingStep] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<PersonRole>(
    "Engineering Manager",
  );
  const [personName, setPersonName] = useState("Anand Verma");
  const [totalHours, setTotalHours] = useState(0);

  /* Animate parsing steps */
  function animateParsingSteps(onDone: () => void) {
    setParsingStep(0);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setParsingStep(i);
      if (i >= PARSING_STEPS.length) {
        clearInterval(iv);
        setTimeout(onDone, 400);
      }
    }, 650);
  }

  /* Parse */
  const parse = useCallback(async () => {
    if (!inputText.trim()) {
      toast.error("Please enter some text first");
      return;
    }
    setStep("parsing");
    setParsingStep(0);

    animateParsingSteps(async () => {
      try {
        const useMock = import.meta.env.VITE_USE_MOCK === "true";
        const result = useMock
          ? localParseEntries(inputText, pods, clients)
          : await parseTimeEntries(inputText, pods, clients);

        setParsedRows(result.entries);
        setTotalHours(result.totalHours);
        setWarnings(result.warnings);
        setStep("preview");
      } catch (err: any) {
        toast.error(err.message ?? "Parse failed");
        const fallback = localParseEntries(inputText, pods, clients);
        setParsedRows(fallback.entries);
        setTotalHours(fallback.totalHours);
        setWarnings(fallback.warnings);
        setStep("preview");
      }
    });
  }, [inputText, pods, clients]);

  /* Edit a row */
  const updateRow = useCallback(
    (
      index: number,
      field: keyof ParsedEntry,
      value: string | number | null,
    ) => {
      setParsedRows((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        setTotalHours(next.reduce((s, r) => s + (Number(r.hours) || 0), 0));
        return next;
      });
    },
    [],
  );

  /* Delete a row */
  const deleteRow = useCallback((index: number) => {
    setParsedRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setTotalHours(next.reduce((s, r) => s + r.hours, 0));
      return next;
    });
  }, []);

  /* Add blank row */
  const addRow = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    setParsedRows((prev) => [
      ...prev,
      {
        date: today,
        activity: "",
        hours: 1,
        pod: null,
        client: null,
        type: "Meeting",
        notes: "",
        confidence: "medium",
      },
    ]);
  }, []);

  /* Confirm — save to backend */
  const confirm = useCallback(async () => {
    const validRows = parsedRows.filter(
      (r) => r.activity.trim() && r.hours > 0,
    );
    if (validRows.length === 0) {
      toast.error("No valid entries to save");
      return;
    }

    const payload = {
      ai_raw_input: inputText,
      entries: validRows.map((r) => ({
        entry_date: r.date,
        activity: r.activity,
        hours: r.hours,
        pod: r.pod || null,
        client: r.client || null,
        entry_type: r.type,
        notes: r.notes || null,
        ai_parsed: true,
      })),
    };

    try {
      const res = await fetch(`${API}/api/manual-entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to save entries");
      }

      const saved = await res.json();

      // Map backend response to ManualEntry shape for StepConfirmed display
      const entries: ManualEntry[] = saved.map((e: any) => ({
        id: e.id,
        date: e.entry_date,
        activity: e.activity,
        hours: e.hours,
        pod: e.pod ?? null,
        client: e.client ?? null,
        type: e.entry_type,
        notes: e.notes ?? "",
        person: personName,
        role: selectedRole,
        createdAt: e.created_at,
      }));

      setConfirmedRows(entries);
      setStep("confirmed");
      toast.success(
        `${entries.length} ${entries.length === 1 ? "entry" : "entries"} saved successfully`,
      );
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save entries");
    }
  }, [parsedRows, inputText, personName, selectedRole]);

  /* Reset */
  const reset = useCallback(() => {
    setStep("input");
    setInputText("");
    setParsedRows([]);
    setParsingStep(0);
    setWarnings([]);
  }, []);

  return {
    step,
    setStep,
    inputText,
    setInputText,
    parsedRows,
    confirmedRows,
    parsingStep,
    parsingSteps: PARSING_STEPS,
    warnings,
    selectedRole,
    setSelectedRole,
    personName,
    setPersonName,
    totalHours,
    parse,
    updateRow,
    deleteRow,
    addRow,
    confirm,
    reset,
  };
}
