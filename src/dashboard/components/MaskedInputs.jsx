import { useEffect, useRef, useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { cn } from "../../lib/utils.js";

function isoToDateDigits(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${m}${d}${y}`;
}

export function dateDigitsToIso(digits) {
  if (digits.length !== 8) return "";
  const mm = digits.slice(0, 2);
  const dd = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
}

function to24Hour(hour12, period) {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

function value24To12Parts(value) {
  if (!value || value.length < 5) return { digits: "", period: "AM" };
  const [h, m] = value.split(":").map((part) => parseInt(part, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return { digits: "", period: "AM" };
  const period = h >= 12 ? "PM" : "AM";
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return {
    digits: `${String(hour12).padStart(2, "0")}${String(m).padStart(2, "0")}`,
    period
  };
}

function normalizeTimeDigitsLength(digits) {
  if (digits.length === 3) return `0${digits}`;
  return digits;
}

export function timeDigitsToValue(digits, period = "AM") {
  const normalized = normalizeTimeDigitsLength(digits);
  if (normalized.length < 4) return "";
  const hour12 = parseInt(normalized.slice(0, 2), 10);
  const minute = parseInt(normalized.slice(2, 4), 10);
  if (hour12 < 1 || hour12 > 12 || minute > 59) return "";
  const h24 = to24Hour(hour12, period);
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatPartial12(digits) {
  if (!digits) return { hour: "", minute: "" };
  if (digits.length === 1) return { hour: digits, minute: "" };
  if (digits.length === 2) return { hour: digits, minute: "" };
  if (digits.length === 3) {
    const twoHour = parseInt(digits.slice(0, 2), 10);
    if (twoHour >= 1 && twoHour <= 12) {
      return { hour: digits.slice(0, 2), minute: digits.slice(2) };
    }
    return { hour: digits.slice(0, 1), minute: digits.slice(1) };
  }
  return { hour: digits.slice(0, 2), minute: digits.slice(2, 4) };
}

function TimeMaskDisplay({ digits, period, focused, onPeriodChange }) {
  if (!digits && !focused) {
    return <span className="masked-input__placeholder">12:45 AM</span>;
  }

  const { hour, minute } = formatPartial12(digits);

  return (
    <span className="masked-input__value masked-input__value--time" aria-hidden="true">
      <span className="masked-input__segment">{hour}</span>
      <span className="masked-input__sep">:</span>
      <span className="masked-input__segment">{minute}</span>
      <button
        type="button"
        className="masked-input__period"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          onPeriodChange?.(period === "AM" ? "PM" : "AM");
        }}
      >
        {period}
      </button>
    </span>
  );
}

function DateMaskDisplay({ digits, focused }) {
  if (!digits && !focused) {
    return <span className="masked-input__placeholder">mm/dd/yyyy</span>;
  }

  const mm = digits.slice(0, 2);
  const dd = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);

  return (
    <span className="masked-input__value" aria-hidden="true">
      <span className="masked-input__segment">{mm}</span>
      <span className="masked-input__sep">/</span>
      <span className="masked-input__segment">{dd}</span>
      <span className="masked-input__sep">/</span>
      <span className="masked-input__segment masked-input__segment--year">{yyyy}</span>
    </span>
  );
}

function openNativePicker(nativeRef) {
  const el = nativeRef.current;
  if (!el) return;
  if (typeof el.showPicker === "function") {
    el.showPicker();
    return;
  }
  el.click();
}

function normalize12HourDigits(raw) {
  const next = raw.replace(/\D/g, "").slice(0, 4);
  if (next.length < 2) return next;

  const hour = parseInt(next.slice(0, 2), 10);
  if (hour > 12) {
    return `0${next.slice(0, 1)}${next.slice(1)}`.slice(0, 4);
  }
  if (hour === 0) {
    return `12${next.slice(2)}`.slice(0, 4);
  }
  return next;
}

export function MaskedDateInput({ value, onChange, className, id, "aria-label": ariaLabel }) {
  const inputRef = useRef(null);
  const nativeRef = useRef(null);
  const [digits, setDigits] = useState(() => isoToDateDigits(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    if (!value) {
      setDigits("");
      return;
    }
    setDigits(isoToDateDigits(value));
  }, [value, focused]);

  function handleChange(e) {
    const next = e.target.value.replace(/\D/g, "").slice(0, 8);
    setDigits(next);
    onChange?.(dateDigitsToIso(next));
  }

  function handleNativeChange(e) {
    const iso = e.target.value;
    setDigits(isoToDateDigits(iso));
    onChange?.(iso);
  }

  function handleBlur() {
    setFocused(false);
    if (digits.length === 8) {
      onChange?.(dateDigitsToIso(digits));
    }
  }

  return (
    <div className={cn("masked-input", className)}>
      <div
        className="masked-input__field"
        onClick={() => inputRef.current?.focus()}
      >
        <DateMaskDisplay digits={digits} focused={focused} />
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel || "Date"}
          className="masked-input__control"
          value={digits}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
        />
      </div>
      <button
        type="button"
        className="masked-input__picker-btn"
        aria-label="Choose date"
        onClick={(e) => {
          e.stopPropagation();
          openNativePicker(nativeRef);
        }}
      >
        <Calendar className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        ref={nativeRef}
        type="date"
        className="masked-input__native"
        value={value || ""}
        onChange={handleNativeChange}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

export function MaskedTimeInput({ value, onChange, className, id, "aria-label": ariaLabel }) {
  const inputRef = useRef(null);
  const nativeRef = useRef(null);
  const initial = value24To12Parts(value);
  const [digits, setDigits] = useState(initial.digits);
  const [period, setPeriod] = useState(initial.period);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    if (!value) {
      setDigits("");
      setPeriod("AM");
      return;
    }
    const parts = value24To12Parts(value);
    setDigits(parts.digits);
    setPeriod(parts.period);
  }, [value, focused]);

  function emit(nextDigits, nextPeriod) {
    if (nextDigits.length === 4) {
      onChange?.(timeDigitsToValue(nextDigits, nextPeriod));
      return;
    }
    if (nextDigits.length === 3) {
      onChange?.("");
      return;
    }
    onChange?.("");
  }

  function commitDigits(nextDigits, nextPeriod) {
    let resolved = nextDigits;
    if (resolved.length === 3) {
      resolved = `0${resolved}`;
      setDigits(resolved);
    }
    if (resolved.length === 4) {
      const value = timeDigitsToValue(resolved, nextPeriod);
      if (value) onChange?.(value);
    }
  }

  function handleChange(e) {
    const next = normalize12HourDigits(e.target.value);
    setDigits(next);
    emit(next, period);
  }

  function handlePeriodChange(nextPeriod) {
    setPeriod(nextPeriod);
    if (digits.length === 4) {
      onChange?.(timeDigitsToValue(digits, nextPeriod));
    } else if (digits.length === 3) {
      commitDigits(digits, nextPeriod);
    }
  }

  function handleBlur() {
    setFocused(false);
    commitDigits(digits, period);
  }

  function handleNativeChange(e) {
    const next = e.target.value;
    const parts = value24To12Parts(next);
    setDigits(parts.digits);
    setPeriod(parts.period);
    onChange?.(next);
  }

  return (
    <div className={cn("masked-input", className)}>
      <div
        className="masked-input__field"
        onClick={() => inputRef.current?.focus()}
      >
        <TimeMaskDisplay
          digits={digits}
          period={period}
          focused={focused}
          onPeriodChange={handlePeriodChange}
        />
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel || "Time"}
          className="masked-input__control"
          value={digits}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
        />
      </div>
      <button
        type="button"
        className="masked-input__picker-btn"
        aria-label="Choose time"
        onClick={(e) => {
          e.stopPropagation();
          openNativePicker(nativeRef);
        }}
      >
        <Clock className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        ref={nativeRef}
        type="time"
        className="masked-input__native"
        value={value && value.length >= 5 ? value : ""}
        onChange={handleNativeChange}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
