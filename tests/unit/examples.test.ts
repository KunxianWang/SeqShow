import { expect, test } from 'vitest';
import { examples } from '../../src/examples';
import { parseSequence } from '../../src/core/parser';
import { defaultChoices, deriveSteps } from '../../src/core/playback';

test.each([
  ['login', 6, 'POST /login'], ['request', 2, 'GET /health'], ['cache', 3, 'Look up profile'],
  ['job', 4, 'Submit job'], ['validation', 6, 'Request received'],
  ['chinese', 6, '提交订单：商品、数量与配送地址；请求地址 https://example.com:8080/orders?source=web&version=1'],
])('bundled %s example has a known playable path', (id, count, first) => {
  const result = parseSequence(examples.find(example => example.id === id)!.source);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const steps = deriveSteps(result.document, defaultChoices(result.document));
  expect(steps).toHaveLength(count as number);
  expect(steps[0].text).toBe(first);
});
