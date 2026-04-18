import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFilters } from "@/services/api";
import { QUERY_KEYS } from "@/config/queryKeys";
import { useManualEntry } from "./model/useManualEntry";
import StepInput from "./ui/StepInput";
import StepParsing from "./ui/StepParsing";
import StepPreview from "./ui/StepPreview";
import StepConfirmed from "./ui/StepConfirmed";
import MyTimesheets from "./ui/MyTimesheets";
import styles from "./ManualEntryPage.module.scss";
import { BsFillCalendar2EventFill } from "react-icons/bs";
import { PiStarFourFill } from "react-icons/pi";

const STEP_LABELS = ["Input", "Parsing", "Preview", "Confirmed"];
const STEP_IDS = ["input", "parsing", "preview", "confirmed"] as const;

type Tab = "entry" | "timesheets";

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

  const stepIndex = STEP_IDS.indexOf(step);

  return (
    <div className={styles.page}>
      {/* Page header */}
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
            {"Timesheets"}
          </button>
        </div>
      </div>

      {/* Tab toggle */}

      {/* Tab: AI Entry */}
      {activeTab === "entry" && (
        <>
          {/* Progress stepper */}
          <div className={`${styles.stepper} fade-up-1`}>
            {STEP_LABELS.map((label, i) => {
              const isDone = i < stepIndex;
              const isActive = i === stepIndex;
              return (
                <div key={label} className={styles.stepperItem}>
                  <div
                    className={`${styles.stepperDot}
                    ${isDone ? styles.stepperDotDone : ""}
                    ${isActive ? styles.stepperDotActive : ""}
                  `}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  <div
                    className={`${styles.stepperLabel}
                    ${isActive ? styles.stepperLabelActive : ""}
                    ${isDone ? styles.stepperLabelDone : ""}
                  `}
                  >
                    {label}
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div
                      className={`${styles.stepperLine} ${isDone ? styles.stepperLineDone : ""}`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="fade-up-2">
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

      {/* Tab: Timesheets */}
      {activeTab === "timesheets" && (
        <div className="fade-up-1">
          <MyTimesheets />
        </div>
      )}
    </div>
  );
}
