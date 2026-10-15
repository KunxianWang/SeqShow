import type { Alternative, Group, Participant, ParticipantBox, SequenceDocument, SequenceNode, SourceLocation, Step } from './model';

export const INPUT_LIMITS = { source: 50_000, participants: 20, steps: 200, alternatives: 10, groups: 20, depth: 8, statements: 1000 } as const;
export type Diagnostic = SourceLocation & { code: string; message: string; hint?: string };
export type ParseResult = { ok: true; document: SequenceDocument } | { ok: false; diagnostics: Diagnostic[] };

const declaration = /^(participant|actor)[ \t]+(.+?)(?:[ \t]+as[ \t]+(.*?))?[ \t]*$/u;
const message = /^(.+?)[ \t]*(-->>|->>|-->|->)[ \t]*([+-]?)(.+?): ?(.*)$/u;
const note = /^Note[ \t]+(left[ \t]+of|right[ \t]+of|over)[ \t]+([^:]+): ?(.*)$/iu;
const unsupportedKeywords = 'opt|par|and|critical|break|option|create|destroy|rectify|click|links?|endbox';
const unsupported = new RegExp(`^(?:${unsupportedKeywords})\\b`, 'u');
const statementKeyword = new RegExp(`^(?:participant|actor|title|loop|alt|else|rect|box|autonumber|${unsupportedKeywords})(?=[ \\t]|$)`, 'u');
const markup = /<\/?[A-Za-z][^>]*>|<!--|<!DOCTYPE|`[^`]*`/iu;
const br = /<br\s*\/?>/giu;
const idValid = (id: string) => /^[^\s\d:;,<>+{}()[\]]/u.test(id) && !/[:;,<>+{}()[\]\r\n\t]/u.test(id);
const joinedMessage = '[^;:]+?(?:<<|<)?-{1,2}(?:>>?|x|\\))?[ \\t]*[+-]?[^;:]+:';
const secondStatement = new RegExp(`;[ \\t]*(?:(?:participant|actor|Note|alt|else|end|loop|activate|deactivate|autonumber|rect|box|title|${unsupportedKeywords})(?:[ \\t]|$)|${joinedMessage})`, 'iu');
const namedColors = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato transparent turquoise violet wheat white whitesmoke yellow yellowgreen').split(' '));
const color = (value: string) => namedColors.has(value.toLowerCase()) || /^(?:rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\))$/iu.test(value);
const boxColor = /^(rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\)|[a-z]+)(?:[ \t]+|$)/iu;
const arrows = { '->>': 'solid', '-->>': 'dashed', '->': 'solid-line', '-->': 'dashed-line' } as const;

/** Explicit sequence subset. User source/configuration never reaches Mermaid. */
export function parseSequence(source: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const problem = (code: string, message: string, location: SourceLocation, hint?: string) => {
    diagnostics.push({ code, message, ...location, ...(hint ? { hint } : {}) });
  };
  const fail = (code: string, message: string, location: SourceLocation, hint?: string): ParseResult => {
    if (code === 'BRANCH_STRUCTURE' && diagnostics.length) return { ok: false, diagnostics };
    problem(code, message, location, hint); return { ok: false, diagnostics };
  };
  if (source.length > INPUT_LIMITS.source) {
    const prefix = source.slice(0, INPUT_LIMITS.source).split(/\r\n|\n|\r/u);
    return fail('LIMIT_SOURCE', 'Source exceeds 50,000 UTF-16 units.', { line: prefix.length, column: prefix.at(-1)!.length + 1 });
  }
  const nodes: SequenceNode[] = [], boxes: ParticipantBox[] = [];
  const explicit = new Map<string, Participant>(), declarations = new Map<string, SourceLocation>();
  const implicit = new Map<string, SourceLocation>();
  const references: { id: string; location: SourceLocation }[] = [];
  const stack: { kind: 'alternative' | 'loop' | 'rect'; nodes: SequenceNode[]; source: SourceLocation; alternative?: Alternative; hasElse?: boolean }[] = [];
  const activity = new Map<string, number>();
  let currentBox: ParticipantBox | undefined;
  let header = false, yaml = false, yamlSeen = false, title: string | undefined;
  let stepCount = 0, alternativeCount = 0, groupCount = 0, statements = 0;
  const append = (node: SequenceNode) => (stack.at(-1)?.nodes ?? nodes).push(node);
  const register = (id: string, location: SourceLocation) => { if (!implicit.has(id)) implicit.set(id, location); };
  const text = (label: string) => label.replace(br, '\n');
  const activate = (id: string, active: boolean, location: SourceLocation) => {
    register(id, location);
    const depth = (activity.get(id) ?? 0) + (active ? 1 : -1);
    if (depth < 0) {
      problem('SYNTAX', `Cannot deactivate inactive participant ${id}.`, location); return;
    }
    activity.set(id, depth);
    append({ kind: 'activation', participant: id, active, source: location });
  };
  const lines = source.split(/\r\n|\n|\r/u);
  for (const [offset, raw] of lines.entries()) {
    const indent = raw.match(/^[ \t]*/u)![0].length;
    const line = raw.slice(indent), trimmed = line.trimEnd();
    const location = { line: offset + 1, column: indent + 1 };
    if (!line.trim()) continue;
    if (line.startsWith('%%{')) { problem('UNSUPPORTED', 'Mermaid configuration directives are not supported.', location); continue; }
    if (line.startsWith('%%')) continue;
    if (!header && trimmed === '---') {
      if (!yaml && yamlSeen) return fail('SYNTAX', 'Only one frontmatter block is allowed.', location);
      yaml = !yaml; yamlSeen = true; continue;
    }
    if (yaml) {
      const entry = /^title:[ \t]*(.*?)\s*$/u.exec(line);
      if (!entry || title !== undefined || /^[!&*|>{[]/u.test(entry[1])) {
        problem('UNSUPPORTED', 'Frontmatter accepts only one plain title field; configuration is not applied.', location);
      } else {
        const value = entry[1];
        try {
          title = value.startsWith('"') ? JSON.parse(value) as string
            : value.startsWith("'") ? /^'(?:[^']|'')*'$/u.test(value) ? value.slice(1, -1).replace(/''/gu, "'") : undefined
              : value;
        } catch { title = undefined; }
        if (title === undefined || /[\r\n]/u.test(title) || markup.test(title)) {
          problem('UNSUPPORTED', 'Use a single-line plain title, optionally in JSON double quotes or YAML single quotes.', location);
        }
      }
      continue;
    }
    if (!header) {
      if (trimmed !== 'sequenceDiagram') return fail('DIAGRAM_TYPE', 'The first statement must be sequenceDiagram.', location);
      header = true; continue;
    }
    if (++statements > INPUT_LIMITS.statements) return fail('LIMIT_STATEMENTS', 'The diagram exceeds 1,000 statements.', location);
    // Keep offsets unchanged while masking the only permitted markup.
    const masked = line.replace(br, match => ' '.repeat(match.length));
    const tag = markup.exec(masked);
    if (tag) {
      problem('UNSUPPORTED', 'Only plain text and br line breaks are supported; other HTML and rich text are not allowed.',
        { ...location, column: location.column + tag.index }); continue;
    }
    const joined = secondStatement.exec(line);
    if (joined || (!line.includes(':') && line.includes(';'))) {
      problem('UNSUPPORTED', 'Use one statement per line; joined statements are not supported.',
        { ...location, column: location.column + (joined?.index ?? line.indexOf(';')) }); continue;
    }
    const keyword = statementKeyword.exec(line) ?? /^(?:Note|activate|deactivate)(?=[ \t]|$)/iu.exec(line);
    // Statement bodies may contain arrows and colons. Only an arrow immediately
    // after the keyword denotes a bare keyword participant (e.g. alt ->> else).
    const keywordMessage = keyword && /^(?:-->>|->>|-->|->)/u.test(line.slice(keyword[0].length).trimStart());
    const matchedMessage = !keyword || keywordMessage ? message.exec(line) : null;
    const declared = declaration.exec(line);
    if (currentBox && !declared && trimmed !== 'end') return fail('BRANCH_STRUCTURE', 'A box contains participant declarations only.', location);
    if (!matchedMessage && /^(?:alt|loop|rect)(?:[ \t]|$)/u.test(line)) {
      const kind = line.split(/[ \t]/u)[0] as 'alt' | 'loop' | 'rect';
      const label = line.slice(kind.length).trim();
      if (!label) return fail('BRANCH_STRUCTURE', `${kind} needs a nonempty label or color.`, location);
      if (stack.length >= INPUT_LIMITS.depth) return fail('LIMIT_DEPTH', 'Block nesting exceeds 8 levels.', location);
      if (kind === 'alt') {
        if (stack.some(block => block.kind === 'alternative')) return fail('UNSUPPORTED', 'Alternatives cannot be nested inside another alternative.', location);
        if (++alternativeCount > INPUT_LIMITS.alternatives) return fail('LIMIT_ALTERNATIVES', 'The diagram exceeds 10 alt blocks.', location);
        const id = `alt:${alternativeCount}`;
        const node: Alternative = { kind: 'alternative', id, source: location, cases: [
          { id: `${id}:first`, label: text(label), steps: [] }, { id: `${id}:second`, label: '', steps: [] },
        ] };
        append(node); stack.push({ kind: 'alternative', nodes: node.cases[0].steps, alternative: node, hasElse: false, source: location });
      } else {
        if (kind === 'rect' && !color(label)) return fail('UNSUPPORTED', 'Use a plain color name or numeric rgb/rgba/hsl/hsla for rect.', location);
        if (++groupCount > INPUT_LIMITS.groups) return fail('LIMIT_GROUPS', 'The diagram exceeds 20 loop/rect blocks.', location);
        const node: Group = { kind, id: `group:${groupCount}`, label: text(label), nodes: [], source: location };
        append(node); stack.push({ kind, nodes: node.nodes, source: location });
      }
      continue;
    }
    if (!matchedMessage && /^else(?:[ \t]|$)/u.test(line)) {
      const block = stack.at(-1);
      if (block?.kind !== 'alternative' || block.hasElse) return fail('BRANCH_STRUCTURE', 'Each alt accepts exactly one else.', location);
      const label = line.slice(4).trim();
      if (!label) return fail('BRANCH_STRUCTURE', 'else needs a nonempty case label.', location);
      block.alternative!.cases[1].label = text(label); block.hasElse = true; block.nodes = block.alternative!.cases[1].steps;
      continue;
    }
    if (trimmed === 'end') {
      if (!stack.length && !currentBox && diagnostics.length) continue;
      if (currentBox) { if (!currentBox.participants.length) return fail('BRANCH_STRUCTURE', 'A box must contain participants.', location); currentBox = undefined; continue; }
      const block = stack.pop();
      if (!block || (block.kind === 'alternative' && !block.hasElse)) return fail('BRANCH_STRUCTURE', 'Close each block with end; each alt needs one else.', location);
      continue;
    }
    if (/^box(?:[ \t]|$)/u.test(line) && !matchedMessage) {
      if (stack.length || currentBox || boxes.length >= 20) return fail('BRANCH_STRUCTURE', 'Boxes must be separate top-level participant groups (maximum 20).', location);
      const value = line.slice(3).trim(), candidate = boxColor.exec(value);
      const colored = candidate && color(candidate[1]) ? candidate : null;
      currentBox = { color: colored?.[1] ?? 'transparent', label: text(colored ? value.slice(colored[0].length) : value), participants: [] };
      boxes.push(currentBox); continue;
    }
    if (/^title[ \t]/u.test(line) && !matchedMessage) {
      if (title !== undefined) return fail('SYNTAX', 'Declare the title only once.', location);
      if (/<br\s*\/?>/iu.test(line)) return fail('UNSUPPORTED', 'Use one plain-text line for the diagram title.', location);
      title = text(line.slice(5).trim()); continue;
    }
    const numbering = /^autonumber(?:[ \t]+(?:(off)|(\d+)(?:[ \t]+(\d+))?))?[ \t]*$/u.exec(line);
    if (numbering && !matchedMessage) {
      const start = Number(numbering[2] ?? 1), increment = Number(numbering[3] ?? 1);
      if (start < 1 || increment < 1 || start > 1_000_000 || increment > 1_000_000) return fail('SYNTAX', 'autonumber start/increment must be between 1 and 1,000,000.', location);
      append({ kind: 'numbering', start, increment, visible: !numbering[1], source: location }); continue;
    }
    if (declared) {
      if (stack.length) return fail('UNSUPPORTED', 'Declare participants outside control blocks.', location);
      const [, kind, rawId, label] = declared, id = rawId.trim();
      if (!idValid(id) || label !== undefined && !label.trim() || label === undefined && /[ \t]+as[ \t]*$/u.test(rawId)) return fail('SYNTAX', 'Use a nonempty participant ID and a nonempty label after as.', location);
      if (explicit.has(id)) return fail('DUPLICATE_PARTICIPANT', `Participant ${id} is declared more than once.`, location);
      explicit.set(id, { id, label: text(label ?? id), kind: kind as Participant['kind'] }); declarations.set(id, location);
      currentBox?.participants.push(id); continue;
    }
    const activation = /^(activate|deactivate)[ \t]+(.+?)[ \t]*$/iu.exec(line);
    if (activation && !matchedMessage) {
      if (!idValid(activation[2])) return fail('SYNTAX', 'Invalid activation participant ID.', location);
      activate(activation[2], activation[1].toLowerCase() === 'activate', location); continue;
    }
    const matchedNote = note.exec(line);
    let step: Step;
    let shorthand = '', activationId = '';
    if (matchedMessage) {
      const [, rawFrom, arrow, flag, rawTo, value] = matchedMessage;
      const from = rawFrom.trim(), to = rawTo.trim();
      if (!idValid(from) || !idValid(to)) { problem('UNSUPPORTED', 'Unsupported participant ID or arrow. Use ->>, -->>, -> or -->.', location); continue; }
      register(from, location); register(to, location);
      shorthand = flag; activationId = flag === '+' ? to : from;
      step = { kind: 'message', id: `step:${stepCount + 1}`, from, to, arrow: arrows[arrow as keyof typeof arrows], text: text(value), source: location };
    } else if (matchedNote) {
      const [, rawPlacement, ids, value] = matchedNote;
      const participants = ids.split(',').map(id => id.trim()), placement = rawPlacement.toLowerCase().replace(/[ \t]+/gu, ' ');
      if (participants.length > (placement === 'over' ? 2 : 1) || participants.some(id => !idValid(id))) return fail('SYNTAX', 'Notes reference one participant, or up to two with over.', location);
      let searchFrom = line.toLowerCase().indexOf(rawPlacement.toLowerCase()) + rawPlacement.length;
      for (const id of participants) {
        const index = line.indexOf(id, searchFrom); references.push({ id, location: { ...location, column: location.column + index } }); searchFrom = index + id.length;
      }
      step = { kind: 'note', id: `step:${stepCount + 1}`, placement: placement === 'over' ? 'over' : placement.startsWith('left') ? 'left' : 'right', participants, text: text(value), source: location };
    } else {
      const isUnsupported = unsupported.test(line) || /^.+?[-<][^:]*:/u.test(line) || /^(autonumber|title)\b/u.test(line);
      problem(isUnsupported ? 'UNSUPPORTED' : 'SYNTAX', isUnsupported ? 'This Mermaid statement or arrow is not supported.' : 'Unrecognized statement; check the participant, arrow and colon.', location);
      continue;
    }
    if (++stepCount > INPUT_LIMITS.steps) return fail('LIMIT_STEPS', 'Messages and Notes exceed 200 across all paths.', location);
    append(step);
    if (shorthand) activate(activationId, shorthand === '+', location);
  }
  if (yaml) return fail('SYNTAX', 'Frontmatter must end with ---.', { line: 1, column: 1 });
  if (!header) return fail('EMPTY_INPUT', 'Paste a sequenceDiagram to continue.', { line: 1, column: 1 });
  if (stack.length || currentBox) return fail('BRANCH_STRUCTURE', 'Unclosed block: add the required else/end.', stack[0]?.source ?? { line: lines.length, column: 1 });
  const participants = [...explicit.values()];
  if (participants.length > INPUT_LIMITS.participants) return fail('LIMIT_PARTICIPANTS', 'The diagram exceeds 20 participants.', declarations.get(participants[INPUT_LIMITS.participants].id)!);
  for (const [id, location] of implicit) {
    if (!explicit.has(id)) participants.push({ id, label: id, kind: 'participant' });
    if (participants.length > INPUT_LIMITS.participants) return fail('LIMIT_PARTICIPANTS', 'The diagram exceeds 20 participants.', location);
  }
  const registered = new Set(participants.map(participant => participant.id));
  for (const reference of references) {
    if (!registered.has(reference.id)) problem('UNKNOWN_PARTICIPANT', `Note participant ${reference.id} does not exist.`, reference.location, 'Declare it or introduce it in a message.');
  }
  if (diagnostics.length) return { ok: false, diagnostics };
  if (!stepCount) return fail('NO_STEPS', 'This diagram has no playable messages or Notes.', { line: 1, column: 1 });
  return { ok: true, document: { participants, nodes, ...(title !== undefined ? { title } : {}), ...(boxes.length ? { boxes } : {}) } };
}
