import { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  Divider,
  Popover,
} from "@mui/material";
import { RiArrowDownWideFill } from "react-icons/ri";
import { BsFillCalendar2EventFill } from "react-icons/bs";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  addMonths,
  isSameDay,
  isWithinInterval,
  isAfter,
  isBefore,
  startOfDay,
  getDaysInMonth,
  getDay,
} from "date-fns";
import { useFilterStore, useThemeStore } from "@/store";
import styles from "./DatePicker.module.css";

/* ── Types ───────────────────────────────────────────────────────────────── */
type Preset =
  | "today"
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "thisFY"
  | "custom";

interface PresetOption {
  label: string;
  value: Preset;
}

const PRESETS: PresetOption[] = [
  { label: "Today", value: "today" },
  { label: "This Month", value: "thisMonth" },
  { label: "Last Month", value: "lastMonth" },
  { label: "This Quarter", value: "thisQuarter" },
  { label: "This FY", value: "thisFY" },
  { label: "Custom", value: "custom" },
];

function getPreset(preset: Preset): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: startOfDay(now) };
    case "thisMonth":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "lastMonth": {
      const last = subMonths(now, 1);
      return { from: startOfMonth(last), to: endOfMonth(last) };
    }
    case "thisQuarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "thisFY": {
      const year =
        now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      return { from: new Date(year, 3, 1), to: new Date(year + 1, 2, 31) };
    }
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");
const fmtLabel = (d: Date) => format(d, "MMM d, yyyy");
const fmtMonth = (d: Date) => format(d, "MMM yyyy");

