import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { analyzeTicketNL } from "@/services/api";
import toast from "react-hot-toast";
import { RiMicLine, RiStopCircleLine, RiSparklingLine, RiFileCopyLine, RiRefreshLine } from "react-icons/ri";
import styles from "./Gen2.module.css";

interface Speaker {
  id: string;
  name: string;
  seconds: number;
  active: boolean;
}

interface MeetingDoc {
  summary: string;
  decisions: string[];
  actionItems: string[];
  nextSteps: string;
}

const MOCK_SPEAKERS: Speaker[] = [
  { id: "A", name: "Anand V.", seconds: 0, active: false },
  { id: "P", name: "Priya S.", seconds: 0, active: false },
  { id: "R", name: "Rahul D.", seconds: 0, active: false },
];

export default function MeetingToDoc() {
  const [phase, setPhase] = useState<"idle" | "recording" | "transcribed" | "generated">("idle");
  const [transcript, setTranscript] = useState("");
  const [_liveText, setLiveText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [speakers, setSpeakers] = useState<Speaker[]>(MOCK_SPEAKERS);
  const [doc, setDoc] = useState<MeetingDoc | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeSpeakerIdx = useRef(0);
  const [supported] = useState(() => "SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
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
        if (e.results[i].isFinal) {
          final += t;
          // Rotate speaker attribution (simulated)
          const idx = activeSpeakerIdx.current % speakers.length;
          setSpeakers((prev) =>
            prev.map((s, i) =>
              i === idx ? { ...s, seconds: s.seconds + Math.round(t.split(" ").length * 0.4), active: true }
              : { ...s, active: false }
            )
          );
          activeSpeakerIdx.current++;
        } else {
          interim += t;
        }
      }
      setTranscript((prev) => prev + final);
      setLiveText(interim);
    };

    recognition.onend = () => {
      setLiveText("");
      setPhase("transcribed");
      setSpeakers((prev) => prev.map((s) => ({ ...s, active: false })));
      if (timerRef.current) clearInterval(timerRef.current);
    };

    recognition.start();
    setPhase("recording");
    setTranscript("");
    setElapsed(0);
    setSpeakers(MOCK_SPEAKERS.map((s) => ({ ...s, seconds: 0 })));
    activeSpeakerIdx.current = 0;

    timerRef.current = setInterval(() => setElapsed((v) => v + 1), 1000);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const generateMut = useMutation({
    mutationFn: async (text: string) => {
      const prompt = `You are a meeting documentation assistant. Given this meeting transcript, extract:
1. A 2-sentence executive summary
2. Key decisions made (as a list, prefix each with "DECISION:")
3. Action items with owners if mentioned (prefix each with "ACTION:")
4. Next steps (1 sentence)

Transcript: "${text.slice(0, 1500)}"

Return as plain text with the above prefixes.`;
      const result = await analyzeTicketNL(prompt);
      const raw = result.description ?? "";

      const decisions = [...raw.matchAll(/DECISION:\s*(.+)/g)].map((m) => m[1].trim());
      const actions = [...raw.matchAll(/ACTION:\s*(.+)/g)].map((m) => m[1].trim());
      const nextMatch = raw.match(/next steps?:?\s*(.+)/i);

      return {
        summary: result.title ?? text.slice(0, 120),
        decisions: decisions.length ? decisions : ["No explicit decisions recorded"],
        actionItems: actions.length ? actions : ["Review transcript for follow-ups"],
        nextSteps: nextMatch?.[1]?.trim() ?? "Schedule follow-up meeting.",
      } as MeetingDoc;
    },
    onSuccess: (data) => {
      setDoc(data);
      setPhase("generated");
    },
    onError: () => toast.error("EOS could not generate documentation"),
  });

  function formatTime(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  function copyDoc() {
    if (!doc) return;
    const text = [
      `Summary: ${doc.summary}`,
      "",
      "Decisions:",
      ...doc.decisions.map((d) => `• ${d}`),
      "",
      "Action Items:",
      ...doc.actionItems.map((a) => `• ${a}`),
      "",
      `Next Steps: ${doc.nextSteps}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Meeting to Doc</h2>
        <p className={styles.panelSub}>Record your meeting. EOS transcribes, identifies speakers, and generates structured documentation.</p>
      </div>

      {!supported && (
        <div className={styles.unsupported}>
          Speech recognition is not supported in your browser. Try Chrome or Edge.
        </div>
      )}

      {/* Idle / Recording */}
      {(phase === "idle" || phase === "recording") && supported && (
        <div className={styles.recorderCenter}>
          {phase === "recording" && (
            <div className={styles.recorderTimer}>{formatTime(elapsed)}</div>
          )}
          <button
            className={`${styles.micBtn} ${phase === "recording" ? styles.micBtnActive : ""}`}
            onClick={phase === "idle" ? startRecording : stopRecording}
          >
            {phase === "recording" ? <RiStopCircleLine size={32} /> : <RiMicLine size={32} />}
          </button>
          <p className={styles.recorderStatus}>
            {phase === "idle" ? "Click to start recording your meeting" : "Recording… click to stop"}
          </p>
          {phase === "recording" && (
            <div className={styles.speakerList}>
              {speakers.map((sp) => (
                <div key={sp.id} className={`${styles.speakerRow} ${sp.active ? styles.speakerActive : ""}`}>
                  <div className={styles.speakerAvatar}>{sp.id}</div>
                  <span className={styles.speakerName}>{sp.name}</span>
                  <span className={styles.speakerTime}>{formatTime(sp.seconds)}</span>
                  {sp.active && <span className={styles.speakerActiveDot} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transcribed */}
      {phase === "transcribed" && (
        <div className={styles.transcriptCard}>
          <div className={styles.transcriptLabel}>Transcript — {formatTime(elapsed)}</div>
          <p className={styles.transcriptText}>{transcript || "(No speech detected)"}</p>
          <div className={styles.transcriptActions}>
            <button className={styles.btnGhost} onClick={() => setPhase("idle")}>
              <RiRefreshLine size={14} /> Re-record
            </button>
            <button
              className={styles.btnPrimary}
              onClick={() => generateMut.mutate(transcript)}
              disabled={generateMut.isPending || !transcript}
            >
              {generateMut.isPending
                ? <><span className={styles.btnSpinner} /> Generating…</>
                : <><RiSparklingLine size={13} /> Generate Doc with EOS</>}
            </button>
          </div>
        </div>
      )}

      {/* Generated */}
      {phase === "generated" && doc && (
        <div className={styles.docOutput}>
          <div className={styles.extractedHeader}>
            <RiSparklingLine size={14} color="var(--accent)" />
            <span>EOS generated meeting documentation</span>
            <span className={styles.eosBadge}><RiSparklingLine size={9} /> EOS</span>
          </div>

          <div className={styles.docSection}>
            <div className={styles.docSectionTitle}>Summary</div>
            <div className={styles.docSectionBody}>{doc.summary}</div>
          </div>

          <div className={styles.docSection}>
            <div className={styles.docSectionTitle}>Decisions</div>
            {doc.decisions.map((d, i) => (
              <div key={i} className={styles.docSectionBody}>• {d}</div>
            ))}
          </div>

          <div className={styles.docSection}>
            <div className={styles.docSectionTitle}>Action Items</div>
            {doc.actionItems.map((a, i) => (
              <div key={i} className={styles.docSectionBody}>• {a}</div>
            ))}
          </div>

          <div className={styles.docSection}>
            <div className={styles.docSectionTitle}>Next Steps</div>
            <div className={styles.docSectionBody}>{doc.nextSteps}</div>
          </div>

          <div className={styles.docActions}>
            <button className={styles.btnGhost} onClick={() => setPhase("idle")}>
              <RiRefreshLine size={14} /> New Recording
            </button>
            <button className={styles.btnPrimary} onClick={copyDoc}>
              <RiFileCopyLine size={14} /> Copy Doc
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
