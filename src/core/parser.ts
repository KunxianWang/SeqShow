import type { Alternative, Participant, SequenceDocument, SourceLocation, Step } from './model';

export const INPUT_LIMITS = { source: 50_000, participants: 20, steps: 200, alternatives: 10 } as const;
export type Diagnostic = SourceLocation & { code: string; message: string; hint?: string };
export type ParseResult = { ok: true; document: SequenceDocument } | { ok: false; diagnostics: Diagnostic[] };

const identifier = '[A-Za-z_][A-Za-z0-9_-]*';
const declaration = new RegExp(`^(participant|actor)[ \\t]+(${identifier})(?:[ \\t]+as[ \\t]+(.+?))?[ \\t]*$`, 'u');
// Match the longest arrow before consuming a sender's trailing hyphen.
const message = new RegExp(`^(${identifier}?)[ \\t]*(-->>|->>)[ \\t]*(${identifier})[ \\t]*: ?(.*)$`, 'u');
const note = new RegExp(`^Note[ \\t]+(left[ \\t]+of|right[ \\t]+of|over)[ \\t]+(${identifier})(?:[ \\t]*,[ \\t]*(${identifier}))?[ \\t]*: ?(.*)$`, 'u');
const unsupportedKeywords = 'opt|loop|par|and|critical|break|option|activate|deactivate|create|destroy|autonumber|rect|click|links?|box|endbox|title';
const unsupported = new RegExp(`^(?:${unsupportedKeywords})\\b`, 'u');
const markup = /<\/?[A-Za-z][^>]*>|<!--|<!DOCTYPE|`[^`]*`/iu;
// A second message needs an arrow, receiver and delimiter. Do not scan across
// arbitrary text/semicolons to a later URL's colon (e.g. "loop-count; https://...").
const joinedMessage = `${identifier}[ \\t]*(?:<<|<)?-{1,2}(?:>>?|x|\\))?[ \\t]*[+-]?${identifier}[ \\t]*:`;
const secondStatement = new RegExp(`;[ \\t]*(?:(?:participant|actor|Note|alt|else|end|${unsupportedKeywords})(?:[ \\t]|$)|${joinedMessage})`, 'u');
const unsupportedMessage = new RegExp(`^${identifier}[ \\t]*[-<][^:]*:`, 'u');

/** A small, line-based subset parser. Raw source never reaches Mermaid. */
export function parseSequence(source: string): ParseResult {
  const fail = (code: string, message: string, location: SourceLocation, hint?: string): ParseResult =>
    ({ ok: false, diagnostics: [{ code, message, ...location, ...(hint ? { hint } : {}) }] });
  if (source.length > INPUT_LIMITS.source) {
    // Position is the first UTF-16 unit beyond the limit, even for CRLF input.
    const prefix = source.slice(0, INPUT_LIMITS.source).split(/\r\n|\n|\r/u);
    return fail('LIMIT_SOURCE', '源码超过 50,000 个 UTF-16 单元。', { line: prefix.length, column: prefix.at(-1)!.length + 1 });
  }
  const nodes: SequenceDocument['nodes'] = [];
  const explicit = new Map<string, Participant>();
  const declarations = new Map<string, SourceLocation>();
  const implicit = new Map<string, SourceLocation>();
  const noteReferences: { id: string; location: SourceLocation }[] = [];
  let header = false, stepCount = 0, alternativeCount = 0;
  let block: { node: Alternative; selected: 0 | 1; hasElse: boolean } | undefined;
  const lines = source.split(/\r\n|\n|\r/u);
  for (const [offset, raw] of lines.entries()) {
    const indent = raw.match(/^[ \t]*/u)![0].length;
    const line = raw.slice(indent);
    const location = { line: offset + 1, column: indent + 1 };
    if (!line.trim()) continue;
    if (line.startsWith('%%{') || line.trim() === '---') {
      return fail('UNSUPPORTED', '暂不支持 Mermaid 配置指令或 frontmatter。', location);
    }
    if (line.startsWith('%%')) continue;
    if (!header) {
      if (line.trimEnd() !== 'sequenceDiagram') return fail('DIAGRAM_TYPE', '首个语句必须是 sequenceDiagram。', location);
      header = true;
      continue;
    }
    const tag = markup.exec(line);
    if (tag) return fail('UNSUPPORTED', '标签只支持纯文本，暂不支持 HTML、换行标记或富文本。',
      { ...location, column: location.column + tag.index });
    const joined = secondStatement.exec(line);
    if (joined || (!line.includes(':') && line.includes(';'))) {
      return fail('UNSUPPORTED', '请把每条语句放在独立的一行，不支持分号拼接。',
        { ...location, column: location.column + (joined?.index ?? line.indexOf(';')) });
    }
    // Keywords are valid participant IDs too; a complete message wins over a block opener.
    const matchedMessage = message.exec(line);
    if (!matchedMessage && /^alt(?:[ \t]|$)/u.test(line)) {
      if (block) return fail('UNSUPPORTED', '暂不支持嵌套 alt。', location, '将分支改为多个顶层 alt/else。');
      const label = line.slice(3).trim();
      if (!label) return fail('BRANCH_STRUCTURE', 'alt 需要 case 标签。', location);
      if (++alternativeCount > INPUT_LIMITS.alternatives) return fail('LIMIT_ALTERNATIVES', '顶层 alt 超过 10 个。', location);
      // Colons make generated IDs disjoint from valid participant IDs.
      const id = `alt:${alternativeCount}`;
      const node: Alternative = { kind: 'alternative', id, source: location, cases: [
        { id: `${id}:first`, label, steps: [] }, { id: `${id}:second`, label: '', steps: [] },
      ] };
      nodes.push(node); block = { node, selected: 0, hasElse: false };
      continue;
    }
    if (!matchedMessage && /^else(?:[ \t]|$)/u.test(line)) {
      if (!block || block.hasElse) return fail('BRANCH_STRUCTURE', 'else 必须在 alt 中且只能出现一次。', location);
      const label = line.slice(4).trim();
      if (!label) return fail('BRANCH_STRUCTURE', 'else 需要 case 标签。', location);
      block.node.cases[1].label = label; block.hasElse = true; block.selected = 1;
      continue;
    }
    if (line.trimEnd() === 'end') {
      if (!block || !block.hasElse) return fail('BRANCH_STRUCTURE', '每个 alt 必须有一条 else，并由 end 结束。', location);
      block = undefined;
      continue;
    }
    const declared = declaration.exec(line);
    if (declared) {
      if (block) return fail('UNSUPPORTED', '分支内部只支持消息和 Note，不支持参与者声明。', location);
      const [, kind, id, label] = declared;
      if (label !== undefined && !label.trim()) return fail('SYNTAX', 'as 后需要非空参与者标签。', location);
      if (explicit.has(id)) return fail('DUPLICATE_PARTICIPANT', `参与者 ${id} 重复声明。`, location);
      explicit.set(id, { id, label: label ?? id, kind: kind as Participant['kind'] });
      declarations.set(id, location);
      continue;
    }
    const matchedNote = note.exec(line);
    let step: Step;
    if (matchedMessage) {
      const [, from, arrow, to, text] = matchedMessage;
      for (const id of [from, to]) if (!implicit.has(id)) implicit.set(id, location);
      step = { kind: 'message', id: `step:${stepCount + 1}`, from, to, arrow: arrow === '->>' ? 'solid' : 'dashed', text, source: location };
    } else if (matchedNote) {
      const [, placement, first, second, text] = matchedNote;
      if (second && placement !== 'over') return fail('SYNTAX', 'left/right Note 只接受一个参与者。', location);
      const participants = second ? [first, second] : [first];
      let searchFrom = line.indexOf(placement) + placement.length;
      for (const id of participants) {
        const index = line.indexOf(id, searchFrom);
        noteReferences.push({ id, location: { ...location, column: location.column + index } });
        searchFrom = index + id.length;
      }
      step = { kind: 'note', id: `step:${stepCount + 1}`, placement: placement === 'over' ? 'over' : placement.startsWith('left') ? 'left' : 'right', participants, text, source: location };
    } else {
      if (unsupported.test(line) || unsupportedMessage.test(line)) {
        return fail('UNSUPPORTED', '当前不支持此 Mermaid 语句、箭头或激活简写。', location,
          '使用 ->> / -->>、Note 和单层 alt/else；每行一条语句。');
      }
      return fail('SYNTAX', '无法识别此语句，请检查参与者 ID、箭头和冒号。', location);
    }
    if (++stepCount > INPUT_LIMITS.steps) return fail('LIMIT_STEPS', '全图消息和 Note 合计超过 200 步（包括未选中的 case）。', location);
    if (block) block.node.cases[block.selected].steps.push(step); else nodes.push(step);
  }
  if (!header) return fail('EMPTY_INPUT', '请输入 sequenceDiagram 时序图。', { line: 1, column: 1 });
  if (block) return fail('BRANCH_STRUCTURE', 'alt 未闭合，需要 else 和 end。', block.node.source);
  const participants = [...explicit.values()];
  if (participants.length > INPUT_LIMITS.participants) return fail('LIMIT_PARTICIPANTS', '参与者超过 20 个。', declarations.get(participants[INPUT_LIMITS.participants].id)!);
  for (const [id, location] of implicit) {
    if (!explicit.has(id)) participants.push({ id, label: id, kind: 'participant' });
    if (participants.length > INPUT_LIMITS.participants) return fail('LIMIT_PARTICIPANTS', '参与者超过 20 个。', location);
  }
  const registered = new Set(participants.map(participant => participant.id));
  for (const reference of noteReferences) {
    if (!registered.has(reference.id)) return fail('UNKNOWN_PARTICIPANT', `Note 引用的参与者 ${reference.id} 不存在。`, reference.location,
      '在文档中声明该参与者，或用消息建立隐式参与者。');
  }
  if (!stepCount) return fail('NO_STEPS', '此图没有可播放的消息或 Note。', { line: 1, column: 1 });
  return { ok: true, document: { participants, nodes } };
}
