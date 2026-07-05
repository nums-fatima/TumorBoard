import type { AgentLogEntry, AgentName, AgentState } from '../types'

const AGENT_CONFIG: Record<AgentName, { label: string; short: string; dot: string; badge: string; text: string }> = {
  Orchestrator: { label: 'Orchestrator', short: 'ORC', dot: 'bg-blue-600',    badge: 'bg-blue-100 text-blue-800',    text: 'text-blue-800'    },
  Literature:   { label: 'Literature',   short: 'LIT', dot: 'bg-sky-500',     badge: 'bg-sky-100 text-sky-800',      text: 'text-sky-800'     },
  ClinicalTrial:{ label: 'Trials',       short: 'TRL', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800', text: 'text-emerald-800' },
  Guideline:    { label: 'Guideline',    short: 'PDQ', dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-800',  text: 'text-amber-800'   },
  Biomarker:    { label: 'Biomarker',    short: 'BIO', dot: 'bg-violet-500',  badge: 'bg-violet-100 text-violet-800', text: 'text-violet-800'  },
  Synthesizer:  { label: 'Synthesizer',  short: 'SYN', dot: 'bg-rose-500',   badge: 'bg-rose-100 text-rose-800',    text: 'text-rose-800'    },
  'Web Sources': { label: 'Web Sources',  short: 'WEB', dot: 'bg-teal-500',   badge: 'bg-teal-100 text-teal-800',    text: 'text-teal-800'    },
}

const AGENT_ORDER: AgentName[] = ['Orchestrator', 'Literature', 'ClinicalTrial', 'Guideline', 'Biomarker', 'Web Sources', 'Synthesizer']

interface TimelineEntry extends AgentLogEntry {
  agent: AgentName
}

export default function AgentStatusPanel({ agents }: { agents: Record<AgentName, AgentState> }) {
  // Merge all agent histories into one chronological timeline
  const timeline: TimelineEntry[] = AGENT_ORDER
    .flatMap((name) => agents[name].history.map((e) => ({ ...e, agent: name })))
    .sort((a, b) => a.time.localeCompare(b.time))

  const anyActive = AGENT_ORDER.some((n) => agents[n].status === 'running')
  const allDone = AGENT_ORDER.filter(n => n !== 'Orchestrator' && n !== 'Synthesizer')
                             .every((n) => agents[n].status === 'done' || agents[n].status === 'idle')

  return (
    <div className="flex h-full min-h-0 flex-col">

      {/* ── Status grid — 2 columns, full names, clear status ────── */}
      <div className="shrink-0 border-b border-slate-100 px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          {AGENT_ORDER.map((name) => {
            const state = agents[name]
            const cfg = AGENT_CONFIG[name]
            const isRunning = state.status === 'running'
            const isDone = state.status === 'done'
            const isError = state.status === 'error'
            return (
              <div
                key={name}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${
                  isRunning ? 'bg-blue-50 ring-1 ring-blue-200' :
                  isDone    ? 'bg-slate-50' :
                  isError   ? 'bg-rose-50' : 'bg-transparent'
                }`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot} ${
                  isRunning ? 'animate-pulse' : isDone || isError ? 'opacity-100' : 'opacity-25'
                }`} />
                <div className="min-w-0">
                  <p className={`text-[12px] font-semibold leading-tight ${
                    isRunning ? cfg.text : isDone ? 'text-slate-800' : isError ? 'text-rose-700' : 'text-slate-400'
                  }`}>
                    {cfg.label}
                  </p>
                  <p className={`text-[10px] leading-tight ${
                    isRunning ? 'text-blue-500' : isDone ? 'text-emerald-600' : isError ? 'text-rose-500' : 'text-slate-300'
                  }`}>
                    {isRunning ? 'Working…' : isDone ? 'Done' : isError ? 'Error' : 'Idle'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Phase pill */}
        <div className={`mt-3 rounded-full py-1 text-center text-[10px] font-bold uppercase tracking-widest ${
          anyActive ? 'bg-blue-100 text-blue-700' :
          allDone   ? 'bg-emerald-100 text-emerald-700' :
          'bg-slate-100 text-slate-400'
        }`}>
          {anyActive ? '● Researching' : allDone ? '✓ Complete' : '○ Waiting for question'}
        </div>
      </div>

      {/* ── Chronological timeline ───────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {timeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <svg className="mb-3 h-10 w-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12h3l3-9 4 18 3-9h5" />
            </svg>
            <p className="text-sm font-medium text-slate-400">No activity yet</p>
            <p className="mt-1 text-[11px] text-slate-300">Ask a question to see the agents in action</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-[7px] top-0 h-full w-[2px] bg-slate-100" />

            <div className="space-y-0">
              {timeline.map((entry, i) => {
                const cfg = AGENT_CONFIG[entry.agent]
                const isRunning = entry.status === 'running'
                const isDone = entry.status === 'done'
                const isError = entry.status === 'error'

                return (
                  <div key={i} className="relative flex gap-3 pb-4 pl-1">
                    {/* Dot on the line */}
                    <div className={`relative z-10 mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-white ${cfg.dot} ${isRunning ? 'animate-pulse' : ''} ${!isDone && !isError && !isRunning ? 'opacity-50' : ''}`} />

                    {/* Content */}
                    <div className="min-w-0 flex-1 pt-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Agent badge */}
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        {/* Timestamp */}
                        <span className="font-mono text-[11px] text-slate-400">{entry.time}</span>
                        {/* Status icon */}
                        {isDone    && <span className="text-[11px] font-bold text-emerald-600">✓</span>}
                        {isError   && <span className="text-[11px] font-bold text-rose-600">✗</span>}
                        {isRunning && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />}
                      </div>
                      <p className={`mt-1 text-[13px] leading-relaxed ${
                        isError   ? 'text-rose-600' :
                        isDone    ? 'text-slate-800' :
                        isRunning ? 'font-semibold text-blue-700' :
                        'text-slate-500'
                      }`}>
                        {entry.message}
                      </p>
                    </div>
                  </div>
                )
              })}

              {/* Active spinner at the bottom when running */}
              {anyActive && (
                <div className="relative flex gap-3 pl-1">
                  <div className="relative z-10 mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                  <p className="pt-0.5 text-[12px] font-medium text-blue-600">Working...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
