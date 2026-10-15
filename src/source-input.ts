export type SourceBlock = { source: string; line: number };
export const MAX_DOCUMENT_UNITS = 500_000;
export const MAX_FILE_BYTES = 200_000;

/** Extract fenced sequence diagrams as text; never interpret Markdown HTML. */
export function sequenceBlocks(markdown: string): SourceBlock[] {
  if (markdown.length > MAX_DOCUMENT_UNITS) throw new Error('Markdown exceeds 500,000 UTF-16 units. Open a Mermaid source file instead.');
  const lines = markdown.replace(/\r\n?|\n/gu, '\n').split('\n');
  const blocks: SourceBlock[] = [];
  for (let index = 0; index < lines.length; index++) {
    const opening = /^ {0,3}(`{3,}|~{3,})([^`~]*)$/u.exec(lines[index]);
    if (!opening) continue;
    const start = index + 1, marker = opening[1];
    const closing = new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`, 'u');
    while (++index < lines.length && !closing.test(lines[index])) { /* Find the matching closing fence. */ }
    if (index === lines.length) throw new Error('A Markdown code fence is not closed.');
    const source = lines.slice(start, index).join('\n');
    if (opening[2].trim().toLowerCase() === 'mermaid' && /^\s*sequenceDiagram\s*$/mu.test(source)) blocks.push({ source, line: start + 1 });
  }
  return blocks;
}
