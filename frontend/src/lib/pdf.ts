import { jsPDF } from 'jspdf'
import type { Report } from '../types'

// ── Layout constants ───────────────────────────────────────────
const ML = 14          // left margin
const MR = 196         // right margin
const PW = 210         // page width (A4)
const PH = 297         // page height (A4)
const TW = MR - ML     // text usable width = 182mm
const FOOTER = 12      // footer reserved height

// ── Colors ────────────────────────────────────────────────────
type RGB = readonly [number, number, number]
const BLUE:    RGB = [25,  80, 200]
const DARK:    RGB = [10,  20, 40]
const BODY:    RGB = [30,  41, 59]
const MUTED:   RGB = [100, 116, 139]
const TEAL:    RGB = [5,   150, 105]
const AMBER:   RGB = [180, 83,  9]
const WHITE:   RGB = [255, 255, 255]
const LTBLUE:  RGB = [239, 246, 255]
const BORD:    RGB = [226, 232, 240]
const ROW_A:   RGB = [249, 250, 251]
const PUB:     RGB = [2,   132, 199]
const TRIAL:   RGB = [5,   150, 105]
const CIVIC:   RGB = [109, 40,  217]
const PDQ:     RGB = [180, 83,  9]

export function downloadReportPdf(report: Report, question?: string, fullContent?: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 0
  let pageNum = 1

  // ── Primitive helpers ────────────────────────────────────────
  const fill   = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
  const ink    = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])

  const ensure = (need: number) => { if (y + need > PH - FOOTER) { footer(); doc.addPage(); pageNum++; y = 16 } }

  const footer = () => {
    fill(BLUE)
    doc.rect(0, PH - 10, PW, 10, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    ink(WHITE)
    doc.text('TumorBoard · Multi-Agent Oncology Research Assistant', ML, PH - 3.5)
    doc.text(`Page ${pageNum}`, MR, PH - 3.5, { align: 'right' })
  }

  // Safe body-text renderer: set font/size BEFORE calling splitTextToSize
  const bodyText = (text: string, x: number, maxW: number, size = 10, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    ink(BODY)
    const wrapped: string[] = doc.splitTextToSize(text, maxW)
    wrapped.forEach((ln: string) => {
      ensure(size * 0.6)
      doc.text(ln, x, y)
      y += size * 0.55 + 0.5
    })
  }

  // Strip markdown markers so text doesn't render literal **asterisks**
  const clean = (s: string) =>
    s.replace(/\*\*([^*]+)\*\*/g, '$1')
     .replace(/\*([^*]+)\*/g, '$1')
     .replace(/^#+\s*/, '')
     .replace(/^[-*]\s+/, '')
     .replace(/^\d+\.\s+/, '')
     .trim()

  // ── PAGE 1: header band ───────────────────────────────────────
  fill(BLUE)
  doc.rect(0, 0, PW, 36, 'F')
  // accent stripe
  fill([60, 120, 230] as RGB)
  doc.rect(0, 26, PW, 0.8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  ink(WHITE)
  doc.text('TumorBoard', ML, 15)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  ink([180, 210, 255] as RGB)
  doc.text('Multi-Agent Oncology Research Report', ML, 23)

  doc.setFontSize(7.5)
  ink([180, 210, 255] as RGB)
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.text(dateStr, MR, 10, { align: 'right' })
  doc.text('RESEARCH USE ONLY · NOT FOR DIAGNOSTIC USE', MR, 31, { align: 'right' })

  y = 44

  // ── Question box ──────────────────────────────────────────────
  if (question) {
    fill(LTBLUE)
    stroke(BORD)
    doc.setLineWidth(0.3)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    ink(BLUE)
    // pre-measure height
    const qLines: string[] = doc.splitTextToSize(question, TW - 8)
    const qH = qLines.length * 5.5 + 12
    doc.roundedRect(ML, y, TW, qH, 2, 2, 'FD')
    doc.text('RESEARCH QUESTION', ML + 4, y + 5)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10.5)
    ink(DARK)
    qLines.forEach((ln: string, i: number) => doc.text(ln, ML + 4, y + 10 + i * 5.5))
    y += qH + 8
  }

  stroke(BORD)
  doc.setLineWidth(0.3)
  doc.line(ML, y, MR, y)
  y += 8

  // ── Section header helper ─────────────────────────────────────
  const section = (num: string, title: string, accent: RGB = BLUE) => {
    y += 4
    ensure(16)
    fill(accent)
    doc.rect(ML, y - 6, 3.5, 11, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    ink(accent)
    doc.text(num, ML + 7, y - 2.5)
    doc.setFontSize(13)
    ink(DARK)
    doc.text(title, ML + 7, y + 3.5)
    y += 8
    stroke(accent)
    doc.setLineWidth(0.25)
    doc.line(ML, y, MR, y)
    y += 7
  }

  // ── MAIN CONTENT — render the full chat markdown response ─────
  if (fullContent && fullContent.trim()) {
    section('01', 'RESEARCH FINDINGS')

    const lines = fullContent.split('\n')
    let para: string[] = []

    const flushPara = () => {
      if (!para.length) return
      const text = clean(para.join(' '))
      if (text) bodyText(text, ML, TW)
      para = []
      y += 2
    }

    for (const rawLine of lines) {
      const line = rawLine.trim()

      if (!line) { flushPara(); y += 1; continue }

      // ## Section heading
      if (line.startsWith('## ')) {
        flushPara()
        y += 4
        ensure(14)
        const title = clean(line)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11.5)
        ink(BLUE)
        doc.text(title, ML, y)
        y += 1.5
        stroke(BLUE)
        doc.setLineWidth(0.25)
        doc.line(ML, y, ML + doc.getTextWidth(title) + 4, y)
        y += 5.5
        continue
      }

      // ### Sub-heading
      if (line.startsWith('### ')) {
        flushPara()
        ensure(10)
        y += 2
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        ink(MUTED)
        const sub: string[] = doc.splitTextToSize(clean(line), TW)
        sub.forEach((ln: string) => { doc.text(ln, ML, y); y += 5 })
        y += 2
        continue
      }

      // Bullet
      if (line.startsWith('- ') || line.startsWith('* ')) {
        flushPara()
        const text = clean(line)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        ink(BODY)
        const bLines: string[] = doc.splitTextToSize(text, TW - 9)
        const bH = bLines.length * 5 + 2
        ensure(bH)
        fill(BLUE)
        doc.circle(ML + 3.5, y - 1.5, 0.9, 'F')
        bLines.forEach((bl: string, bi: number) => {
          if (bi > 0) ensure(5.5)
          doc.text(bl, ML + 8, y + bi * 5)
        })
        y += bH
        continue
      }

      // Numbered item
      const numMatch = line.match(/^(\d+)\.\s+(.+)$/)
      if (numMatch) {
        flushPara()
        const [, num, content] = numMatch
        const text = clean(content)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        ink(BODY)
        const nLines: string[] = doc.splitTextToSize(text, TW - 10)
        const nH = nLines.length * 5 + 2
        ensure(nH)
        doc.setFont('helvetica', 'bold')
        ink(BLUE)
        doc.text(num + '.', ML, y)
        doc.setFont('helvetica', 'normal')
        ink(BODY)
        nLines.forEach((nl: string, ni: number) => {
          if (ni > 0) ensure(5.5)
          doc.text(nl, ML + 9, y + ni * 5)
        })
        y += nH
        continue
      }

      // Accumulate paragraph
      para.push(rawLine)
    }
    flushPara()
    y += 4
  } else {
    // Fallback: use report.summary
    section('01', 'SUMMARY')
    bodyText(report.summary, ML, TW)
    if (report.evidence_level_notes) {
      y += 4
      section('02', 'EVIDENCE LEVEL', TEAL)
      bodyText(report.evidence_level_notes, ML, TW)
    }
    if (report.contradictions.length > 0) {
      y += 4
      section('03', 'CAVEATS', AMBER)
      report.contradictions.forEach((c) => {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        ink(BODY)
        const cLines: string[] = doc.splitTextToSize(c, TW - 8)
        const cH = cLines.length * 5 + 2
        ensure(cH + 3)
        fill(AMBER)
        doc.circle(ML + 3, y - 1.5, 0.9, 'F')
        cLines.forEach((cl: string, ci: number) => {
          if (ci > 0) ensure(5)
          doc.text(cl, ML + 7, y + ci * 5)
        })
        y += cH
      })
    }
  }

  // ── SOURCES ────────────────────────────────────────────────────
  if (report.sources.length > 0) {
    section('02', 'SOURCES & REFERENCES', BLUE)

    const groups: Record<string, typeof report.sources> = {}
    report.sources.forEach((s) => { const k = s.source_type || 'other'; (groups[k] = groups[k] || []).push(s) })

    const TYPE: Record<string, { label: string; bg: RGB }> = {
      pubmed:         { label: 'PubMed Literature',  bg: PUB   },
      clinicaltrials: { label: 'Clinical Trials',    bg: TRIAL  },
      civic:          { label: 'CIViC Biomarker DB', bg: CIVIC  },
      pdq:            { label: 'NCI PDQ Guidelines', bg: PDQ    },
    }

    let idx = 1
    Object.entries(groups).forEach(([type, sources]) => {
      const { label, bg } = TYPE[type] ?? { label: type, bg: MUTED }

      ensure(14)
      // type header row
      fill(bg)
      doc.rect(ML, y, TW, 7.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      ink(WHITE)
      doc.text(`${label.toUpperCase()}  ·  ${sources.length} sources`, ML + 4, y + 5)
      y += 14

      sources.forEach((s) => {
        // measure label BEFORE drawing row
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        const maxLabelW = TW - 12
        const label = s.label.length > 95 ? s.label.slice(0, 92) + '...' : s.label
        const labelLines: string[] = doc.splitTextToSize(label, maxLabelW)
        const rowH = labelLines.length * 5 + 5

        ensure(rowH + 2)
        if (idx % 2 === 0) {
          fill(ROW_A)
          doc.rect(ML, y - 4, TW, rowH, 'F')
        }
        // index
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        ink(MUTED)
        doc.text(String(idx).padStart(2, '0'), ML + 2, y)
        // link text
        ink(bg)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        labelLines.forEach((ln: string, li: number) => {
          if (li === 0) doc.textWithLink(ln, ML + 10, y, { url: s.url })
          else          doc.text(ln, ML + 10, y + li * 5)
        })
        y += rowH
        idx++
      })
      y += 5
    })
  }

  footer()
  doc.save('tumorboard-report.pdf')
}
