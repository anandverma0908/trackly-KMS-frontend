import { RiRocketLine } from "react-icons/ri";
import styles from "../MyWorkPage.module.css";
import type { SprintRisk } from "../useMyWork";

interface Props {
  risk: SprintRisk | null;
}

export default function NovaDeliveryForecast({ risk }: Props) {
  if (!risk) {
    return (
      <div className={styles.forecastCard}>
        <div className={styles.forecastHeader}>
          <span>Delivery Forecast</span>
        </div>
        <p className={styles.forecastEmpty}>
          No active sprint — start one to see your forecast.
        </p>
      </div>
    );
  }

  const totalDays = 14;
  const daysElapsed = Math.max(1, totalDays - risk.daysLeft);
  const pace = risk.completed / daysElapsed;
  const neededDays = pace > 0 ? risk.remaining / pace : Infinity;
  const buffer = risk.daysLeft - neededDays;
  const pctDone =
    risk.committed > 0 ? Math.min(100, (risk.completed / risk.committed) * 100) : 0;

  const forecastColor =
    buffer >= 2 ? "var(--green)" : buffer >= 0 ? "var(--amber)" : "var(--red)";
  const forecastLabel =
    buffer >= 2 ? "On Track" : buffer >= 0 ? "Tight" : "At Risk";

  let forecastText: string;
  if (pace === 0) {
    forecastText = "No points burned yet. Log time to calibrate your forecast.";
  } else if (buffer >= 2) {
    forecastText = `At ${pace.toFixed(1)} pts/day, you'll finish ~${Math.ceil(neededDays)}d before sprint end. Solid pace.`;
  } else if (buffer >= 0) {
    forecastText = `At ${pace.toFixed(1)} pts/day, you'll just make it. Stay focused on top-ranked tickets.`;
  } else {
    const shortfall = Math.ceil(risk.remaining - pace * risk.daysLeft);
    forecastText = `At current pace, ${Math.abs(Math.ceil(buffer))}d short. Consider de-scoping ~${shortfall} pts.`;
  }

  return (
    <div className={styles.forecastCard}>
      <div className={styles.forecastHeader}>
        <span>Delivery Forecast</span>
        <span className={styles.forecastLabel} style={{ color: forecastColor }}>
          {forecastLabel}
        </span>
      </div>

      <div className={styles.forecastBarTrack}>
        <div
          className={styles.forecastBarFill}
          style={{ width: `${pctDone}%`, background: forecastColor }}
        />
      </div>
      <div className={styles.forecastBarMeta}>
        <span>{risk.completed} pts done</span>
        <span>{risk.remaining} pts left</span>
      </div>

      <div className={styles.forecastStats}>
        <div className={styles.forecastStat}>
          <span className={styles.forecastStatVal}>
            {pace > 0 ? pace.toFixed(1) : "—"}
          </span>
          <span className={styles.forecastStatLbl}>pts/day</span>
        </div>
        <div className={styles.forecastStat}>
          <span className={styles.forecastStatVal}>{risk.daysLeft}d</span>
          <span className={styles.forecastStatLbl}>remaining</span>
        </div>
        <div className={styles.forecastStat}>
          <span className={styles.forecastStatVal} style={{ color: forecastColor }}>
            {pace > 0 ? (buffer >= 0 ? `+${Math.ceil(buffer)}d` : `${Math.ceil(buffer)}d`) : "—"}
          </span>
          <span className={styles.forecastStatLbl}>buffer</span>
        </div>
      </div>

      <p className={styles.forecastText} style={{ color: forecastColor }}>
        {forecastText}
      </p>
    </div>
  );
}
