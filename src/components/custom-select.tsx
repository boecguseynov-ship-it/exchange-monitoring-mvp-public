"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type CustomSelectProps = {
  /** Массив опций */
  options: SelectOption[];
  /** Текущее значение (controlled) */
  value?: string;
  /** Значение по умолчанию (uncontrolled / form) */
  defaultValue?: string;
  /** name для работы в нативных form */
  name?: string;
  /** Placeholder, показывается если значение пустое или отключено */
  placeholder?: string;
  /** Вариант оформления */
  variant?: "default" | "ghost" | "compact";
  /** Disabled */
  disabled?: boolean;
  /** Обработчик изменения */
  onChange?: (value: string) => void;
  /** className на корневом элементе */
  className?: string;
  /** id для label */
  id?: string;
};

export function CustomSelect({
  options,
  value,
  defaultValue,
  name,
  placeholder,
  variant = "default",
  disabled = false,
  onChange,
  className = "",
  id,
}: CustomSelectProps) {
  const isControlled = value !== undefined;

  const [internalValue, setInternalValue] = useState<string>(
    defaultValue ?? ""
  );
  const current = isControlled ? value : internalValue;

  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [dropdownTheme, setDropdownTheme] = useState<"monitoringGreen" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const uid = useId();
  const selectId = id ?? uid;

  // Вычислить позицию dropdown под триггером
  function calcDropdownPos() {
    if (!rootRef.current) return;
    const root = rootRef.current;
    const nextTheme = root.closest(".appMonitoringGreen") ? "monitoringGreen" : null;
    setDropdownTheme((theme) => (theme === nextTheme ? theme : nextTheme));

    const rect = root.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = Math.min(240, spaceBelow - 8);
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 2,
      left: rect.left,
      width: rect.width,
      maxHeight: dropH > 80 ? dropH : Math.min(240, rect.top - 8),
      zIndex: 9999,
    });
  }

  // Открыть / закрыть
  function toggleOpen() {
    if (disabled) return;
    if (!open) calcDropdownPos();
    setOpen((o) => !o);
  }

  // Пересчитывать позицию при скролле / ресайзе пока открыт
  useEffect(() => {
    if (!open) return;
    function update() { calcDropdownPos(); }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Закрывать при клике вне компонента
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideRoot = rootRef.current?.contains(target);
      const insideList = listRef.current?.contains(target);
      if (!insideRoot && !insideList) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  // Клавиатурная навигация
  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleOpen();
    }
    if (e.key === "Escape") setOpen(false);
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && open) {
      e.preventDefault();
      const items = listRef.current?.querySelectorAll<HTMLLIElement>(
        "[role='option']:not([aria-disabled='true'])"
      );
      if (!items || items.length === 0) return;
      const idx = Array.from(items).findIndex(
        (li) => li.dataset.value === current
      );
      const next =
        e.key === "ArrowDown"
          ? Math.min(idx + 1, items.length - 1)
          : Math.max(idx - 1, 0);
      items[next].focus();
    }
  }

  function select(val: string) {
    if (!isControlled) setInternalValue(val);
    onChange?.(val);
    setOpen(false);
  }

  const activeOption = options.find((o) => o.value === current);
  const displayLabel = activeOption?.label ?? placeholder ?? "Выберите…";
  const isEmpty = !activeOption || activeOption.disabled;

  const dropdownEl = open ? (
    <ul
      ref={listRef}
      id={`${selectId}-list`}
      role="listbox"
      className={`csDropdown${dropdownTheme === "monitoringGreen" ? " csDropdown--monitoringGreen" : ""}`}
      style={dropdownStyle}
    >
      {options.map((opt) => (
        <li
          key={opt.value}
          role="option"
          data-value={opt.value}
          aria-selected={opt.value === current}
          aria-disabled={opt.disabled}
          tabIndex={opt.disabled ? -1 : 0}
          className={`csOption${opt.value === current ? " csOption--selected" : ""}${opt.disabled ? " csOption--disabled" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!opt.disabled) select(opt.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!opt.disabled) select(opt.value);
            }
            if (e.key === "Escape") setOpen(false);
          }}
        >
          {opt.label}
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`csWrap csWrap--${variant}${open ? " csWrap--open" : ""}${disabled ? " csWrap--disabled" : ""} ${className}`}
      aria-disabled={disabled}
    >
      {/* Скрытый нативный select для FormData */}
      {name && (
        <select
          name={name}
          value={current}
          tabIndex={-1}
          aria-hidden="true"
          className="csShadowSelect"
          onChange={(e) => {
            if (!isControlled) setInternalValue(e.target.value);
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {/* Кнопка-триггер */}
      <button
        id={selectId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${selectId}-list`}
        disabled={disabled}
        className={`csTrigger${isEmpty ? " csTrigger--empty" : ""}`}
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
      >
        <span className="csTriggerLabel">{displayLabel}</span>
        <ChevronDown size={14} className="csChevron" />
      </button>

      {/* Выпадающий список рендерится в document.body через Portal */}
      {typeof document !== "undefined" && dropdownEl
        ? createPortal(dropdownEl, document.body)
        : null}
    </div>
  );
}
