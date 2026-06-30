import { jsPDF } from 'jspdf'
import type { Report } from '../types'

const ML   = 14
const MR   = 196
const PW   = 210
const PH   = 297
const TW   = MR - ML
const FH   = 10

type RGB = readonly [number, number, number]
const BLUE:  RGB = [22,  74,  196]
const DARK:  RGB = [8,   18,  38]
const BODY:  RGB = [44,  56,  80]
const MUTED: RGB = [100, 116, 139]
const WHITE: RGB = [255, 255, 255]
const LTBL:  RGB = [237, 244, 255]
const BORD:  RGB = [210, 224, 248]
const ROWA:  RGB = [248, 250, 252]
const PUB:   RGB = [2,   130, 196]
const TRIAL: RGB = [4,   140, 98]
const CIVIC: RGB = [106, 38,  212]
const PDQ:   RGB = [172, 78,  8]

export function downloadReportPdf(report: Report, question?: string, fullContent?: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 0
  let pageNum = 1

  const fill   = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
  const ink    = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const setF   = (fam: 'times' | 'helvetica', style: 'normal' | 'bold' | 'italic', size: number) => {
    doc.setFont(fam, style); doc.setFontSize(size)
  }

  const drawFooter = () => {
    fill(BLUE); doc.rect(0, PH - FH, PW, FH, 'F')
    setF('helvetica', 'normal', 7.5); ink(WHITE)
    doc.text('TumorBoard  ·  Multi-Agent Oncology Research Assistant', ML, PH - 3.2)
    doc.text(`Page ${pageNum}`, MR, PH - 3.2, { align: 'right' })
  }

  const ensure = (need: number) => {
    if (y + need > PH - FH - 4) { drawFooter(); doc.addPage(); pageNum++; y = 16 }
  }

  // strip **bold** *italic* and leading list/heading markers for plain text output
  const clean = (s: string) =>
    s.replace(/\*\*([^*]+)\*\*/g, '$1')
     .replace(/\*([^*]+)\*/g, '$1')
     .replace(/^#+\s*/, '')
     .replace(/^[-*]\s+/, '')
     .replace(/^\d+\.\s+/, '')
     .trim()

  // ── HEADER BAND ───────────────────────────────────────────────
  fill(BLUE); doc.rect(0, 0, PW, 34, 'F')
  fill([40, 95, 215] as RGB); doc.rect(0, 26, PW, 0.6, 'F')
  setF('times', 'bold', 23); ink(WHITE)
  doc.text('TumorBoard', ML, 15)
  setF('helvetica', 'normal', 8.5); ink([185, 215, 255] as RGB)
  doc.text('Multi-Agent Oncology Research Report', ML, 23)
  setF('helvetica', 'normal', 7); ink([185, 215, 255] as RGB)
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.text(dateStr, MR, 10, { align: 'right' })
  y = 42

  // ── QUESTION BOX ─────────────────────────────────────────────
  if (question) {
    setF('times', 'italic', 10.5)
    const qLines: string[] = doc.splitTextToSize(question, TW - 10)
    const qH = qLines.length * 5.8 + 13
    fill(LTBL); stroke(BORD); doc.setLineWidth(0.3)
    doc.roundedRect(ML, y, TW, qH, 2.5, 2.5, 'FD')
    setF('helvetica', 'bold', 6.5); ink(BLUE)
    doc.text('RESEARCH QUESTION', ML + 5, y + 5.5)
    setF('times', 'italic', 10.5); ink(DARK)
    qLines.forEach((ln, i) => doc.text(ln, ML + 5, y + 11 + i * 5.8))
    y += qH + 6
  }

  // ── SECTION HEADER ────────────────────────────────────────────
  let secNum = 0
  const section = (title: string, accent: RGB = BLUE) => {
    secNum++; y += 5; ensure(18)
    fill(accent); doc.rect(ML, y - 5.5, 3, 11, 'F')
    setF('helvetica', 'bold', 7); ink(accent)
    doc.text(String(secNum).padStart(2, '0'), ML + 6, y - 1.5)
    setF('helvetica', 'bold', 13); ink(DARK)
    doc.text(title, ML + 6, y + 4.5)
    y += 8; stroke(accent); doc.setLineWidth(0.25)
    doc.line(ML, y, MR, y); y += 7
  }

  // ── RESEARCH FINDINGS — render full markdown ──────────────────
  if (fullContent && fullContent.trim()) {
    section('RESEARCH FINDINGS')

    const lines = fullContent.split('\n')
    let para: string[] = []

    const flushPara = () => {
      if (!para.length) return
      const text = clean(para.join(' '))
      if (!text) { para = []; return }
      setF('times', 'normal', 9.5); ink(BODY)
      const wrapped: string[] = doc.splitTextToSize(text, TW)
      wrapped.forEach((ln) => { ensure(5.5); doc.text(ln, ML, y); y += 5.2 })
      para = []; y += 2
    }

    for (const rawLine of lines) {
      const line = rawLine.trim()

      if (!line) { flushPara(); y += 1; continue }

      // ## heading — blue, underlined
      if (line.startsWith('## ')) {
        flushPara(); y += 3; ensure(14)
        const title = clean(line)
        setF('times', 'bold', 11.5); ink(BLUE)
        doc.text(title, ML, y)
        y += 1.5; stroke(BLUE); doc.setLineWidth(0.25)
        doc.line(ML, y, ML + doc.getTextWidth(title) + 2, y)
        y += 5.5; continue
      }

      // ### sub-heading — muted helvetica bold
      if (line.startsWith('### ')) {
        flushPara(); ensure(10); y += 2
        setF('helvetica', 'bold', 9.5); ink(MUTED)
        const sub: string[] = doc.splitTextToSize(clean(line), TW)
        sub.forEach((ln) => { doc.text(ln, ML, y); y += 5 })
        y += 2; continue
      }

      // #### sub-sub-heading
      if (line.startsWith('#### ')) {
        flushPara(); ensure(8); y += 1
        setF('helvetica', 'bold', 9); ink(BODY)
        const sub: string[] = doc.splitTextToSize(clean(line), TW)
        sub.forEach((ln) => { doc.text(ln, ML, y); y += 4.8 })
        y += 1; continue
      }

      // bullet — ensure per line so page breaks don't orphan the dot
      if (line.startsWith('- ') || line.startsWith('* ')) {
        flushPara()
        setF('times', 'normal', 9.5); ink(BODY)
        const bLines: string[] = doc.splitTextToSize(clean(line), TW - 9)
        bLines.forEach((bl, bi) => {
          ensure(5.5)
          if (bi === 0) { fill(BLUE); doc.circle(ML + 3, y - 1.5, 0.9, 'F') }
          doc.text(bl, ML + 7.5, y); y += 5.2
        })
        y += 1.5; continue
      }

      // numbered list — same pattern
      const numMatch = line.match(/^(\d+)\.\s+(.+)$/)
      if (numMatch) {
        flushPara()
        const [, num, content] = numMatch
        setF('times', 'normal', 9.5); ink(BODY)
        const nLines: string[] = doc.splitTextToSize(clean(content), TW - 10)
        nLines.forEach((nl, ni) => {
          ensure(5.5)
          if (ni === 0) {
            setF('helvetica', 'bold', 8.5); ink(BLUE)
            doc.text(num + '.', ML, y)
            setF('times', 'normal', 9.5); ink(BODY)
          }
          doc.text(nl, ML + 9, y); y += 5.2
        })
        y += 1.5; continue
      }

      // horizontal rule
      if (line === '---' || line === '***') {
        flushPara()
        stroke(BORD); doc.setLineWidth(0.3)
        doc.line(ML, y, MR, y); y += 4; continue
      }

      para.push(rawLine)
    }
    flushPara()
    y += 4
  }

  // ── SOURCES ──────────────────────────────────────────────────
  if (report.sources?.length) {
    section('SOURCES & REFERENCES')

    const TYPE: Record<string, { label: string; color: RGB }> = {
      pubmed:         { label: 'PubMed Literature',   color: PUB   },
      clinicaltrials: { label: 'Clinical Trials',     color: TRIAL },
      civic:          { label: 'CIViC Biomarker DB',  color: CIVIC },
      pdq:            { label: 'NCI PDQ Guidelines',  color: PDQ   },
    }

    const groups: Record<string, typeof report.sources> = {}
    report.sources.forEach((s) => { const k = s.source_type || 'other'; (groups[k] = groups[k] || []).push(s) })

    let idx = 1
    Object.entries(groups).forEach(([type, sources]) => {
      const { label, color } = TYPE[type] ?? { label: type, color: MUTED }
      ensure(14)
      fill(color); doc.rect(ML, y, TW, 7.5, 'F')
      setF('helvetica', 'bold', 8); ink(WHITE)
      doc.text(`${label.toUpperCase()}  ·  ${sources.length} SOURCE${sources.length !== 1 ? 'S' : ''}`, ML + 4, y + 5.2)
      y += 12

      sources.forEach((s) => {
        setF('helvetica', 'normal', 8.5)
        const display = s.label.length > 95 ? s.label.slice(0, 92) + '…' : s.label
        const lLines: string[] = doc.splitTextToSize(display, TW - 14)
        const rowH = lLines.length * 4.8 + 4
        ensure(rowH + 2)
        if (idx % 2 === 0) { fill(ROWA); doc.rect(ML, y - 3.5, TW, rowH, 'F') }
        setF('helvetica', 'bold', 8); ink(MUTED)
        doc.text(String(idx).padStart(2, '0'), ML + 2, y)
        setF('helvetica', 'normal', 8.5); ink(color)
        lLines.forEach((ln, li) => {
          if (li === 0) doc.textWithLink(ln, ML + 10, y, { url: s.url })
          else          doc.text(ln, ML + 10, y + li * 4.8)
        })
        y += rowH; idx++
      })
      y += 4
    })
  }

  drawFooter()
  doc.save('tumorboard-report.pdf')
}
