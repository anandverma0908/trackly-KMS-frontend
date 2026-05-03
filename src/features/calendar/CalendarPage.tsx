import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO,
  isWithinInterval,
} from "date-fns";
import {
  RiCalendarLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiLayoutGridLine,
  RiListCheck,
} from "react-icons/ri";
import { fetchSprints, fetchTickets } from "@/services/api";
import type { Sprint, Ticket } from "@/types";
import { getPodColor } from "@/config/themes";
import styles from "./CalendarPage.module.css";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PRIORITY_COLORS: Record<string, string> = {
  Highest: "var(--red)",
  High: "var(--amber)",
  Medium: "var(--accent)",
  Low: "var(--green)",
  Lowest: "var(--text-3)",
};

function getPriorityColor(priority: string): string {
  return PRIORITY_COLORS[priority] ?? "var(--text-3)";
}

function generateCalendarDays(date: Date, view: "month" | "week"): Date[] {
  if (view === "week") {
    const start = startOfWeek(date, { weekStartsOn: 0 });
    const end = endOfWeek(date, { weekStartsOn: 0 });
    const days: Date[] = [];
    let current = start;
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }

  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let current = calendarStart;
  while (current <= calendarEnd) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

function sprintsForDay(sprints: Sprint[], day: Date): Sprint[] {
  return sprints.filter((s) => {
    try {
      const start = parseISO(s.start_date);
      const end = parseISO(s.end_date);
      return isWithinInterval(day, { start, end });
    } catch {
      return false;
    }
  });
}

function ticketsForDay(tickets: Ticket[], day: Date): Ticket[] {
  return tickets.filter((t) => {
    if (!t.due_date) return false;
    try {
      return isSameDay(parseISO(t.due_date), day);
    } catch {
      return false;
    }
  });
}

/* ── Day Cell ────────────────────────────────────────────────────────────── */

function DayCell({
  day,
  currentMonth,
  sprints,
  tickets,
  onSprintClick,
  onTicketClick,
}: {
  day: Date;
  currentMonth: Date;
  sprints: Sprint[];
  tickets: Ticket[];
  onSprintClick: (sprint: Sprint) => void;
  onTicketClick: (ticket: Ticket) => void;
}) {
  const daySprints = sprintsForDay(sprints, day);
  const dayTickets = ticketsForDay(tickets, day);
  const isCurrentMonth = isSameMonth(day, currentMonth);
  const isTodayDate = isToday(day);

  return (
    <div
      className={`${styles.dayCell} ${!isCurrentMonth ? styles.dayCellMuted : ""} ${isTodayDate ? styles.dayCellToday : ""}`}
    >
      <div className={styles.dayHeader}>
        <span className={styles.dayNumber}>{format(day, "d")}</span>
      </div>

      <div className={styles.dayContent}>
        {daySprints.length > 0 && (
          <div className={styles.sprintList}>
            {daySprints.slice(0, 2).map((sprint) => (
              <button
                key={sprint.id}
                className={styles.sprintBar}
                style={{
                  background: getPodColor(sprint.pod ?? ""),
                }}
                onClick={() => onSprintClick(sprint)}
                title={sprint.name}
              >
                <span className={styles.sprintBarText}>{sprint.name}</span>
              </button>
            ))}
            {daySprints.length > 2 && (
              <span className={styles.moreLabel}>
                +{daySprints.length - 2} more
              </span>
            )}
          </div>
        )}

        {dayTickets.length > 0 && (
          <div className={styles.ticketList}>
            {dayTickets.slice(0, 4).map((ticket) => (
              <button
                key={ticket.key}
                className={styles.ticketDot}
                style={{
                  background: getPriorityColor(ticket.priority),
                }}
                onClick={() => onTicketClick(ticket)}
                title={`${ticket.key}: ${ticket.summary}`}
              />
            ))}
            {dayTickets.length > 4 && (
              <span className={styles.moreLabel}>
                +{dayTickets.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Week View Day Cell ──────────────────────────────────────────────────── */

function WeekDayCell({
  day,
  sprints,
  tickets,
  onSprintClick,
  onTicketClick,
}: {
  day: Date;
  sprints: Sprint[];
  tickets: Ticket[];
  onSprintClick: (sprint: Sprint) => void;
  onTicketClick: (ticket: Ticket) => void;
}) {
  const daySprints = sprintsForDay(sprints, day);
  const dayTickets = ticketsForDay(tickets, day);
  const isTodayDate = isToday(day);

  return (
    <div
      className={`${styles.weekDayCell} ${isTodayDate ? styles.weekDayCellToday : ""}`}
    >
      <div className={styles.weekDayHeader}>
        <span className={styles.weekDayName}>{format(day, "EEE")}</span>
        <span className={styles.weekDayNumber}>{format(day, "d")}</span>
      </div>

      <div className={styles.weekDayContent}>
        {daySprints.length > 0 && (
          <div className={styles.weekSprintList}>
            {daySprints.map((sprint) => (
              <button
                key={sprint.id}
                className={styles.weekSprintBar}
                style={{
                  background: getPodColor(sprint.pod ?? ""),
                }}
                onClick={() => onSprintClick(sprint)}
                title={sprint.name}
              >
                <span className={styles.weekSprintBarText}>{sprint.name}</span>
              </button>
            ))}
          </div>
        )}

        {dayTickets.length > 0 && (
          <div className={styles.weekTicketList}>
            {dayTickets.map((ticket) => (
              <button
                key={ticket.key}
                className={styles.weekTicketItem}
                onClick={() => onTicketClick(ticket)}
                title={`${ticket.key}: ${ticket.summary}`}
              >
                <span
                  className={styles.weekTicketDot}
                  style={{ background: getPriorityColor(ticket.priority) }}
                />
                <span className={styles.weekTicketKey}>{ticket.key}</span>
                <span className={styles.weekTicketSummary}>
                  {ticket.summary}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function CalendarPage() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("month");

  const { data: sprintsData = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
    staleTime: 1000 * 60 * 2,
  });

  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: ["tickets-calendar"],
    queryFn: () => fetchTickets({}),
    staleTime: 1000 * 60 * 2,
  });

  const sprints = Array.isArray(sprintsData) ? sprintsData : [];
  const tickets = ticketsData?.tickets ?? [];

  const days = useMemo(
    () => generateCalendarDays(currentDate, view),
    [currentDate, view],
  );

  function handlePrev() {
    if (view === "month") {
      setCurrentDate((d) => subMonths(d, 1));
    } else {
      setCurrentDate((d) => subWeeks(d, 1));
    }
  }

  function handleNext() {
    if (view === "month") {
      setCurrentDate((d) => addMonths(d, 1));
    } else {
      setCurrentDate((d) => addWeeks(d, 1));
    }
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  function handleSprintClick(sprint: Sprint) {
    if (sprint.pod) {
      navigate(`/spaces/${sprint.pod}`);
    } else {
      navigate("/spaces");
    }
  }

  function handleTicketClick(ticket: Ticket) {
    navigate(`/tickets?key=${encodeURIComponent(ticket.key)}`);
  }

  const isLoading = sprintsLoading || ticketsLoading;

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <RiCalendarLine size={20} className={styles.headerIcon} />
            <div>
              <h1 className={styles.title}>Calendar</h1>
            </div>
          </div>
        </div>
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 7 * 5 }).map((_, i) => (
            <div key={i} className={styles.skeletonCell} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <RiCalendarLine size={20} className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>Calendar</h1>
          </div>
        </div>

        <div className={styles.headerCenter}>
          <button
            className={styles.navBtn}
            onClick={handlePrev}
            title="Previous"
          >
            <RiArrowLeftSLine size={18} />
          </button>
          <span className={styles.monthLabel}>
            {format(currentDate, "MMMM yyyy")}
          </span>
          <button
            className={styles.navBtn}
            onClick={handleNext}
            title="Next"
          >
            <RiArrowRightSLine size={18} />
          </button>
          <button className={styles.todayBtn} onClick={handleToday}>
            Today
          </button>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${view === "month" ? styles.viewBtnActive : ""}`}
              onClick={() => setView("month")}
              title="Month view"
            >
              <RiLayoutGridLine size={14} />
              Month
            </button>
            <button
              className={`${styles.viewBtn} ${view === "week" ? styles.viewBtnActive : ""}`}
              onClick={() => setView("week")}
              title="Week view"
            >
              <RiListCheck size={14} />
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className={styles.calendarCard}>
        {view === "month" ? (
          <>
            {/* Day names */}
            <div className={styles.dayNamesRow}>
              {WEEK_DAYS.map((d) => (
                <div key={d} className={styles.dayName}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className={styles.calendarGrid}>
              {days.map((day) => (
                <DayCell
                  key={day.toISOString()}
                  day={day}
                  currentMonth={currentDate}
                  sprints={sprints}
                  tickets={tickets}
                  onSprintClick={handleSprintClick}
                  onTicketClick={handleTicketClick}
                />
              ))}
            </div>
          </>
        ) : (
          <div className={styles.weekGrid}>
            {days.map((day) => (
              <WeekDayCell
                key={day.toISOString()}
                day={day}
                sprints={sprints}
                tickets={tickets}
                onSprintClick={handleSprintClick}
                onTicketClick={handleTicketClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendLabel}>Sprints by pod:</span>
        {(Array.from(new Set(sprints.map((s) => s.pod).filter(Boolean))) as string[]).map(
          (pod) => (
            <span key={pod} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ background: getPodColor(pod) }}
              />
              {pod}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
