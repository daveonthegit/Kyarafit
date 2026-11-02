"use client";

import { useId } from "react";
import { PhotoPill } from "@/components/ui/PhotoPill";

/**
 * Shared light-on-glass form pieces for the creation dialogs (ref 13d) and the
 * full-page create routes. Presentation only — callers own state and submit.
 */

/** Glass-outline text field (`.glass-field`), 44px tap height. */
export const glassFieldClass =
  "glass-field block w-full min-h-[44px] px-[13px] py-[11px] text-sm focus-visible:ring-2 focus-visible:ring-kyar-accent";

/** Standard 10px uppercase meta label at 60% light. */
export const glassLabelClass =
  "mb-[5px] block text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70";

/** Helper / hint copy under a field. */
export const glassHintClass = "mt-2 text-xs text-media-fg-55";

/** Error copy on glass. */
export const glassErrorClass = "text-sm text-on-glass-danger";

export function GlassLabel({
  htmlFor,
  id,
  children,
}: {
  htmlFor?: string;
  id?: string;
  children: React.ReactNode;
}) {
  if (!htmlFor) {
    return (
      <span id={id} className={glassLabelClass}>
        {children}
      </span>
    );
  }
  return (
    <label id={id} htmlFor={htmlFor} className={glassLabelClass}>
      {children}
    </label>
  );
}

type GlassTextFieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string };

/** Label + glass-outline input with the label wired to the field. */
export function GlassTextField({ label, id, className = "", ...props }: GlassTextFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div>
      <GlassLabel htmlFor={fieldId}>{label}</GlassLabel>
      <input id={fieldId} className={`${glassFieldClass} ${className}`} {...props} />
    </div>
  );
}

/**
 * Segmented control (QA-3 exempt): active = solid light + ink, inactive =
 * glass outline at 60%. Every segment keeps a 44px tap target.
 */
export function GlassSegmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const labelId = useId();
  return (
    <div>
      <GlassLabel id={labelId}>{label}</GlassLabel>
      <div
        role="group"
        aria-labelledby={labelId}
        className={`mt-[3px] flex flex-wrap gap-2 ${className}`}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`min-h-[44px] rounded-full px-4 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                active
                  ? "border border-transparent bg-glass-solid text-glass-ink"
                  : "border border-glass-border-strong text-media-fg-70 hover:bg-glass-active hover:text-kyar-media-fg"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Dialog footer: outline Cancel + the view's single solid-light primary. */
export function CreationFooter({
  onCancel,
  cancelLabel,
  cancelDisabled = false,
  formId,
  submitLabel,
  submitDisabled,
}: {
  onCancel: () => void;
  cancelLabel: string;
  cancelDisabled?: boolean;
  formId: string;
  submitLabel: string;
  submitDisabled: boolean;
}) {
  return (
    <>
      <PhotoPill
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={cancelDisabled}
        className="flex-1"
      >
        {cancelLabel}
      </PhotoPill>
      <PhotoPill
        type="submit"
        form={formId}
        variant="solid"
        disabled={submitDisabled}
        className="flex-1"
      >
        {submitLabel}
      </PhotoPill>
    </>
  );
}

/**
 * react-day-picker class overrides so the range calendar reads on glass. The
 * `data-selected` flag lives on the day cell (`group`), not the button.
 */
export const glassCalendarClassNames = {
  months: "gap-6 sm:gap-8",
  month:
    "relative first-of-type:before:hidden before:absolute max-sm:before:inset-x-2 max-sm:before:h-px max-sm:before:-top-2 sm:before:inset-y-2 sm:before:w-px before:bg-glass-divider sm:before:-left-4",
  caption_label: "text-kyar-media-fg",
  weekday: "text-media-fg-55",
  button_previous: "text-media-fg-70 hover:text-kyar-media-fg hover:bg-glass-active",
  button_next: "text-media-fg-70 hover:text-kyar-media-fg hover:bg-glass-active",
  day_button:
    "text-kyar-media-fg hover:bg-glass-active group-data-[selected]:bg-glass-solid group-data-[selected]:text-glass-ink group-data-[selected]:hover:bg-glass-solid data-[disabled]:text-media-fg-45 data-[outside]:text-media-fg-45 group-data-[selected]:group-[.range-middle]:bg-glass-active group-data-[selected]:group-[.range-middle]:text-kyar-media-fg group-data-[selected]:group-[.range-middle]:hover:bg-glass-active",
  today: "*:after:bg-kyar-media-fg data-[selected]:*:after:bg-glass-ink",
  outside: "text-media-fg-45",
};

export type GroupVisibility = "private" | "public";

/**
 * Group create fields (name, description, visibility) — shared by the creation
 * dialog and the /groups/new page so both render the same 13d anatomy.
 */
export function GroupFields({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  visibility,
  onVisibilityChange,
  labels,
}: {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  visibility: GroupVisibility;
  onVisibilityChange: (value: GroupVisibility) => void;
  labels: {
    name: string;
    namePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    visibility: string;
    private: string;
    public: string;
    visibilityHint: string;
  };
}) {
  const descriptionId = useId();
  return (
    <>
      <GlassTextField
        label={labels.name}
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        required
        maxLength={500}
        placeholder={labels.namePlaceholder}
      />
      <div>
        <GlassLabel htmlFor={descriptionId}>{labels.description}</GlassLabel>
        <textarea
          id={descriptionId}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          maxLength={10000}
          rows={3}
          placeholder={labels.descriptionPlaceholder}
          className={`${glassFieldClass} resize-y`}
        />
      </div>
      <div>
        <GlassSegmented
          label={labels.visibility}
          options={[
            { value: "private", label: labels.private },
            { value: "public", label: labels.public },
          ]}
          value={visibility}
          onChange={onVisibilityChange}
        />
        <p className={glassHintClass}>{labels.visibilityHint}</p>
      </div>
    </>
  );
}
