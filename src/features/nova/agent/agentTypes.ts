/* ══════════════════════════════════════════════════════
   NOVA AGENT — TYPE DEFINITIONS
══════════════════════════════════════════════════════ */

export type KnownTool =
  | "search"
  | "create_ticket"
  | "create_wiki_page"
  | "generate_standup"
  | "final_answer";

export interface ToolCall {
  /** Tool name from KnownTool or any future extension */
  action: string;
  parameters: Record<string, unknown>;
  /** LLM's self-reported reason for choosing this tool */
  reasoning?: string;
}

export interface ToolResult {
  tool: string;
  success: boolean;
  data: unknown;
  error?: string;
}

export interface AgentStep {
  iteration: number;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  /** Set only on the final iteration when LLM returns plain text */
  finalText?: string;
  timestamp: Date;
}


export interface AgentResult {
  answer: string;
  steps: AgentStep[];
  toolsUsed: string[];
  /** Populated when the agent creates a ticket via create_ticket tool */
  createdTicket?: { id: string; title: string; priority: string; issue_type: string };
}
