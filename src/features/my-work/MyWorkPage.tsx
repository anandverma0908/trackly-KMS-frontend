import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useMyWork, fetchTicket } from "./useMyWork";
import { useMyWorkActions } from "./useMyWorkActions";
import { ticketToInitialData } from "@/utils/ticketHelpers";
import CreateTicketDrawer from "@/features/tickets/CreateTicketDrawer";

import EosAgentBrief from "./components/EosAgentBrief";
import NovaInsightFeed from "./components/NovaInsightFeed";
import SmartFocusBlock from "./components/SmartFocusBlock";
import AIPriorityQueue from "./components/AIPriorityQueue";
import NovaDeliveryForecast from "./components/NovaDeliveryForecast";
import NovaKnowledgeGaps from "./components/NovaKnowledgeGaps";
import Gen2ProactiveSection from "./components/Gen2ProactiveSection";
import Gen3PredictiveSection from "./components/Gen3PredictiveSection";
import AmbientAwarenessWidget from "./components/AmbientAwarenessWidget";
import SprintRiskWidget from "./components/SprintRiskWidget";
import TimeEnergyWidget from "./components/TimeEnergyWidget";
import QuickLogTimeModal from "./components/QuickLogTimeModal";
import QuickCommentModal from "./components/QuickCommentModal";

import styles from "./MyWorkPage.module.css";
import type { AITicket } from "./useMyWork";

export default function MyWorkPage() {
  const navigate = useNavigate();

  const {
    aiTickets,
    sprintRisk,
    insights,
    focusBlock,
    timeEnergy,
    morningBrief,
    briefChips,
    cognitiveData,
    ambientEvents,
    flowAnalysis,
    blockerPredictions,
    velocityPatterns,
    knowledgeGaps,
    loading,
    loadingGaps,
  } = useMyWork();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [logTimeTicket, setLogTimeTicket] = useState<AITicket | null>(null);
  const [commentTicket, setCommentTicket] = useState<AITicket | null>(null);

  const {
    handleLogTime,
    handleComment,
    handleQuickAction: _handleQuickAction,
  } = useMyWorkActions();

  const { data: selectedTicketData, isError: ticketError } = useQuery({
    queryKey: ["ticket", selectedKey],
    queryFn: () => fetchTicket(selectedKey!),
    enabled: !!selectedKey,
    retry: false,
  });

  useEffect(() => {
    if (ticketError && selectedKey) {
      toast.error(`Failed to load ticket ${selectedKey}`);
      setSelectedKey(null);
    }
  }, [ticketError, selectedKey]);

  const handleQuickAction = useCallback(
    (actionId: string, ticket: AITicket) => {
      _handleQuickAction(
        actionId,
        ticket,
        setSelectedKey,
        setCommentTicket,
        setLogTimeTicket,
      );
    },
    [_handleQuickAction],
  );

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={`${styles.header} fade-up`}>
        <div>
          <h1 className={styles.title}>My Work</h1>
        </div>
      </div>

      {/* EOS Agent Brief */}
      <EosAgentBrief text={morningBrief} chips={briefChips} loading={loading} />

      {/* EOS Insight Feed */}
      <NovaInsightFeed
        insights={insights}
        loading={loading}
        onTicketClick={setSelectedKey}
        onNavigate={navigate}
      />
        <SmartFocusBlock block={focusBlock} onTicketClick={setSelectedKey} />

      {/* Main grid */}
      <div className={`${styles.mainRow} fade-up-2`}>
        <AIPriorityQueue
          tickets={aiTickets}
          loading={loading}
          onQuickAction={handleQuickAction}
        />
        <AmbientAwarenessWidget ambientEvents={ambientEvents} />
      </div>

      {/* Gen 2: Proactive Intelligence */}
      <Gen2ProactiveSection
        aiTickets={aiTickets}
        flowAnalysis={flowAnalysis}
        blockerPredictions={blockerPredictions}
        sprintRisk={sprintRisk}
        loading={loading}
        onTicketClick={setSelectedKey}
      />

      {/* Gen 3: Predictive Intelligence */}
      <Gen3PredictiveSection
        cognitiveData={cognitiveData}
        velocityPatterns={velocityPatterns}
        loading={loading}
      />

      {/* Delivery row */}
      <div className={`${styles.deliveryRow} fade-up-3`}>
        <TimeEnergyWidget energy={timeEnergy} loading={loading} />
        <NovaDeliveryForecast risk={sprintRisk} />
        <SprintRiskWidget risk={sprintRisk} loading={loading} />
      </div>

      <NovaKnowledgeGaps gaps={knowledgeGaps} loading={loadingGaps} />

      {/* Quick Log Time Modal */}
      {logTimeTicket && (
        <QuickLogTimeModal
          ticket={logTimeTicket}
          onClose={() => setLogTimeTicket(null)}
          onSave={async (hours, comment) => {
            await handleLogTime(logTimeTicket.key, hours, comment);
            setLogTimeTicket(null);
          }}
        />
      )}

      {/* Quick Comment Modal */}
      {commentTicket && (
        <QuickCommentModal
          ticket={commentTicket}
          onClose={() => setCommentTicket(null)}
          onSend={async (text) => {
            await handleComment(commentTicket.key, text);
            setCommentTicket(null);
          }}
        />
      )}

      {/* Ticket Detail Drawer */}
      {selectedKey && (
        <CreateTicketDrawer
          open
          onClose={() => setSelectedKey(null)}
          ticketKey={selectedKey}
          initialData={
            selectedTicketData
              ? ticketToInitialData(selectedTicketData)
              : undefined
          }
        />
      )}
    </div>
  );
}
