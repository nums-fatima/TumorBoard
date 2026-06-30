import { useState } from 'react'
import type { Report } from '../types'
import CitationPill from './CitationPill'
import Markdown from './Markdown'
import { downloadReportPdf } from '../lib/pdf'

export default function ReportView({ report, question, fullContent }: { report: Report; question?: string; fullContent?: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyRich = async () => {
    // Build the markdown string
    let md = fullContent?.trim() ?? toMarkdown(report)
    if (fullContent && report.sources.length > 0) {
      const groups: Record<string, typeof report.sources> = {}
      report.sources.forEach((s) => { const k = s.source_type || 'other'; (groups[k] = groups[k] || []).push(s) })
      const typeLabel: Record<string, string> = {
        pubmed: 'PubMed Literature', clinicaltrials: 'Clinical Trials (ClinicalTrials.gov)',
        civic: 'CIViC Biomarker Database', pdq: 'NCI PDQ Guidelines',
      }
      md += '\n\n---\n\n## Sources\n'
      Object.entries(groups).forEach(([type, sources]) => {
        md += `\n### ${typeLabel[type] || type}\n\n`
        sources.forEach((s, i) => { md += `${i + 1}. [${s.label}](${s.url})\n` })
      })
    }

    // Convert markdown → HTML so Google Docs / Word paste with real formatting
    const html = mdToHtml(md)

    try {
      // Write both types — rich editors (Docs, Notion, Word) use text/html;
      // plain-text editors fall back to text/plain.
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([md],   { type: 'text/plain' }),
        }),
      ])
    } catch {
      // Fallback for browsers that block ClipboardItem
      await navigator.clipboard.writeText(md)
    }

    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50">
      {/* Header — PDF button lives here so it's always visible */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left">
          <svg className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-semibold text-slate-700">Full Research Report</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
            {report.sources.length} sources
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={copyRich}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
            title="Copies as rich text — pastes with bold, headings, and links into Google Docs, Notion, Word"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button
            onClick={() => downloadReportPdf(report, question, fullContent)}
            className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download PDF
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-slate-200 px-4 py-4 text-sm">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Summary</h3>
            <div className="mt-1 text-slate-700">
              <Markdown>{report.summary}</Markdown>
            </div>
          </div>

          {report.evidence_level_notes && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Evidence Level</h3>
              <div className="mt-1 text-slate-600">
                <Markdown>{report.evidence_level_notes}</Markdown>
              </div>
            </div>
          )}

          {report.contradictions.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-600">⚠ Caveats / Contradictions</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-700">
                {report.contradictions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {report.sections.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">By Agent</h3>
              {report.sections.map((s, i) => (
                <div key={i} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                  <p className="text-xs font-semibold text-blue-600">{s.agent}</p>
                  <p className="mt-0.5 text-slate-600">{s.summary}</p>
                </div>
              ))}
            </div>
          )}

          {report.sources.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sources</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {report.sources.map((s, i) => (
                  <CitationPill key={i} source={s} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function toMarkdown(report: Report): string {
  const lines = ['# TumorBoard Research Report', '', '## Summary', report.summary, '']
  if (report.evidence_level_notes) lines.push('## Evidence Level', report.evidence_level_notes, '')
  if (report.contradictions.length) {
    lines.push('## Caveats / Contradictions')
    report.contradictions.forEach((c) => lines.push(`- ${c}`))
    lines.push('')
  }
  if (report.sections.length) {
    lines.push('## By Agent')
    report.sections.forEach((s) => lines.push(`### ${s.agent}`, s.summary, ''))
  }
  if (report.sources.length) {
    lines.push('## Sources')
    report.sources.forEach((s) => lines.push(`- [${s.label}](${s.url})`))
  }
  return lines.join('\n')
}

/** Convert our markdown output to HTML so Google Docs / Word / Notion paste
 *  with REAL formatting — actual bold headings, bullets, links — not raw symbols. */
function mdToHtml(md: string): string {
  const inline = (text: string) =>
    text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#1d4ed8">$1</a>')

  const lines = md.split('\n')
  const out: string[] = []
  let inUl = false
  let inOl = false

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false }
    if (inOl) { out.push('</ol>'); inOl = false }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { closeList(); continue }

    if (line.startsWith('## ')) {
      closeList()
      out.push(`<h2 style="font-size:1.25em;font-weight:700;color:#1e3a8a;border-bottom:2px solid #bfdbfe;padding-bottom:4px;margin-top:20px;margin-bottom:6px">${inline(line.slice(3))}</h2>`)
    } else if (line.startsWith('### ')) {
      closeList()
      out.push(`<h3 style="font-size:1.05em;font-weight:600;color:#334155;margin-top:14px;margin-bottom:4px">${inline(line.slice(4))}</h3>`)
    } else if (line.startsWith('#### ')) {
      closeList()
      out.push(`<h4 style="font-size:0.95em;font-weight:600;color:#475569;margin-top:10px;margin-bottom:4px">${inline(line.slice(5))}</h4>`)
    } else if (line === '---') {
      closeList()
      out.push('<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">')
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inUl) { out.push('<ul style="margin:4px 0;padding-left:20px">'); inUl = true }
      out.push(`<li style="margin:3px 0">${inline(line.slice(2))}</li>`)
    } else if (/^\d+\. /.test(line)) {
      if (!inOl) { out.push('<ol style="margin:4px 0;padding-left:20px">'); inOl = true }
      out.push(`<li style="margin:3px 0">${inline(line.replace(/^\d+\. /, ''))}</li>`)
    } else {
      closeList()
      out.push(`<p style="margin:5px 0;line-height:1.6">${inline(line)}</p>`)
    }
  }

  closeList()
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:11pt;color:#1e293b;max-width:820px;line-height:1.6">${out.join('')}</body></html>`
}
