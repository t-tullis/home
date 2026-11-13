import { ExternalLink, X } from 'lucide-react'
import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn, hostOf, safeUrl } from '../lib/format'
import { STATUS_META, STUDENT_COLORS, SUBJECT_HUES } from '../lib/subjects'
import type { AssignmentStatus, Student } from '../lib/types'

const hue = (h: number) => ({ '--h': h }) as CSSProperties

// --- Button -----------------------------------------------------------------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover shadow-card',
  secondary: 'bg-surface text-ink border border-line hover:bg-sunken shadow-card',
  ghost: 'text-muted hover:text-ink hover:bg-sunken',
  danger: 'bg-surface text-danger border border-line hover:bg-danger-soft',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
}

export function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
}

// --- Surfaces ---------------------------------------------------------------
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl border border-line bg-surface shadow-card', className)}>{children}</div>
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <div className="mb-3 grid size-11 place-items-center rounded-full bg-accent-soft text-accent-ink">{icon}</div>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  )
}

// --- Badges -----------------------------------------------------------------
const TONES = {
  neutral: 'bg-sunken text-muted',
  accent: 'bg-accent-soft text-accent-ink',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
}

export function StatusBadge({ status }: { status: AssignmentStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap', TONES[meta.tone])}>
      <span className="size-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  )
}

export function SubjectChip({ subject }: { subject: string }) {
  return (
    <span className="tint inline-flex rounded-md px-2 py-0.5 text-xs font-medium" style={hue(SUBJECT_HUES[subject] ?? SUBJECT_HUES.Other)}>
      {subject}
    </span>
  )
}

export function Avatar({ student, size = 'md' }: { student: Pick<Student, 'name' | 'color'>; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'size-6 text-[11px]', md: 'size-9 text-sm', lg: 'size-12 text-lg' }
  return (
    <span
      className={cn('tint-solid inline-grid shrink-0 place-items-center rounded-full font-semibold', sizes[size])}
      style={hue(STUDENT_COLORS[student.color] ?? STUDENT_COLORS.iris)}
      aria-hidden
    >
      {student.name.charAt(0).toUpperCase()}
    </span>
  )
}

/** A link out to wherever the work lives. Renders nothing for non-web URLs. */
export function LinkPill({ url, label, onOpen }: { url: string; label?: string | null; onOpen?: () => void }) {
  const href = safeUrl(url)
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
      className="group inline-flex max-w-full items-center gap-2 rounded-xl border border-line bg-surface py-1.5 pr-3 pl-1.5 text-sm transition-colors hover:border-accent hover:bg-accent-soft"
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-sunken text-[11px] font-semibold text-muted uppercase group-hover:bg-surface">
        {hostOf(href).charAt(0)}
      </span>
      <span className="truncate font-medium">{label || hostOf(href)}</span>
      <ExternalLink className="size-3.5 shrink-0 text-faint group-hover:text-accent-ink" />
    </a>
  )
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </div>
  )
}

// --- Form fields ------------------------------------------------------------
// Fields fill their container unless the caller passes its own width class.
const width = (className?: string) => (className && /(^|\s)w-/.test(className) ? '' : 'w-full')

const FIELD =
  'rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-faint transition-colors focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium">
        {label}
        {hint && <span className="font-normal text-faint">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, width(className), 'h-10', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, width(className), 'min-h-20 resize-y py-2.5', className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(FIELD, width(className), 'h-10', className)} {...props} />
}

// --- Modal (native <dialog>: focus trap and Escape come for free) -----------
interface ModalProps {
  open: boolean
  onClose(): void
  title: string
  description?: string
  children: ReactNode
}

export function Modal({ open, onClose, title, description, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Start in the first field rather than on the close button.
      dialog.querySelector<HTMLElement>('[data-modal-body] :is(input, textarea, select)')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="modal"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose() // click on the backdrop
      }}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 rounded-lg p-2 text-faint hover:bg-sunken hover:text-ink">
              <X className="size-4" />
            </button>
          </header>
          <div data-modal-body className="overflow-y-auto px-6 pb-6">{children}</div>
        </div>
      )}
    </dialog>
  )
}
