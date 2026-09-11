"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";

/**
 * Selector de fecha propio (el calendario nativo de <input type="date"> no es
 * estilizable). Renderiza un disparador con la estética `.field` y un
 * calendario emergente con los tokens de la app. Guarda el valor en un
 * <input type="hidden"> con el `name` dado (formato YYYY-MM-DD) para que el
 * <form> lo envíe igual que un input nativo.
 *
 * El calendario solo se renderiza cuando está abierto (tras un click en
 * cliente), así que usar `new Date()` para "hoy" no rompe la hidratación.
 */

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const toKey = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

function parseKey(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

function addDays(key: string, days: number): string {
  const p = parseKey(key);
  if (!p) return key;
  const d = new Date(p.y, p.m, p.d + days);
  return toKey(d.getFullYear(), d.getMonth(), d.getDate());
}

export function DateField({
  name,
  label,
  defaultValue,
  placeholder = "Sin definir",
  wide,
  className,
}: {
  name: string;
  label?: string;
  defaultValue: string | null;
  placeholder?: string;
  wide?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [focusKey, setFocusKey] = useState("");
  const parsed = parseKey(value);
  const [view, setView] = useState<{ year: number; month: number } | null>(
    parsed ? { year: parsed.y, month: parsed.m } : null,
  );
  const rootRef = useRef<HTMLDivElement>(null);

  // Cierre por click fuera / Escape (solo mientras está abierto).
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Enfoca el día activo cuando se abre o al navegar con el teclado.
  useEffect(() => {
    if (!open || !focusKey) return;
    const el = rootRef.current?.querySelector<HTMLButtonElement>(
      `[data-key="${focusKey}"]`,
    );
    el?.focus();
  }, [open, focusKey]);

  function openPicker() {
    if (open) {
      setOpen(false);
      return;
    }
    const base = parseKey(value);
    const t = new Date();
    setView({
      year: base?.y ?? t.getFullYear(),
      month: base?.m ?? t.getMonth(),
    });
    setFocusKey(value || toKey(t.getFullYear(), t.getMonth(), t.getDate()));
    setOpen(true);
  }

  function selectDay(y: number, m: number, d: number) {
    setValue(toKey(y, m, d));
    setView({ year: y, month: m });
    setOpen(false);
  }

  function clear() {
    setValue("");
    setOpen(false);
  }

  function goToday() {
    const t = new Date();
    selectDay(t.getFullYear(), t.getMonth(), t.getDate());
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      if (!v) return v;
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    const steps: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
    };
    const step = steps[e.key];
    if (step != null) {
      e.preventDefault();
      const next = addDays(focusKey, step);
      setFocusKey(next);
      const p = parseKey(next);
      if (p) setView({ year: p.y, month: p.m });
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const p = parseKey(focusKey);
      if (p) selectDay(p.y, p.m, p.d);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${wide ? "sm:col-span-2" : ""}`}>
      {label && <span className="field-label">{label}</span>}
      <button
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`field flex items-center justify-between gap-2 text-left ${className ?? ""}`}
      >
        <span className={value ? "text-ink" : "text-ink-3"}>
          {value ? formatDate(value) : placeholder}
        </span>
        <Calendar className="size-4 shrink-0 text-ink-3" strokeWidth={2} aria-hidden />
      </button>
      <input type="hidden" name={name} value={value} />

      {open && view && (
        <Popover
          view={view}
          value={value}
          focusKey={focusKey}
          onPrev={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
          onMonth={(m) => setView({ ...view, month: m })}
          onYear={(y) => setView({ ...view, year: y })}
          onSelect={selectDay}
          onClear={clear}
          onToday={goToday}
          onGridKeyDown={onGridKeyDown}
        />
      )}
    </div>
  );
}

function Popover({
  view,
  value,
  focusKey,
  onPrev,
  onNext,
  onMonth,
  onYear,
  onSelect,
  onClear,
  onToday,
  onGridKeyDown,
}: {
  view: { year: number; month: number };
  value: string;
  focusKey: string;
  onPrev: () => void;
  onNext: () => void;
  onMonth: (m: number) => void;
  onYear: (y: number) => void;
  onSelect: (y: number, m: number, d: number) => void;
  onClear: () => void;
  onToday: () => void;
  onGridKeyDown: (e: React.KeyboardEvent) => void;
}) {
  // Solo se ejecuta en cliente (el popover no se renderiza en el servidor).
  const now = new Date();
  const todayKey = toKey(now.getFullYear(), now.getMonth(), now.getDate());
  const years: number[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 120; y--) years.push(y);

  const first = new Date(view.year, view.month, 1);
  const lead = (first.getDay() + 6) % 7; // lunes primero
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(view.year, view.month, 1 - lead + i));
  }

  return (
    <div
      role="dialog"
      aria-label="Elegir fecha"
      className="absolute top-full left-0 z-30 mt-1.5 w-72 max-w-[90vw] rounded-lg border border-line bg-canvas p-3 shadow-lg"
    >
      {/* Cabecera: mes/año con navegación */}
      <div className="mb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Mes anterior"
          className="flex size-7 shrink-0 items-center justify-center rounded text-ink-2 hover:bg-wash hover:text-ink"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1">
          <select
            value={view.month}
            onChange={(e) => onMonth(Number(e.target.value))}
            aria-label="Mes"
            className="rounded border border-line-strong bg-canvas px-1.5 py-1 text-sm text-ink capitalize outline-none focus:border-accent"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i} className="capitalize">
                {m}
              </option>
            ))}
          </select>
          <select
            value={view.year}
            onChange={(e) => onYear(Number(e.target.value))}
            aria-label="Año"
            className="rounded border border-line-strong bg-canvas px-1.5 py-1 text-sm text-ink outline-none focus:border-accent"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={onNext}
          aria-label="Mes siguiente"
          className="flex size-7 shrink-0 items-center justify-center rounded text-ink-2 hover:bg-wash hover:text-ink"
        >
          <ChevronRight className="size-4" strokeWidth={2} />
        </button>
      </div>

      {/* Días de la semana */}
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-medium tracking-wide text-ink-3 uppercase"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Rejilla de días */}
      <div className="grid grid-cols-7 gap-0.5" role="grid" onKeyDown={onGridKeyDown}>
        {cells.map((d) => {
          const key = toKey(d.getFullYear(), d.getMonth(), d.getDate());
          const inMonth = d.getMonth() === view.month;
          const selected = key === value;
          const isToday = key === todayKey;
          let cls: string;
          if (selected) {
            cls = "bg-accent font-semibold text-accent-ink";
          } else {
            cls = inMonth
              ? "text-ink hover:bg-wash"
              : "text-ink-3 hover:bg-wash";
            if (isToday) cls += " ring-1 ring-accent/50";
          }
          return (
            <button
              key={key}
              type="button"
              data-key={key}
              tabIndex={key === focusKey ? 0 : -1}
              aria-pressed={selected}
              onClick={() => onSelect(d.getFullYear(), d.getMonth(), d.getDate())}
              className={`flex h-8 w-full items-center justify-center rounded text-sm transition-colors duration-100 ${cls}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Acciones */}
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <button
          type="button"
          onClick={onClear}
          className="rounded px-1.5 py-0.5 text-xs text-ink-3 hover:bg-wash hover:text-ink"
        >
          Borrar
        </button>
        <button
          type="button"
          onClick={onToday}
          className="rounded px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft"
        >
          Hoy
        </button>
      </div>
    </div>
  );
}
