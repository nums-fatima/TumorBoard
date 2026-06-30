import type { Source } from '../types'

const SOURCE_COLOR: Record<string, string> = {
  pubmed: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
  clinicaltrials: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  civic: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
  pdq: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
}

export default function CitationPill({ source }: { source: Source }) {
  const color = SOURCE_COLOR[source.source_type] ?? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      title={source.label}
      className={`inline-flex max-w-[220px] items-center truncate rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${color}`}
    >
      {source.label}
    </a>
  )
}
