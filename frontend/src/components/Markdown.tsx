import ReactMarkdown, { type Components } from 'react-markdown'

const components: Components = {
  p: (props) => <p className="mb-3 leading-relaxed text-slate-900 last:mb-0" {...props} />,
  strong: (props) => <strong className="font-bold text-slate-900" {...props} />,
  ul: (props) => <ul className="mb-3 list-disc space-y-1.5 pl-5" {...props} />,
  ol: (props) => <ol className="mb-3 list-decimal space-y-1.5 pl-5" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  h1: (props) => (
    <h2
      className="mb-2 mt-5 border-b border-slate-200 pb-1 font-serif-display text-lg font-semibold text-slate-900 first:mt-0"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="mb-2 mt-5 border-b border-slate-200 pb-1 font-serif-display text-lg font-semibold text-slate-900 first:mt-0"
      {...props}
    />
  ),
  h3: (props) => (
    <h3 className="mb-1.5 mt-4 text-sm font-semibold uppercase tracking-wide text-slate-500 first:mt-0" {...props} />
  ),
  a: (props) => (
    <a className="text-blue-600 underline decoration-blue-300 hover:text-blue-700" target="_blank" rel="noreferrer" {...props} />
  ),
  code: (props) => <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700" {...props} />,
  blockquote: (props) => (
    <blockquote className="my-2 border-l-4 border-blue-200 pl-3 text-slate-600 italic" {...props} />
  ),
}

export default function Markdown({ children }: { children: string }) {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>
}
