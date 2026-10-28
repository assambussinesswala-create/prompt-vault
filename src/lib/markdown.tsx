import { Fragment, type ReactNode } from 'react'

/**
 * A small, safe Markdown renderer (no HTML injection, no dependencies).
 * Supports headings, paragraphs (single line breaks are kept), bold, italic, inline code,
 * links (http/https/mailto only), bullet and numbered lists, blockquotes, fenced code and rules.
 * Tables and nested lists are shown as plain text/flat lists.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\*[^*\n]+\*|_[^_\n]+_)|(\[[^\]\n]+\]\([^)\s]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    const key = `${keyBase}-${i++}`
    if (m[1]) out.push(<code key={key}>{tok.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={key}>{inline(tok.slice(2, -2), key)}</strong>)
    else if (m[3]) out.push(<em key={key}>{inline(tok.slice(1, -1), key)}</em>)
    else if (m[4]) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)
      if (lm && /^(https?:|mailto:)/i.test(lm[2])) {
        out.push(
          <a key={key} href={lm[2]} target="_blank" rel="noopener noreferrer">
            {lm[1]}
          </a>,
        )
      } else out.push(tok)
    }
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function withBreaks(lines: string[], key: string): ReactNode[] {
  const out: ReactNode[] = []
  lines.forEach((l, i) => {
    if (i) out.push(<br key={`${key}-br${i}`} />)
    out.push(<Fragment key={`${key}-l${i}`}>{inline(l, `${key}-${i}`)}</Fragment>)
  })
  return out
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let k = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const fence = /^\s*(```|~~~)\s*(\S*)/.exec(line)
    if (fence) {
      const buf: string[] = []
      i++
      while (i < lines.length && !/^\s*(```|~~~)\s*$/.test(lines[i])) buf.push(lines[i++])
      i++
      blocks.push(
        <pre key={k++}>
          <code>{buf.join('\n')}</code>
        </pre>,
      )
      continue
    }
    const h = /^ {0,3}(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      const Tag = `h${h[1].length}` as 'h1'
      blocks.push(<Tag key={k++}>{inline(h[2], `h${k}`)}</Tag>)
      i++
      continue
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push(<hr key={k++} />)
      i++
      continue
    }
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''))
      blocks.push(<blockquote key={k++}>{withBreaks(buf, `q${k}`)}</blockquote>)
      continue
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*+]\s+/, ''))
      blocks.push(
        <ul key={k++}>
          {items.map((t, j) => (
            <li key={j}>{inline(t, `u${k}-${j}`)}</li>
          ))}
        </ul>,
      )
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      const start = parseInt(/^\s*(\d+)/.exec(line)![1], 10)
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''))
      blocks.push(
        <ol key={k++} start={start}>
          {items.map((t, j) => (
            <li key={j}>{inline(t, `o${k}-${j}`)}</li>
          ))}
        </ol>,
      )
      continue
    }
    const buf: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^( {0,3}#{1,6}\s|\s*(```|~~~)|\s*>\s?|\s*[-*+]\s+|\s*\d+[.)]\s+)/.test(lines[i]) &&
      !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])
    ) {
      buf.push(lines[i++])
    }
    blocks.push(<p key={k++}>{withBreaks(buf, `p${k}`)}</p>)
  }
  return <div className="md">{blocks}</div>
}
