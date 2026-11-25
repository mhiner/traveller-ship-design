interface NumberFieldProps {
  label: string;
  note?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  onChange: (value: number) => void;
}

export function NumberField(
  { label, note = "", value, min, max, step, readOnly = false, onChange }:
    NumberFieldProps,
) {
  return (
    <label>
      <span>
        {label}
        {note ? <small className="custom-note">({note})</small> : null}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        readOnly={readOnly}
        onChange={(event) => {
          if (readOnly) return;
          onChange(Number(event.currentTarget.value));
        }}
      />
    </label>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function TextField({ label, value, onChange }: TextFieldProps) {
  return (
    <label>
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}
