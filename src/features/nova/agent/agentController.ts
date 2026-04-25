/* ══════════════════════════════════════════════════════
   NOVA AGENT — CONTROLLER
   Delegates the agent loop to POST /api/nova/agent.
   The backend runs tool execution and LLM reasoning;
   the frontend just fires one request and streams step
   notifications back via the onStep callback.
══════════════════════════════════════════════════════ */
import { novaAgent } from "@/services/api";
import type { AgentResult, AgentStep } from "./agentTypes";

/**
 * Run the NOVA agent loop for a single user message.
 *
 * The entire loop (LLM calls + tool execution) runs server-side.
 * `onStep` is called once per tool step as they arrive in the
 * response, so the UI can show live progress.
 *
 * @param userMessage       The user's request text.
 * @param conversationHistory  Prior turns for continuity (trimmed server-side).
 * @param onStep            Optional callback invoked for each tool step.
 */
export async function runAgentLoop(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
  onStep?: (step: AgentStep) => void,
): Promise<AgentResult> {
  const raw = await novaAgent(userMessage, conversationHistory);

  // Map backend steps to frontend AgentStep shape and fire callbacks
  const steps: AgentStep[] = raw.steps.map((s, i) => {
    const step: AgentStep = {
      iteration: s.iteration ?? i,
      timestamp: new Date(s.timestamp ?? Date.now()),
      toolCall:  s.tool_call
        ? {
            action:     s.tool_call.action,
            parameters: s.tool_call.parameters ?? {},
            reasoning:  s.tool_call.reasoning,
          }
        : undefined,
      toolResult: s.tool_result
        ? {
            tool:    s.tool_call?.action ?? "",
            success: s.tool_result.success,
            data:    s.tool_result.data,
            error:   s.tool_result.error,
          }
        : undefined,
      finalText: s.final_text,
    };
    onStep?.(step);
    return step;
  });

  return {
    answer:     raw.answer,
    steps,
    toolsUsed:  raw.tools_used ?? [],
    createdTicket: raw.created_ticket
      ? {
          id:         raw.created_ticket.id,
          title:      raw.created_ticket.title,
          priority:   raw.created_ticket.priority,
          issue_type: raw.created_ticket.issue_type,
        }
      : undefined,
  };
}