/* ── Mini Calendar ───────────────────────────────────────────────────────── */
interface CalendarProps {
  month: Date;
  hoverDate: Date | null;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  selecting: "start" | "end";
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date | null) => void;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function MiniCalendar({
  month,
  hoverDate,
  rangeStart,
  rangeEnd,
  selecting,
  onDayClick,
  onDayHover,
}: CalendarProps) {
  const totalDays = getDaysInMonth(month);
  const firstDay = getDay(new Date(month.getFullYear(), month.getMonth(), 1));
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  function getState(day: number) {
    const d = new Date(month.getFullYear(), month.getMonth(), day);
    const start = rangeStart;
    const end = rangeEnd || (selecting === "end" ? hoverDate : null);

    const isStart = start && isSameDay(d, start);
    const isEnd = end && isSameDay(d, end);
    const inRange =
      start &&
      end &&
      isWithinInterval(d, {
        start: isBefore(start, end) ? start : end,
        end: isAfter(start, end) ? start : end,
      });
    const isToday = isSameDay(d, new Date());

    return { isStart, isEnd, inRange, isToday };
  }

  return (
    <Box sx={{ width: 224 }}>
      {/* Day headers */}
      <Box
        sx={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", mb: 0.5 }}
      >
        {DAYS.map((d) => (
          <Typography
            key={d}
            sx={{
              fontSize: 10,
              fontWeight: 700,
              textAlign: "center",
              color: "text.disabled",
              py: 0.5,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {d}
          </Typography>
        ))}
      </Box>

      {/* Day cells */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7,1fr)",
          gap: "2px",
        }}
      >
        {cells.map((day, i) => {
          if (!day) return <Box key={i} />;

          const { isStart, isEnd, inRange, isToday } = getState(day);
          const isSelected = isStart || isEnd;

          return (
            <Box
              key={i}
              onClick={() =>
                onDayClick(new Date(month.getFullYear(), month.getMonth(), day))
              }
              onMouseEnter={() =>
                onDayHover(new Date(month.getFullYear(), month.getMonth(), day))
              }
              onMouseLeave={() => onDayHover(null)}
              sx={{
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: isSelected ? 1.5 : inRange ? 0 : 1.5,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: isSelected ? 700 : isToday ? 600 : 400,
                bgcolor: isSelected
                  ? "primary.main"
                  : inRange
                    ? "primary.main"
                    : "transparent",
                opacity: isSelected ? 1 : inRange ? 0.15 : 1,
                color: isSelected
                  ? "#fff"
                  : isToday
                    ? "primary.main"
                    : "text.primary",
                border: isToday && !isSelected ? "1px solid" : "none",
                borderColor: "primary.main",
                transition: "all .1s",
                "&:hover": {
                  bgcolor: isSelected ? "primary.dark" : "action.hover",
                  opacity: 1,
                },
              }}
            >
              {day}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────── */
interface DateRangePickerProps {
  /** compact = icon + short label (for topbar), default = full label */
  compact?: boolean;
}

export default function DateRangePicker({
  compact = false,
}: DateRangePickerProps) {
  const { dateFrom, dateTo, setDateRange } = useFilterStore();
  useThemeStore.getState();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [preset, setPreset] = useState<Preset>("thisMonth");
  const [leftMonth, setLeftMonth] = useState(() => startOfMonth(new Date()));
  const [rangeStart, setRangeStart] = useState<Date | null>(
    dateFrom ? new Date(dateFrom) : null,
  );
  const [rangeEnd, setRangeEnd] = useState<Date | null>(
    dateTo ? new Date(dateTo) : null,
  );
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  const rightMonth = addMonths(leftMonth, 1);
  const open = Boolean(anchorEl);

  /* Label shown on the trigger button */
  function triggerLabel() {
    if (!rangeStart && !rangeEnd) return "Select dates";
    if (rangeStart && rangeEnd) {
      if (preset !== "custom") {
        const p = PRESETS.find((p) => p.value === preset);
        if (p)
          return compact
            ? p.label
            : `${p.label}   |   ${fmtLabel(rangeStart)} – ${fmtLabel(rangeEnd)}`;
      }
      return compact
        ? `${format(rangeStart, "MMM d")} – ${format(rangeEnd, "MMM d")}`
        : `${fmtLabel(rangeStart)} – ${fmtLabel(rangeEnd)}`;
    }
    return fmtLabel(rangeStart!);
  }

  function handlePresetClick(p: Preset) {
    setPreset(p);
    if (p === "custom") return;
    const { from, to } = getPreset(p);
    setRangeStart(from);
    setRangeEnd(to);
    setLeftMonth(startOfMonth(from));
    // auto-apply presets immediately
    setDateRange(fmt(from), fmt(to));
    setAnchorEl(null);
  }

  function handleDayClick(d: Date) {
    if (selecting === "start") {
      setRangeStart(d);
      setRangeEnd(null);
      setSelecting("end");
      setPreset("custom");
    } else {
      if (rangeStart && isBefore(d, rangeStart)) {
        setRangeEnd(rangeStart);
        setRangeStart(d);
      } else {
        setRangeEnd(d);
      }
      setSelecting("start");
      setPreset("custom");
    }
  }

  function handleApply() {
    if (rangeStart && rangeEnd) {
      const start = isBefore(rangeStart, rangeEnd) ? rangeStart : rangeEnd;
      const end = isAfter(rangeStart, rangeEnd) ? rangeStart : rangeEnd;
      setDateRange(fmt(start), fmt(end));
    }
    setAnchorEl(null);
  }

  function handleCancel() {
    // reset to current store values
    setRangeStart(dateFrom ? new Date(dateFrom) : null);
    setRangeEnd(dateTo ? new Date(dateTo) : null);
    setAnchorEl(null);
  }

  return (
    <>
      {/* ── Trigger button ── */}
      <Box
        onClick={(e) => setAnchorEl(e.currentTarget)}
        className={styles.datePill}
      >
        <BsFillCalendar2EventFill />
        <Typography
          className={styles.preset}
          sx={{
            fontSize: "11px",
            fontWeight: 600,
            whiteSpace: "nowrap",
            maxWidth: compact ? 130 : 280,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {triggerLabel()}
        </Typography>
        <RiArrowDownWideFill fontSize={15} />
      </Box>

      {/* ── Popover ── */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleCancel}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: { sx: { mt: 0.75, borderRadius: 2.5, overflow: "hidden" } },
        }}
      >
        <Paper elevation={0} sx={{ display: "flex", width: "40.5rem" }}>
          {/* ── Left: presets ── */}
          <Box
            sx={{
              width: 140,
              flexShrink: 0,
              borderRight: "1px solid",
              borderColor: "divider",
              p: 1.5,
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
            }}
          >
            <Typography
              variant="subtitle2"
              color="text.disabled"
              sx={{ px: 1, pb: 0.5 }}
            >
              Quick select
            </Typography>
            {PRESETS.filter((p) => p.value !== "custom").map((p) => (
              <Box
                key={p.value}
                onClick={() => handlePresetClick(p.value)}
                sx={{
                  px: 1.25,
                  py: 0.875,
                  borderRadius: 1.5,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: preset === p.value ? 700 : 400,
                  color: preset === p.value ? "#fff" : "text.primary",
                  bgcolor: preset === p.value ? "primary.main" : "transparent",
                  transition: "all .12s",
                  "&:hover": {
                    bgcolor:
                      preset === p.value ? "primary.dark" : "action.hover",
                  },
                }}
              >
                {p.label}
              </Box>
            ))}
          </Box>

          {/* ── Right: calendars + footer ── */}
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Calendar header — month nav */}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ px: 2, pt: 1.75, pb: 1 }}
            >
              <Button
                size="small"
                variant="text"
                sx={{ minWidth: 28, px: 0.5, fontSize: 16 }}
                onClick={() => setLeftMonth((m) => addMonths(m, -1))}
              >
                ‹
              </Button>

              <Stack direction="row" spacing={4}>
                <Typography fontWeight={700} fontSize={13}>
                  {fmtMonth(leftMonth)}
                </Typography>
                <Typography fontWeight={700} fontSize={13}>
                  {fmtMonth(rightMonth)}
                </Typography>
              </Stack>

              <Button
                size="small"
                variant="text"
                sx={{ minWidth: 28, px: 0.5, fontSize: 16 }}
                onClick={() => setLeftMonth((m) => addMonths(m, 1))}
              >
                ›
              </Button>
            </Stack>

            {/* Two calendars side by side */}
            <Stack direction="row" spacing={1.5} sx={{ px: 2, pb: 1.5 }}>
              <MiniCalendar
                month={leftMonth}
                hoverDate={hoverDate}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                selecting={selecting}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
              />
              <Divider orientation="vertical" flexItem />
              <MiniCalendar
                month={rightMonth}
                hoverDate={hoverDate}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                selecting={selecting}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
              />
            </Stack>

            {/* Footer */}
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderTop: "1px solid",
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              {/* Selected range summary */}
              <Box
                sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1 }}
              >
                <Box
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 1.5,
                    bgcolor: rangeStart ? "primary.main" : "action.selected",
                    fontSize: 11,
                    fontWeight: 600,
                    color: rangeStart ? "#fff" : "text.disabled",
                  }}
                >
                  {rangeStart ? fmtLabel(rangeStart) : "Start date"}
                </Box>
                <Typography fontSize={11} color="text.disabled">
                  →
                </Typography>
                <Box
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 1.5,
                    bgcolor: rangeEnd ? "primary.main" : "action.selected",
                    fontSize: 11,
                    fontWeight: 600,
                    color: rangeEnd ? "#fff" : "text.disabled",
                  }}
                >
                  {rangeEnd ? fmtLabel(rangeEnd) : "End date"}
                </Box>
                {rangeStart && !rangeEnd && (
                  <Typography
                    fontSize={11}
                    color="text.disabled"
                    sx={{ fontStyle: "italic" }}
                  >
                    Select end date
                  </Typography>
                )}
              </Box>

              <Button size="small" variant="outlined" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={!rangeStart || !rangeEnd}
                onClick={handleApply}
              >
                Apply
              </Button>
            </Box>
          </Box>
        </Paper>
      </Popover>
    </>
  );
}
