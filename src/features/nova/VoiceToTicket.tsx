import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { analyzeTicketNL, createTicket } from "@/services/api";
import toast from "react-hot-toast";
import { RiMicLine, RiStopCircleLine, RiSparklingLine, RiCheckLine, RiRefreshLine } from "react-icons/ri";
import styles from "./Gen2.module.css";

interface ExtractedTicket {
  title: string;
  description: string;
  steps?: string;
  expected?: string;
  actual?: string;
  priority: string;
  issue_type: string;
  assignee?: string;
}

export default function VoiceToTicket() {
  const [phase, setPhase] = useState<"idle" | "recording" | "transcribed" | "extracted" | "created">("idle");
  const [transcript, setTranscript] = useState("");
  const [liveText, setLiveText] = useState("");
  const [extracted, setExtracted] = useState<ExtractedTicket | null>(null);
  const recognitionRef = useRef<any>(null);
  const [supported] = useState(() => "SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  function startRecording() {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript((prev) => prev + final);
      setLiveText(interim);
    };

    recognition.onend = () => {
      setLiveText("");
      setPhase("transcribed");
    };

    recognition.start();
    setPhase("recording");
    setTranscript("");
  }

  function stopRecording() {
    recognitionRef.current?.stop();
  }

  const extractMut = useMutation({
    mutationFn: async (text: string) => {
      const prompt = `Extract a bug ticket from this spoken description. Return JSON only with keys: title, description, steps (reproduction steps), expected, actual, priority (Critical/High/Medium/Low), issue_type (Bug/Task/Story), assignee (if mentioned).

Spoken: "${text}"`;
      const result = await analyzeTicketNL(prompt);
      // Parse from description field which contains the JSON
      try {
        const json = result.description?.match(/\{[\s\S]*\}/)?.[0];
        if (json) return JSON.parse(json) as ExtractedTicket;
      } catch {}
      return {
        title: result.title ?? text.slice(0, 60),
        description: result.description ?? text,
        priority: result.priority ?? "Medium",
        issue_type: "Bug",
        assignee: result.assignee,
      } as ExtractedTicket;
    },
    onSuccess: (data) => {
      setExtracted(data);
      setPhase("extracted");
    },
    onError: () => toast.error("EOS could not extract ticket fields"),
  });

  const createMut = useMutation({
    mutationFn: () => createTicket({
      title: extracted!.title,
      description: [
        extracted!.description,
        extracted!.steps ? `\n**Steps to Reproduce:**\n${extracted!.steps}` : "",
        extracted!.expected ? `\n**Expected:** ${extracted!.expected}` : "",
        extracted!.actual ? `\n**Actual:** ${extracted!.actual}` : "",
      ].join(""),
      issue_type: extracted!.issue_type || "Bug",
      priority: extracted!.priority || "Medium",
      assignee: extracted!.assignee,
    }),
    onSuccess: () => {
      setPhase("created");
      toast.success("Ticket created!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Voice to Ticket</h2>
        <p className={styles.panelSub}>Speak your bug description. EOS transcribes and extracts a structured ticket.</p>
      </div>

      {!supported && (
        <div className={styles.unsupported}>
          Speech recognition is not supported in your browser. Try Chrome or Edge.
        </div>
      )}

      {/* Phase: idle or recording */}
      {(phase === "idle" || phase === "recording") && supported && (
        <div className={styles.voiceCenter}>
          <button
            className={`${styles.micBtn} ${phase === "recording" ? styles.micBtnActive : ""}`}
            onClick={phase === "idle" ? startRecording : stopRecording}
          >
            {phase === "recording" ? <RiStopCircleLine size={32} /> : <RiMicLine size={32} />}
          </button>
          <p className={styles.micLabel}>
            {phase === "idle" ? "Click to start recording" : "Recording… click to stop"}
          </p>
          {phase === "recording" && (
            <div className={styles.waveWrap}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className={styles.wave} style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}
          {liveText && <p className={styles.liveText}>"{liveText}"</p>}
          {transcript && <p className={styles.transcriptPreview}>{transcript}</p>}
        </div>
      )}

      {/* Phase: transcribed */}
      {phase === "transcribed" && (
        <div className={styles.transcriptCard}>
          <div className={styles.transcriptLabel}>Transcript</div>
          <p className={styles.transcriptText}>{transcript || "(No speech detected)"}</p>
          <div className={styles.transcriptActions}>
            <button className={styles.btnGhost} onClick={() => setPhase("idle")}>
              <RiRefreshLine size={14} /> Re-record
            </button>
            <button
              className={styles.btnPrimary}
              onClick={() => extractMut.mutate(transcript)}
              disabled={extractMut.isPending || !transcript}
            >
              {extractMut.isPending ? <><span className={styles.btnSpinner} /> Extracting…</> : <><RiSparklingLine size={13} /> Extract with EOS</>}
            </button>
          </div>
        </div>
      )}

      {/* Phase: extracted */}
      {phase === "extracted" && extracted && (
        <div className={styles.extractedCard}>
          <div className={styles.extractedHeader}>
            <RiSparklingLine size={14} color="var(--accent)" />
            <span>EOS extracted the following ticket — review and approve</span>
            <span className={styles.eosBadge}><RiSparklingLine size={9} /> EOS</span>
          </div>
          <div className={styles.fieldGrid}>
            <Field label="Title" value={extracted.title} onChange={(v) => setExtracted({ ...extracted, title: v })} />
            <div className={styles.fieldRow}>
              <FieldSelect label="Priority" value={extracted.priority} options={["Critical","High","Medium","Low"]} onChange={(v) => setExtracted({ ...extracted, priority: v })} />
              <FieldSelect label="Type" value={extracted.issue_type} options={["Bug","Task","Story"]} onChange={(v) => setExtracted({ ...extracted, issue_type: v })} />
            </div>
            {extracted.steps && <Field label="Steps to Reproduce" value={extracted.steps} multiline onChange={(v) => setExtracted({ ...extracted, steps: v })} />}
            {extracted.expected && <Field label="Expected Behavior" value={extracted.expected} onChange={(v) => setExtracted({ ...extracted, expected: v })} />}
            {extracted.actual && <Field label="Actual Behavior" value={extracted.actual} onChange={(v) => setExtracted({ ...extracted, actual: v })} />}
          </div>
          <div className={styles.extractedActions}>
            <button className={styles.btnGhost} onClick={() => setPhase("transcribed")}>← Edit Transcript</button>
            <button className={styles.btnPrimary} onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? <><span className={styles.btnSpinner} /> Creating…</> : <><RiCheckLine size={14} /> Create Ticket</>}
            </button>
          </div>
        </div>
      )}

      {/* Phase: created */}
      {phase === "created" && (
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✅</div>
          <p className={styles.successText}>Ticket created successfully!</p>
          <button className={styles.btnPrimary} onClick={() => { setPhase("idle"); setTranscript(""); setExtracted(null); }}>
            Record another
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {multiline
        ? <textarea className={styles.fieldTextarea} value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
        : <input className={styles.fieldInput} value={value} onChange={(e) => onChange(e.target.value)} />
      }
    </div>
  );
}

function FieldSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      <select className={styles.fieldSelect} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}
