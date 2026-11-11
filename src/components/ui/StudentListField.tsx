import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "./Button";
import { Field } from "./Form";

interface StudentListFieldProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

export function StudentListField({ value, onChange, disabled = false }: StudentListFieldProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const pendingFocusRef = useRef<number | null>(null);
  const rows = value.split("\n");
  const filledCount = rows.filter((r) => r.trim() !== "").length;

  useEffect(() => {
    inputRefs.current.length = rows.length;
    const idx = pendingFocusRef.current;
    if (idx !== null) {
      pendingFocusRef.current = null;
      inputRefs.current[idx]?.focus();
    }
  });

  const commit = (nextRows: string[]) => {
    onChange(nextRows.join("\n"));
  };

  const updateRow = (index: number, text: string) => {
    const clean = text.replace(/[\r\n]+/g, " ");
    const next = rows.map((row, i) => (i === index ? clean : row));
    commit(next);
  };

  const addRow = () => {
    if (disabled) return;
    const next = [...rows, ""];
    pendingFocusRef.current = next.length - 1;
    commit(next);
  };

  const removeRow = (index: number) => {
    if (disabled) return;
    if (rows.length <= 1) {
      if (rows[0] !== "") {
        pendingFocusRef.current = 0;
        commit([""]);
      }
      return;
    }
    const next = rows.filter((_, i) => i !== index);
    pendingFocusRef.current = Math.min(index, next.length - 1);
    commit(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (index + 1 < rows.length) {
      inputRefs.current[index + 1]?.focus();
    } else {
      addRow();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>, index: number) => {
    const pasted = e.clipboardData.getData("text");
    if (!/[\r\n]/.test(pasted)) return;
    const lines = pasted
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length <= 1) {
      e.preventDefault();
      updateRow(index, lines[0] || "");
      return;
    }
    e.preventDefault();
    const next = [...rows];
    lines.forEach((line, offset) => {
      next[index + offset] = line;
    });
    for (let k = 0; k < next.length; k++) {
      if (next[k] === undefined) next[k] = "";
    }
    pendingFocusRef.current = Math.min(next.length - 1, index + lines.length - 1);
    commit(next);
  };

  return (
    <Field
      label="إعداد الطلبة"
      aside={
        <span className="text-[0.72rem] font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums">
          {filledCount > 0 ? `${filledCount} مسجّل من ${rows.length}` : `${rows.length} خانات`}
        </span>
      }
      hint="اكتب كل طالب في خانته؛ الخانات الفارغة لا تظهر في الغلاف."
    >
      <div className="flex flex-col gap-2">
        {rows.map((name, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] text-[0.75rem] font-bold text-zinc-600 dark:text-zinc-300 tabular-nums"
            >
              {i + 1}
            </span>
            <input
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              disabled={disabled}
              className="field"
              value={name}
              onChange={(e) => updateRow(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPaste={(e) => handlePaste(e, i)}
              placeholder={`اسم ولقب الطالب ${i + 1}...`}
              aria-label={`الطالب ${i + 1}`}
            />
            <button
              type="button"
              disabled={disabled || (rows.length <= 1 && name === "")}
              onClick={() => removeRow(i)}
              aria-label={rows.length <= 1 ? "مسح اسم الطالب" : `حذف الطالب ${i + 1}`}
              title={rows.length <= 1 ? "مسح الخانة" : "حذف هذا الطالب"}
              className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-transparent text-zinc-400 transition hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}

        <div className="pt-0.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={disabled}
            icon={<Plus className="size-3.5" />}
            onClick={addRow}
          >
            إضافة طالب
          </Button>
        </div>
      </div>
    </Field>
  );
}
