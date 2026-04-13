import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTickets, updateTicketStatus } from "@/services/api";
import { IssueTypeBadge } from "@/components/ui/Badge";
import TicketDetailDrawer from "@/features/tickets/TicketDetailDrawer";
import TicketCreateModal from "@/features/tickets/TicketCreateModal";
import type { Ticket } from "@/types";
import styles from "./KanbanBoard.module.css";

const COLUMNS = [
  { id: "To Do",       label: "To Do",       color: "var(--text-3)" },
  { id: "In Progress", label: "In Progress", color: "var(--amber)" },
  { id: "In Review",   label: "In Review",   color: "var(--purple)" },
  { id: "Blocked",     label: "Blocked",     color: "var(--red)" },
  { id: "Done",        label: "Done",        color: "var(--green)" },
];

type Swimlane = "none" | "assignee" | "priority" | "pod";
const SWIMLANE_OPTIONS: { value: Swimlane; label: string }[] = [
  { value: "none",     label: "No grouping" },
  { value: "assignee", label: "By Assignee" },
  { value: "priority", label: "By Priority" },
  { value: "pod",      label: "By POD" },
];

export default function KanbanBoard() {
  const qc = useQueryClient();
  const [swimlane, setSwimlane] = useState<Swimlane>("none");
  const [dragging, setDragging]           = useState<Ticket | null>(null);
  const [detailTicket, setDetailTicket]   = useState<Ticket | null>(null);
  const [showCreate, setShowCreate]       = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { data, isLoading } = useQuery({
    queryKey: ["kanban-tickets"],
    queryFn: () => fetchTickets({}),
  });

  const statusMut = useMutation({
    mutationFn: ({ key, status }: { key: string; status: string }) =>
      updateTicketStatus(key, status),
    onSettled: () => qc.invalidateQueries({ queryKey: ["kanban-tickets"] }),
  });

  const tickets = data?.tickets ?? [];

  // Group by swimlane
  const groups = useMemo(() => {
    if (swimlane === "none") return [{ key: "all", label: null, tickets }];
    const map = new Map<string, Ticket[]>();
    tickets.forEach((t) => {
      const k = (t as any)[swimlane] || "Unassigned";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    return Array.from(map.entries()).map(([key, tickets]) => ({ key, label: key, tickets }));
  }, [tickets, swimlane]);

  function handleDragStart(event: DragStartEvent) {
    const t = tickets.find((t) => t.key === event.active.id);
    if (t) setDragging(t);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const { active, over } = event;
    if (!over) return;
    const ticketKey = active.id as string;
    const overId    = over.id as string;

    // If dropped over a column header
    const col = COLUMNS.find((c) => c.id === overId);
    if (col) {
      statusMut.mutate({ key: ticketKey, status: col.id });
      return;
    }

    // If dropped over another ticket — move to same column
    const targetTicket = tickets.find((t) => t.key === overId);
    if (targetTicket && targetTicket.status !== tickets.find((t) => t.key === ticketKey)?.status) {
      statusMut.mutate({ key: ticketKey, status: targetTicket.status });
    }
  }

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <span className={styles.spinner} /> Loading board…
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Kanban Board</h1>
          <p className={styles.subtitle}>{tickets.length} tickets across {COLUMNS.length} columns</p>
        </div>
        <div className={styles.controls}>
          <div className={styles.swimlaneControl}>
            <span className={styles.swimlaneLabel}>Swimlanes:</span>
            {SWIMLANE_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={`${styles.swimlaneBtn} ${swimlane === o.value ? styles.swimlaneBtnActive : ""}`}
                onClick={() => setSwimlane(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + New Ticket
          </button>
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={styles.boardWrap}>
          {groups.map((group) => (
            <div key={group.key} className={styles.swimlaneRow}>
              {group.label && (
                <div className={styles.swimlaneHeader}>{group.label}</div>
              )}
              <div className={styles.board}>
                {COLUMNS.map((col) => {
                  const colTickets = group.tickets.filter((t) => t.status === col.id);
                  return (
                    <KanbanColumn
                      key={col.id}
                      column={col}
                      tickets={colTickets}
                      onTicketClick={setDetailTicket}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DragOverlay>
          {dragging && <TicketCardContent ticket={dragging} />}
        </DragOverlay>
      </DndContext>

      {detailTicket && (
        <TicketDetailDrawer ticket={detailTicket} onClose={() => setDetailTicket(null)} />
      )}
      {showCreate && (
        <TicketCreateModal onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

/* ── Column ── */
function KanbanColumn({
  column, tickets, onTicketClick,
}: {
  column: { id: string; label: string; color: string };
  tickets: Ticket[];
  onTicketClick: (t: Ticket) => void;
}) {
  return (
    <div className={styles.column} id={column.id}>
      <div className={styles.columnHeader}>
        <span className={styles.columnDot} style={{ background: column.color }} />
        <span className={styles.columnLabel}>{column.label}</span>
        <span className={styles.columnCount}>{tickets.length}</span>
      </div>

      <SortableContext
        items={tickets.map((t) => t.key)}
        strategy={verticalListSortingStrategy}
      >
        <div className={styles.cards}>
          {tickets.map((t) => (
            <SortableCard key={t.key} ticket={t} onClick={() => onTicketClick(t)} />
          ))}
          {tickets.length === 0 && (
            <div className={styles.emptyCol}>Drop here</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

/* ── Sortable Card ── */
function SortableCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TicketCardContent ticket={ticket} onClick={onClick} />
    </div>
  );
}

/* ── Card Content ── */
function TicketCardContent({ ticket, onClick }: { ticket: Ticket; onClick?: () => void }) {
  const initials = ticket.assignee?.split(" ").map((n) => n[0]).join("").slice(0, 2) ?? "?";
  const priorityColor: Record<string, string> = {
    Highest: "var(--red)",
    High:    "var(--amber)",
    Medium:  "var(--accent)",
    Low:     "var(--text-3)",
    Lowest:  "var(--text-3)",
  };

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.cardHeader}>
        <span className={styles.cardKey}>{ticket.key}</span>
        <IssueTypeBadge type={ticket.issue_type} />
      </div>
      <p className={styles.cardTitle}>{ticket.summary}</p>
      <div className={styles.cardFooter}>
        <div
          className={styles.priorityDot}
          style={{ background: priorityColor[ticket.priority] ?? "var(--text-3)" }}
          title={ticket.priority}
        />
        {ticket.hours_spent > 0 && (
          <span className={styles.cardHours}>{ticket.hours_spent.toFixed(1)}h</span>
        )}
        <div className={styles.cardSpacer} />
        {ticket.pod && <span className={styles.cardPod}>{ticket.pod}</span>}
        <div className={styles.avatar} title={ticket.assignee}>{initials}</div>
      </div>
    </div>
  );
}
