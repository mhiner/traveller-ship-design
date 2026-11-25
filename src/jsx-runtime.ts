import { fragment, jsx, jsxs } from "./runtime.ts";

export { fragment as Fragment, jsx, jsxs };

type DomEvent<T extends EventTarget, E extends Event> = E & {
  currentTarget: T;
};

interface Common<T extends EventTarget> {
  children?: unknown;
  key?: string | number;
  className?: string;
  style?: { [key: string]: string | number };
  hidden?: boolean;
  id?: string;
  role?: string;
  title?: string;
  tabIndex?: number;
  ref?: { current: T | null } | ((instance: T | null) => void) | null;
  "aria-label"?: string;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-pressed"?: boolean | "true" | "false" | "mixed";
  "aria-expanded"?: boolean | "true" | "false";
  "aria-current"?:
    | boolean
    | "page"
    | "step"
    | "location"
    | "date"
    | "time"
    | "true"
    | "false";
  onClick?: (event: DomEvent<T, MouseEvent>) => void;
  onMouseDown?: (event: DomEvent<T, MouseEvent>) => void;
  onChange?: (event: DomEvent<T, Event>) => void;
  onBlur?: (event: DomEvent<T, FocusEvent>) => void;
  dangerouslySetInnerHTML?: { __html: string };
}

interface InputAttrs extends Common<HTMLInputElement> {
  type?: string;
  name?: string;
  value?: string | number | readonly string[];
  checked?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  accept?: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  multiple?: boolean;
}

interface SelectAttrs extends Common<HTMLSelectElement> {
  value?: string | number | readonly string[];
  disabled?: boolean;
  name?: string;
  required?: boolean;
  multiple?: boolean;
}

interface TextareaAttrs extends Common<HTMLTextAreaElement> {
  value?: string | number;
  disabled?: boolean;
  readOnly?: boolean;
  name?: string;
  rows?: number;
  cols?: number;
  placeholder?: string;
}

interface ButtonAttrs extends Common<HTMLButtonElement> {
  type?: string;
  disabled?: boolean;
  name?: string;
  value?: string | number;
}

interface OptionAttrs extends Common<HTMLOptionElement> {
  value?: string | number;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
}

interface CellAttrs extends Common<HTMLTableCellElement> {
  colSpan?: number;
  rowSpan?: number;
  scope?: string;
}

// TypeScript requires this namespace name for the JSX automatic runtime.
// deno-lint-ignore no-namespace
export namespace JSX {
  export interface IntrinsicAttributes {
    key?: string | number;
  }
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface IntrinsicElements {
    button: ButtonAttrs;
    details: Common<HTMLDetailsElement>;
    div: Common<HTMLDivElement>;
    h2: Common<HTMLHeadingElement>;
    h3: Common<HTMLHeadingElement>;
    input: InputAttrs;
    label: Common<HTMLLabelElement>;
    li: Common<HTMLLIElement>;
    optgroup: Common<HTMLOptGroupElement> & {
      label?: string;
      disabled?: boolean;
    };
    option: OptionAttrs;
    p: Common<HTMLParagraphElement>;
    path: Common<SVGPathElement> & { d?: string; fill?: string };
    section: Common<HTMLElement>;
    select: SelectAttrs;
    small: Common<HTMLElement>;
    span: Common<HTMLSpanElement>;
    summary: Common<HTMLElement>;
    svg: Common<SVGSVGElement> & {
      viewBox?: string;
      width?: string | number;
      height?: string | number;
    };
    table: Common<HTMLTableElement>;
    tbody: Common<HTMLTableSectionElement>;
    td: CellAttrs;
    textarea: TextareaAttrs;
    th: CellAttrs;
    thead: Common<HTMLTableSectionElement>;
    tr: Common<HTMLTableRowElement>;
    ul: Common<HTMLUListElement>;
  }
}
