import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFilters } from "@/services/api";
import { QUERY_KEYS } from "@/config/queryKeys";
import { useManualEntry } from "./useManualEntry";
import StepInput from "./StepInput";
import StepParsing from "./StepParsing";
import StepPreview from "./StepPreview";
import StepConfirmed from "./StepConfirmed";
import MyTimesheets from "./MyTimesheets";
import { WeeklyTab, ManualTab } from "@/features/timetrack/WeeklyTimeGrid";
import styles from "./ManualEntryPage.module.css";
import { BsFillCalendar2EventFill } from "react-icons/bs";
import { PiStarFourFill } from "react-icons/pi";
import { RiTableLine } from "react-icons/ri";

type Tab = "entry" | "timesheets" | "weekly";

export default function ManualEntryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("entry");
  const { data: filtersData } = useQuery({
    queryKey: QUERY_KEYS.filters(),
    queryFn: fetchFilters,
  });

  const pods = filtersData?.pods ?? [];
  const clients = filtersData?.clients ?? [];

  const {
    step,
    setStep: _setStep,
    inputText,
    setInputText,
    parsedRows,
    confirmedRows,
    parsingStep,
    parsingSteps,
    warnings,
    selectedRole,
    setSelectedRole,
    personName,
    totalHours,
    parse,
    updateRow,
    deleteRow,
    addRow,
    confirm,
    reset,
  } = useManualEntry(pods, clients);

  return (
    <div className={styles.page}>
      {/* ── Page header ── */}
      <div className={`${styles.header} fade-up`}>
        <div>
          <h1 className={styles.title}>Timelog</h1>
          <p className={styles.subtitle}>
            Log your work with AI or review your timesheet history.
          </p>
        </div>
        <div className={`${styles.tabBar} fade-up-1`}>
          <button
            className={`${styles.tab} ${activeTab === "entry" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("entry")}
          >
            <PiStarFourFill />
            AI Entry
          </button>
          <button
            className={`${styles.tab} ${activeTab === "timesheets" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("timesheets")}
          >
            <BsFillCalendar2EventFill />
            Timesheets
          </button>
          <button
            className={`${styles.tab} ${activeTab === "weekly" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("weekly")}
          >
            <RiTableLine />
            Ticket Time
          </button>
        </div>
      </div>

      {/* ── Tab toggle ── */}

      {/* ── Tab: AI Entry ── */}
      {activeTab === "entry" && (
        <>
          <div className="fade-up-1">
            {step === "input" && (
              <StepInput
                inputText={inputText}
                setInputText={setInputText}
                selectedRole={selectedRole}
                setRole={setSelectedRole}
                personName={personName}
                onParse={parse}
              />
            )}
            {step === "parsing" && (
              <StepParsing
                inputText={inputText}
                parsingStep={parsingStep}
                parsingSteps={parsingSteps}
              />
            )}
            {step === "preview" && (
              <StepPreview
                rows={parsedRows}
                totalHours={totalHours}
                warnings={warnings}
                pods={pods}
                clients={clients}
                onUpdate={updateRow}
                onDelete={deleteRow}
                onAddRow={addRow}
                onConfirm={confirm}
                onBack={reset}
              />
            )}
            {step === "confirmed" && (
              <StepConfirmed
                entries={confirmedRows}
                totalHours={totalHours}
                onAddMore={reset}
              />
            )}
          </div>
        </>
      )}

      {/* ── Tab: Timesheets ── */}
      {activeTab === "timesheets" && (
        <div className="fade-up-1">
          <MyTimesheets />
        </div>
      )}

      {/* ── Tab: Ticket Time ── */}
      {activeTab === "weekly" && (
        <div className={`${styles.ticketTimeLayout} fade-up-1`}>
          <div className={styles.ticketGridPanel}>
            <WeeklyTab />
          </div>
          <div className={styles.ticketFormPanel}>
            <ManualTab />
          </div>
        </div>
      )}
    </div>
  );
}
