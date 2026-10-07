import type { Alternative, Message, Note, Participant, SequenceDocument } from '../../src/core/model';
import { loginExample } from '../../src/examples';

const source = { line: 1, column: 1 }; // Hand-authored M0 helpers; the login fixture now uses Parser output.
const participant = (id: string, label = id, kind: Participant['kind'] = 'participant'): Participant => ({ id, label, kind });
const message = (id: string, from: string, to: string, text: string, arrow: Message['arrow'] = 'solid'): Message =>
  ({ kind: 'message', id, from, to, text, arrow, source });
const note = (id: string, placement: Note['placement'], participants: string[], text: string): Note =>
  ({ kind: 'note', id, placement, participants, text, source });
const alternative = (id: string, first: Alternative['cases'][0], second: Alternative['cases'][1]): Alternative =>
  ({ kind: 'alternative', id, cases: [first, second], source });

export type Fixture = {
  id: string; title: string; model: SequenceDocument;
  paths: { choices: Record<string, string>; ids: string[] }[];
};

export const fixtures: Fixture[] = [
  {
    id: 'linear', title: 'Request / response',
    model: { participants: [participant('C', 'Client'), participant('S', 'Server')], nodes: [
      message('request', 'C', 'S', 'GET /health'), message('response', 'S', 'C', '200 OK', 'dashed'),
    ] }, paths: [{ choices: {}, ids: ['request', 'response'] }],
  },
  {
    id: 'login', title: 'Login — actor, self-call, alt and Note',
    model: loginExample, paths: [
      { choices: { 'alt:1': 'alt:1:first' }, ids: ['step:1', 'step:2', 'step:3', 'step:4', 'step:5', 'step:6'] },
      { choices: { 'alt:1': 'alt:1:second' }, ids: ['step:1', 'step:2', 'step:3', 'step:4', 'step:7', 'step:8'] },
    ],
  },
  {
    id: 'repeated', title: 'Identical labels stay independent',
    model: { participants: [participant('A'), participant('B')], nodes: [
      message('repeat1', 'A', 'B', 'same'), message('repeat2', 'A', 'B', 'same'),
      message('repeat3', 'B', 'A', 'same', 'dashed'), message('self1', 'B', 'B', 'same'),
      message('self2', 'B', 'B', 'same', 'dashed'),
    ] }, paths: [{ choices: {}, ids: ['repeat1', 'repeat2', 'repeat3', 'self1', 'self2'] }],
  },
  {
    id: 'notes', title: 'All Note placements',
    model: { participants: [participant('A'), participant('B')], nodes: [
      note('left', 'left', ['A'], 'Left note'), note('right', 'right', ['B'], 'Right note'),
      note('one', 'over', ['A'], 'One participant'), note('two', 'over', ['A', 'B'], 'Two participants'),
      message('after', 'A', 'B', 'Continue'),
    ] }, paths: [{ choices: {}, ids: ['left', 'right', 'one', 'two', 'after'] }],
  },
  {
    id: 'unicode', title: '中文、长文本与特殊字符',
    model: { participants: [participant('User', '用户浏览器', 'actor'), participant('API', '身份认证服务'), participant('Store', '数据库')], nodes: [
      message('cn1', 'User', 'API', '提交登录请求：验证用户名、密码以及本次请求携带的设备信息，确保每个步骤都能清楚地展示给观众'),
      message('cn2', 'API', 'Store', 'Query: user_id = 42; status < 500 & retries > 0 [safe] #tag $$literal$$'),
      note('cnNote', 'over', ['API', 'Store'], '这是一条比较长的中文说明，用于验证纯 SVG 的文本换行、Note 背景和导出后的显示效果。'),
      message('cn3', 'Store', 'API', '结果：成功 ✅', 'dashed'),
    ] }, paths: [{ choices: {}, ids: ['cn1', 'cn2', 'cnNote', 'cn3'] }],
  },
  {
    id: 'branches', title: 'Two alternatives with unequal paths',
    model: { participants: [participant('A'), participant('B')], nodes: [
      message('begin', 'A', 'B', 'Begin'),
      alternative('cache', { id: 'hit', label: 'cache hit', steps: [message('hit', 'B', 'A', 'Result', 'dashed')] },
        { id: 'miss', label: 'cache miss', steps: [message('load', 'B', 'B', 'Load'), note('loaded', 'over', ['B'], 'Loaded'), message('miss', 'B', 'A', 'Result', 'dashed')] }),
      message('common', 'A', 'B', 'Continue'),
      alternative('save', { id: 'ok', label: 'saved', steps: [note('saved', 'right', ['B'], 'Saved')] },
        { id: 'fail', label: 'save failed', steps: [message('retry', 'A', 'B', 'Retry'), message('error', 'B', 'A', 'Error', 'dashed')] }),
    ] }, paths: [
      { choices: { cache: 'hit', save: 'ok' }, ids: ['begin', 'hit', 'common', 'saved'] },
      { choices: { cache: 'hit', save: 'fail' }, ids: ['begin', 'hit', 'common', 'retry', 'error'] },
      { choices: { cache: 'miss', save: 'ok' }, ids: ['begin', 'load', 'loaded', 'miss', 'common', 'saved'] },
      { choices: { cache: 'miss', save: 'fail' }, ids: ['begin', 'load', 'loaded', 'miss', 'common', 'retry', 'error'] },
    ],
  },
  {
    id: 'single', title: 'One-step playback boundary',
    model: { participants: [participant('A')], nodes: [message('only', 'A', 'A', 'One step')] },
    paths: [{ choices: {}, ids: ['only'] }],
  },
  {
    id: 'text-data', title: 'Labels are data',
    model: { participants: [participant('A', 'Text < & > — a longer participant alias that should wrap safely'), participant('B')], nodes: [
      message('literal', 'A', 'B', 'Literal </script> <img src=x onerror=alert(1)> & "quoted"'),
      note('entity', 'over', ['A', 'B'], '#60; stays literal; $$x$$ stays text'),
      message('prefix', 'A', 'B', 'wrap: literal %%{not a directive}%%'),
    ] }, paths: [{ choices: {}, ids: ['literal', 'entity', 'prefix'] }],
  },
];
