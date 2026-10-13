"use client";

import { useId } from "react";
import { Button } from "~/components/ui/button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  label?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  label = "data",
}: PaginationProps) {
  const id = useId();
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <nav
      aria-label={`Pagination ${label}`}
      className="border-border mt-4 flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <p
        role="status"
        aria-live="polite"
        className="text-text-secondary tabular-nums"
      >
        {start}–{end} dari {total} {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="text-text-secondary">
          Per halaman
        </label>
        <select
          id={id}
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="border-border bg-bg-surface text-text-primary focus-visible:ring-text-primary h-11 rounded-lg border px-2 focus-visible:ring-2 focus-visible:outline-none"
        >
          {[6, 12, 24, 48].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            className="focus-visible:ring-text-primary h-11 min-w-11 px-2"
            aria-label={`Halaman pertama ${label}`}
            disabled={page === 1}
            onClick={() => onPageChange(1)}
          >
            «
          </Button>
          <Button
            type="button"
            variant="outline"
            className="focus-visible:ring-text-primary h-11 min-w-11 px-2"
            aria-label={`Halaman sebelumnya ${label}`}
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            ‹
          </Button>
          <span
            className="text-text-primary px-2 text-xs tabular-nums"
            aria-label={`Halaman ${page} dari ${totalPages}`}
          >
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            className="focus-visible:ring-text-primary h-11 min-w-11 px-2"
            aria-label={`Halaman berikutnya ${label}`}
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            ›
          </Button>
          <Button
            type="button"
            variant="outline"
            className="focus-visible:ring-text-primary h-11 min-w-11 px-2"
            aria-label={`Halaman terakhir ${label}`}
            disabled={page === totalPages}
            onClick={() => onPageChange(totalPages)}
          >
            »
          </Button>
        </div>
      </div>
    </nav>
  );
}
