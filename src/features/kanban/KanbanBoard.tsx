import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTickets, updateTicketStatus, fetchTicket } from "@/services/api";
import { IssueTypeBadge } from "@/components/ui/Badge";
import CreateTicketDrawer from "@/features/tickets/ui/CreateTicketDrawer";
import type { Ticket } from "@/types";
import styles from "./KanbanBoard.module.scss";

const COLUMNS = [
  { id: "To Do", label: "To Do", color: "var(--text-3)" },
  { id: "In Progress", label: "In Progress", color: "var(--amber)" },
  { id: "In Review", label: "In Review", color: "var(--purple)" },
  { id: "Blocked", label: "Blocked", color: "var(--red)" },
  { id: "Done", label: "Done", color: "var(--green)" },
];

const COLUMN_IDS = new Set(COLUMNS.map((c) => c.id));

type Swimlane = "none" | "assignee" | "priority" | "pod";
const SWIMLANE_OPTIONS: { value: Swimlane; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "assignee", label: "By Assignee" },
  { value: "priority", label: "By Priority" },
  { value: "pod", label: "By POD" },
];

export default function KanbanBoard() {
  const qc = useQueryClient();
  const [swimlane, setSwimlane] = useState<Swimlane>("none");
  const [dragging, setDragging] = useState<Ticket | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [editTicketKey, setEditTicketKey] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Optimistic local status overrides — applied immediately on drop
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>(
    {},
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const { data, isLoading } = useQuery({
    queryKey: ["kanban-tickets"],
    queryFn: () => fetchTickets({}),
  });

  const { data: editTicketData } = useQuery({
    queryKey: ["ticket", editTicketKey],
    queryFn: () => fetchTicket(editTicketKey!),
    enabled: !!editTicketKey,
  });

  const statusMut = useMutation({
    mutationFn: ({ key, status }: { key: string; status: string }) =>
      updateTicketStatus(key, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
    },
    onError: (_err, { key }) => {
      // Revert optimistic update
      setLocalStatuses((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
  });

  // Merge server data with local optimistic overrides
  const tickets = useMemo(
    () =>
      (data?.tickets ?? []).map((t) => ({
        ...t,
        status: localStatuses[t.key] ?? t.status,
      })),
    [data, localStatuses],
  );

  const groups = useMemo(() => {
    if (swimlane === "none") return [{ key: "all", label: null, tickets }];
    const map = new Map<string, Ticket[]>();
    tickets.forEach((t) => {
      const k = ((t as Record<string, unknown>)[swimlane] as string) || "—";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    return Array.from(map.entries()).map(([key, tix]) => ({
      key,
      label: key,
      tickets: tix,
    }));
  }, [tickets, swimlane]);

  function handleDragStart(event: DragStartEvent) {
    const t = tickets.find((t) => t.key === event.active.id);
    if (t) setDragging(t);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over) {
      setOverColumnId(null);
      return;
    }
    const overId = over.id as string;
    if (COLUMN_IDS.has(overId)) {
      setOverColumnId(overId);
    } else {
      // over a ticket — find which column it belongs to
      const target = tickets.find((t) => t.key === overId);
      setOverColumnId(target?.status ?? null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDragging(null);
    setOverColumnId(null);
    if (!over) return;

    const ticketKey = active.id as string;
    const overId = over.id as string;
    const current = tickets.find((t) => t.key === ticketKey);

    let newStatus: string | null = null;

    if (COLUMN_IDS.has(overId)) {
      // Dropped directly on a column droppable
      if (overId !== current?.status) newStatus = overId;
    } else {
      // Dropped on a ticket — adopt its column status
      const target = tickets.find((t) => t.key === overId);
      if (target && target.status !== current?.status)
        newStatus = target.status;
    }

    if (!newStatus) return;

    // Apply optimistically
    setLocalStatuses((prev) => ({ ...prev, [ticketKey]: newStatus! }));
    statusMut.mutate({ key: ticketKey, status: newStatus });
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
          <p className={styles.subtitle}>
            {tickets.length} tickets across {COLUMNS.length} columns
          </p>
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
          <button
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
          >
            + New Ticket
          </button>
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
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
                  const colTickets = group.tickets.filter(
                    (t) => t.status === col.id,
                  );
                  return (
                    <KanbanColumn
                      key={col.id}
                      column={col}
                      tickets={colTickets}
                      isOver={overColumnId === col.id}
                      onTicketClick={(t) => {
                        if (!dragging) setEditTicketKey(t.key);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
          {dragging && <TicketCardContent ticket={dragging} />}
        </DragOverlay>
      </DndContext>

      <CreateTicketDrawer
        open={!!editTicketKey}
        onClose={() => setEditTicketKey(null)}
        ticketKey={editTicketKey ?? undefined}
        initialData={
          editTicketData
            ? {
                title: editTicketData.summary,
                description: (editTicketData as any).description ?? "",
                issue_type: editTicketData.issue_type,
                priority: editTicketData.priority,
                status: editTicketData.status,
                assignee: editTicketData.assignee,
                reporter: (editTicketData as any).reporter ?? "",
                pod: editTicketData.pod,
                client: editTicketData.client,
                story_points: editTicketData.story_points,
                labels: editTicketData.labels,
                due_date: editTicketData.due_date,
                epic: (editTicketData as any).epic ?? "",
                parent: (editTicketData as any).parent ?? "",
                originalEst: editTicketData.original_estimate_hours
                  ? String(editTicketData.original_estimate_hours)
                  : "",
                timeSpent: editTicketData.hours_spent
                  ? String(editTicketData.hours_spent)
                  : "",
                remaining: editTicketData.remaining_estimate_hours
                  ? String(editTicketData.remaining_estimate_hours)
                  : "",
              }
            : undefined
        }
      />

      <CreateTicketDrawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}

/* Column */
function KanbanColumn({
  column,
  tickets,
  isOver,
  onTicketClick,
}: {
  column: { id: string; label: string; color: string };
  tickets: Ticket[];
  isOver: boolean;
  onTicketClick: (t: Ticket) => void;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <div
      className={styles.column}
      style={
        isOver
          ? {
              borderColor: column.color,
              boxShadow: `0 0 0 1px ${column.color}33`,
            }
          : {}
      }
    >
      <div className={styles.columnHeader}>
        <span
          className={styles.columnDot}
          style={{ background: column.color }}
        />
        <span className={styles.columnLabel}>{column.label}</span>
        <span className={styles.columnCount}>{tickets.length}</span>
      </div>

      <SortableContext
        items={tickets.map((t) => t.key)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={styles.cards}
          style={isOver ? { background: `${column.color}0d` } : {}}
        >
          {tickets.map((t) => (
            <SortableCard
              key={t.key}
              ticket={t}
              onClick={() => onTicketClick(t)}
            />
          ))}
          {tickets.length === 0 && (
            <div
              className={styles.emptyCol}
              style={
                isOver ? { borderColor: column.color, color: column.color } : {}
              }
            >
              Drop here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

/* Sortable Card */
function SortableCard({
  ticket,
  onClick,
}: {
  ticket: Ticket;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.key });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        cursor: "grab",
      }}
      {...attributes}
      {...listeners}
    >
      <TicketCardContent ticket={ticket} onClick={onClick} />
    </div>
  );
}

/* Card Content */
function TicketCardContent({
  ticket,
  onClick,
}: {
  ticket: Ticket;
  onClick?: () => void;
}) {
  const initials = (ticket.assignee || "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  const priorityColor: Record<string, string> = {
    Highest: "var(--red)",
    High: "var(--amber)",
    Medium: "var(--accent)",
    Low: "var(--text-3)",
    Lowest: "var(--text-3)",
  };

  return (
    <div
      className={styles.card}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <div className={styles.cardHeader}>
        <span className={styles.cardKey}>{ticket.key}</span>
        <IssueTypeBadge type={ticket.issue_type} />
      </div>
      <p className={styles.cardTitle}>{ticket.summary}</p>
      <div className={styles.cardFooter}>
        <div
          className={styles.priorityDot}
          style={{
            background: priorityColor[ticket.priority] ?? "var(--text-3)",
          }}
          title={ticket.priority}
        />
        {ticket.hours_spent > 0 && (
          <span className={styles.cardHours}>
            {ticket.hours_spent.toFixed(1)}h
          </span>
        )}
        <div className={styles.cardSpacer} />
        {ticket.pod && <span className={styles.cardPod}>{ticket.pod}</span>}
        <div className={styles.avatar} title={ticket.assignee}>
          {initials}
        </div>
      </div>
    </div>
  );
}
