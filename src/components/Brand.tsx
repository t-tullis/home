import { House } from 'lucide-react'

export function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-[10px] bg-accent text-white shadow-card">
        <House className="size-4" strokeWidth={2.5} />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Homeroom</span>
    </span>
  )
}
