export type AgentName = 'Orchestrator' | 'Literature' | 'ClinicalTrial' | 'Guideline' | 'Biomarker' | 'Synthesizer'

export type AgentStatus = 'idle' | 'ready' | 'running' | 'done' | 'error'

export interface AgentLogEntry {
  status: AgentStatus
  message: string
  time: string
}

export interface AgentState {
  status: AgentStatus
  message: string
  history: AgentLogEntry[]
}

export interface Source {
  agent: string
  label: string
  url: string
  source_type: 'pubmed' | 'clinicaltrials' | 'civic' | 'pdq' | string
}

export interface ReportSection {
  agent: string
  summary: string
}

export interface Report {
  summary: string
  evidence_level_notes: string
  contradictions: string[]
  sections: ReportSection[]
  sources: Source[]
  suggested_followups?: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  report?: Report
}

export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
}

interface AgentStatusEvent {
  type: 'agent_status'
  agent: string
  status: AgentStatus
  message: string
}

interface TokenEvent {
  type: 'token'
  content: string
}

interface ReportEvent {
  type: 'report'
  report: Report
}

interface DoneEvent {
  type: 'done'
}

export type ServerEvent = AgentStatusEvent | TokenEvent | ReportEvent | DoneEvent
