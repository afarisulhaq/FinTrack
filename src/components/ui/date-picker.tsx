"use client";

import { useId, useState, type CSSProperties } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { id as indonesia } from "react-day-picker/locale";
import { cn } from "~/lib/utils";
import { localDateValue, parseDateValue } from "~/lib/date";

interface DatePickerProps {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  mode?: "date" | "month";
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  allowAll?: boolean;
}

const monthNames = Array.from({ length: 12 }, (_, month) =>
  new Date(2026, month, 1).toLocaleDateString("id-ID", { month: "short" }),
);
const actionClass =
  "min-h-10 rounded-lg px-3 text-sm hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40";

export function DatePicker({
  value,
  onValueChange,
  label,
  mode = "date",
  required,
  disabled,
  min,
  max,
  className,
  allowAll,
}: DatePickerProps) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(
    mode === "month" && value ? `${value}-01` : value,
  );
  const [year, setYear] = useState(() =>
    (selected ?? new Date()).getFullYear(),
  );
  const display = selected?.toLocaleDateString(
    "id-ID",
    mode === "month"
      ? { month: "long", year: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" },
  );
  const choose = (next: string) => {
    onValueChange(next);
    setOpen(false);
  };
  const today = localDateValue();
  const todayValue = mode === "month" ? today.slice(0, 7) : today;
  const lower = min ? parseDateValue(min) : undefined;
  const upper = max ? parseDateValue(max) : undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label
        htmlFor={fieldId}
        className="text-text-secondary text-sm font-medium"
      >
        {label}
      </label>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setYear((selected ?? new Date()).getFullYear());
        }}
      >
        <Popover.Trigger asChild>
          <button
            id={fieldId}
            type="button"
            disabled={disabled}
            className="border-border bg-bg-surface text-text-primary focus-visible:ring-primary flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className={cn(
                "truncate",
                !display && !allowAll && "text-text-muted",
              )}
            >
              {display ??
                (allowAll
                  ? "Semua waktu"
                  : mode === "month"
                    ? "Pilih bulan"
                    : "Pilih tanggal")}
            </span>
            <CalendarDays
              aria-hidden
              className="text-text-secondary h-4 w-4 shrink-0"
            />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            aria-label={label}
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="border-border bg-bg-surface text-text-primary z-[120] w-[min(320px,calc(100vw-24px))] rounded-xl border p-3 shadow-md focus:outline-none"
          >
            {mode === "month" ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    aria-label="Tahun sebelumnya"
                    className={actionClass}
                    onClick={() => setYear(year - 1)}
                  >
                    <ChevronLeft aria-hidden className="h-4 w-4" />
                  </button>
                  <span
                    aria-live="polite"
                    className="font-semibold tabular-nums"
                  >
                    {year}
                  </span>
                  <button
                    type="button"
                    aria-label="Tahun berikutnya"
                    className={actionClass}
                    onClick={() => setYear(year + 1)}
                  >
                    <ChevronRight aria-hidden className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {monthNames.map((name, index) => {
                    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
                    return (
                      <button
                        type="button"
                        key={month}
                        aria-pressed={month === value}
                        disabled={Boolean(
                          (min && month < min) || (max && month > max),
                        )}
                        className={cn(
                          actionClass,
                          month === value &&
                            "bg-primary text-on-primary hover:bg-primary-hover",
                        )}
                        onClick={() => choose(month)}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <DayPicker
                mode="single"
                required
                selected={selected}
                defaultMonth={selected}
                locale={indonesia}
                autoFocus
                captionLayout="dropdown"
                navLayout="after"
                startMonth={lower ?? new Date(1900, 0)}
                endMonth={upper ?? new Date(2100, 11)}
                disabled={[
                  ...(lower ? [{ before: lower }] : []),
                  ...(upper ? [{ after: upper }] : []),
                ]}
                onSelect={(date: Date | undefined) => {
                  if (date) choose(localDateValue(date));
                }}
                labels={{
                  labelNext: () => "Bulan berikutnya",
                  labelPrevious: () => "Bulan sebelumnya",
                  labelMonthDropdown: () => "Pilih bulan",
                  labelYearDropdown: () => "Pilih tahun",
                }}
                className="finance-calendar"
                style={
                  {
                    "--rdp-accent-color": "var(--primary)",
                    "--rdp-today-color": "var(--text-primary)",
                    "--rdp-day-width": "40px",
                    "--rdp-day-height": "40px",
                    "--rdp-day_button-width": "38px",
                    "--rdp-day_button-height": "38px",
                  } as CSSProperties
                }
              />
            )}
            <div className="border-border mt-3 flex items-center justify-between gap-2 border-t pt-2">
              <button
                type="button"
                className={actionClass}
                disabled={Boolean(
                  (min && todayValue < min) || (max && todayValue > max),
                )}
                onClick={() => choose(todayValue)}
              >
                {mode === "month" ? "Bulan ini" : "Hari ini"}
              </button>
              {!required && (
                <button
                  type="button"
                  className={actionClass}
                  onClick={() => choose("")}
                >
                  {allowAll ? "Semua waktu" : "Kosongkan"}
                </button>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {required && (
        <input
          aria-hidden
          tabIndex={-1}
          required
          disabled={disabled}
          value={value}
          onChange={() => {}}
          onInvalid={(event) => {
            event.preventDefault();
            setOpen(true);
          }}
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
      )}
    </div>
  );
}
