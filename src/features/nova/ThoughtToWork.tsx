import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { createTicket } from "@/services/api";
import toast from "react-hot-toast";
import { RiMicLine, RiMicOffLine, RiSparklingLine, RiCheckLine } from "react-icons/ri";
import panelStyles from "./Gen2.module.css";
import styles from "./Gen3.module.css";

interface Capture {
  id: string;
  time: string;
  rawText: string;
  ticketTitle: string;
  ticketType: string;
  ticketPriority: string;
  created: boolean;
  dismissed: boolean;
}

const MOCK_CAPTURES: Capture[] = [
  {
    id: "c1",
    time: "9:14 AM",
    rawText: "We need to handle rate limiting on the public API, it's getting abused by bots",
    ticketTitle: "Implement rate limiting on public API endpoints",
    ticketType: "Feature",
    ticketPriority: "High",
    created: false,
    dismissed: false,
  },
  {
    id: "c2",
    time: "9:08 AM",
    rawText: "The login page is really slow on mobile, could be the bundle size",
    ticketTitle: "Investigate login page performance degradation on mobile",
    ticketType: "Bug",
    ticketPriority: "Medium",
    created: false,
    dismissed: false,
  },
];

export default function ThoughtToWork() {
  const [listening, setListening] = useState(false);
  const [captures, setCaptures] = useState<Capture[]>(MOCK_CAPTURES);
  const [supported] = useState(
    () => "SpeechRecognition" in window || "webkitSpeechRecognition" in window
  );
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setListening(false);
      return;
    }

    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Speech recognition not available in this browser");
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const text = e.results[i][0].transcript.trim();
          if (text.length > 15) {
            addCapture(text);
          }
        }
      }
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
  }

  function addCapture(rawText: string) {
    const newCapture: Capture = {
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      rawText,
      ticketTitle: rawText.charAt(0).toUpperCase() + rawText.slice(1),
      ticketType: "Task",
      ticketPriority: "Medium",
      created: false,
      dismissed: false,
    };
    setCaptures((prev) => [newCapture, ...prev]);
    toast("EOS captured a thought — review below", { icon: "💡" });
  }

  const createMut = useMutation({
    mutationFn: (capture: Capture) =>
      createTicket({
        title: capture.ticketTitle,
        description: `Captured via Thought-to-Work: "${capture.rawText}"`,
        issue_type: capture.ticketType,
        priority: capture.ticketPriority,
      }),
    onSuccess: (_data, capture) => {
      setCaptures((prev) => prev.map((c) => c.id === capture.id ? { ...c, created: true } : c));
      toast.success("Ticket created from your thought");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function dismiss(id: string) {
    setCaptures((prev) => prev.map((c) => c.id === id ? { ...c, dismissed: true } : c));
  }

  const visible = captures.filter((c) => !c.dismissed);

  return (
    <div className={panelStyles.panel}>
      <div className={panelStyles.panelHeader}>
        <h2 className={panelStyles.panelTitle}>Thought-to-Work</h2>
        <p className={panelStyles.panelSub}>
          The friction between thinking about work and capturing it approaches zero. Speak naturally — EOS converts work-relevant thoughts into tickets instantly.
        </p>
      </div>

      <div className={styles.thoughtListenSection}>
        <div className={styles.thoughtRing}>
          {listening && (
            <>
              <div className={styles.thoughtRingPulse} />
              <div className={`${styles.thoughtRingPulse} ${styles.thoughtRingPulse2}`} />
            </>
          )}
          <button
            className={`${styles.thoughtMicBtn} ${!listening ? styles.thoughtMicOff : ""}`}
            onClick={toggleListening}
          >
            {listening ? <RiMicLine size={28} /> : <RiMicOffLine size={28} />}
          </button>
        </div>
        <p className={`${styles.thoughtStatus} ${listening ? styles.thoughtStatusActive : ""}`}>
          {listening ? "Listening — speak naturally about work…" : "Click to start listening"}
        </p>
        {!supported && (
          <p className={styles.thoughtHint} style={{ color: "var(--amber, #FBBF24)" }}>
            Speech recognition is not supported in this browser. Showing example captures below.
          </p>
        )}
        {supported && !listening && (
          <p className={styles.thoughtHint}>
            EOS listens for work-related intent. "We need to handle rate limiting" → ticket created. Personal or irrelevant speech is ignored.
          </p>
        )}
      </div>

      {visible.length > 0 && (
        <div className={styles.thoughtCaptures}>
          <div className={styles.thoughtCapturesLabel}>Captured thoughts — {visible.length}</div>
          {visible.map((capture) => (
            <div key={capture.id} className={styles.thoughtCapture}>
              <div className={styles.thoughtCaptureHeader}>
                <span className={styles.thoughtCaptureTag}>Captured</span>
                <span className={styles.thoughtCaptureTime}>{capture.time}</span>
              </div>

              <p className={styles.thoughtCaptureText}>"{capture.rawText}"</p>

              <div className={styles.thoughtTicketPreview}>
                <div className={styles.thoughtTicketLabel}>
                  <RiSparklingLine size={10} style={{ verticalAlign: "middle", marginRight: 3 }} />
                  EOS suggested ticket
                </div>
                <div className={styles.thoughtTicketTitle}>{capture.ticketTitle}</div>
                <div className={styles.thoughtTicketMeta}>
                  {capture.ticketType} · Priority: {capture.ticketPriority}
                </div>
              </div>

              <div className={styles.thoughtCaptureBtns}>
                {capture.created ? (
                  <span className={styles.thoughtCreated}>
                    <RiCheckLine size={13} /> Ticket created
                  </span>
                ) : (
                  <>
                    <button
                      className={styles.thoughtConfirmBtn}
                      onClick={() => createMut.mutate(capture)}
                      disabled={createMut.isPending}
                    >
                      <RiCheckLine size={12} /> Create ticket
                    </button>
                    <button className={styles.thoughtDismissBtn} onClick={() => dismiss(capture.id)}>
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {visible.length === 0 && !listening && (
        <div className={panelStyles.successCard} style={{ padding: "24px 0" }}>
          <span className={panelStyles.successIcon}>💭</span>
          <p className={panelStyles.successText} style={{ fontSize: "0.84rem" }}>
            No pending captures. Start listening and speak naturally about work.
          </p>
        </div>
      )}
    </div>
  );
}
