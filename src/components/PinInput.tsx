import { cn } from '../lib/format'

interface Props {
  label: string
  value: string
  onChange(value: string): void
  autoFocus?: boolean
  disabled?: boolean
  invalid?: boolean
}

/** Four boxes drawn over one real (invisible) input, so typing, paste and mobile keypads all just work. */
export function PinInput({ label, value, onChange, autoFocus, disabled, invalid }: Props) {
  return (
    <label className="group relative mx-auto block w-fit">
      <span className="sr-only">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={value}
        readOnly={disabled} // not `disabled`: that would drop keyboard focus mid-check
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
        className="absolute inset-0 z-10 cursor-pointer opacity-0"
      />
      <span className="flex gap-3" aria-hidden>
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              'grid size-14 place-items-center rounded-2xl border bg-surface text-2xl shadow-card transition-colors',
              invalid ? 'border-danger' : 'border-line',
              !invalid && index === Math.min(value.length, 3) && 'group-focus-within:border-accent group-focus-within:ring-3 group-focus-within:ring-accent/15',
            )}
          >
            {index < value.length && <span className="size-2.5 rounded-full bg-ink" />}
          </span>
        ))}
      </span>
    </label>
  )
}
