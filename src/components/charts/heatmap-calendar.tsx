"use client";

import { useMemo } from "react";
import { cn } from "~/lib/utils";
import type { HeatmapDay } from "~/lib/types";

interface HeatmapCalendarProps {
  data: HeatmapDay[];
  className?: string;
}

const DAYS_LABEL = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS_LABEL = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

type CalendarCell = {
  date: string;
  amount: number;
  day: number;
  isFuture: boolean;
} | null;

function HeatmapCalendar({ data, className }: HeatmapCalendarProps) {
  const { weeks, maxAmount, monthLabel, year } = useMemo(() => {
    const map = new Map(data.map((d) => [d.date, d.amount]));
    const today = new Date();
    const yr = today.getFullYear();
    const mo = today.getMonth();

    const firstDay = new Date(yr, mo, 1).getDay();
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();

    const weeks: CalendarCell[][] = [];
    let currentWeek: CalendarCell[] = [];

    for (let i = 0; i < firstDay; i++) currentWeek.push(null);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isFuture = new Date(yr, mo, day) > today;
      currentWeek.push({
        date: dateStr,
        amount: map.get(dateStr) ?? 0,
        day,
        isFuture,
      });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    const maxAmount = Math.max(...data.map((d) => d.amount), 1);

    return { weeks, maxAmount, monthLabel: MONTHS_LABEL[mo], year: yr };
  }, [data]);

  function getCellStyle(cell: NonNullable<CalendarCell>) {
    if (cell.isFuture) return { backgroundColor: "#22263a", opacity: 0.3 };
    if (cell.amount === 0) return { backgroundColor: "#22263a" };
    const t = cell.amount / maxAmount;
    const alpha = 0.15 + t * 0.85;
    return { backgroundColor: `rgba(99,102,241,${alpha.toFixed(2)})` };
  }

  return (
    <div className={cn("select-none", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-text-primary">
          {monthLabel} {year}
        </h4>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>Rendah</span>
          <div className="flex gap-0.5">
            {[0.15, 0.38, 0.58, 0.77, 1].map((a, i) => (
              <div
                key={i}
                className="w-3.5 h-3.5 rounded-sm"
                style={{ backgroundColor: `rgba(99,102,241,${a})` }}
              />
            ))}
          </div>
          <span>Tinggi</span>
        </div>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DAYS_LABEL.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-medium text-text-muted"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="space-y-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map((cell, di) =>
              cell ? (
                <div
                  key={di}
                  className="aspect-square rounded-md flex items-center justify-center cursor-default hover:ring-1 hover:ring-primary/50 transition-all"
                  style={getCellStyle(cell)}
                  title={
                    cell.isFuture
                      ? cell.date
                      : `${cell.date}: ${cell.amount.toLocaleString("id-ID")}`
                  }
                >
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: cell.isFuture ? "#475569" : "#94a3b8" }}
                  >
                    {cell.day}
                  </span>
                </div>
              ) : (
                <div key={di} className="aspect-square" />
              ),
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-bg-elevated" />
          <span className="text-xs text-text-muted">Tidak ada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: "rgba(99,102,241,0.3)" }}
          />
          <span className="text-xs text-text-muted">Rendah</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: "rgba(99,102,241,0.6)" }}
          />
          <span className="text-xs text-text-muted">Sedang</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: "rgba(99,102,241,1)" }}
          />
          <span className="text-xs text-text-muted">Tinggi</span>
        </div>
      </div>
    </div>
  );
}

export { HeatmapCalendar };
