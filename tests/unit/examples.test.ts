import { expect, test } from 'vitest';
import { checkoutSource, examples } from '../../src/examples';
import { parseSequence } from '../../src/core/parser';
import { defaultChoices, deriveSteps } from '../../src/core/playback';

test.each([
  ['login', 6, 'POST /login'], ['request', 2, 'GET /health'], ['cache', 3, 'Look up profile'],
  ['job', 4, 'Submit job'], ['validation', 6, 'Request received'],
  ['checkout', 20, '01 / Accept the order'],
  ['chinese', 6, '提交订单：商品、数量与配送地址；请求地址 https://example.com:8080/orders?source=web&version=1'],
])('bundled %s example has a known playable path', (id, count, first) => {
  const result = parseSequence(examples.find(example => example.id === id)!.source);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const steps = deriveSteps(result.document, defaultChoices(result.document));
  expect(steps).toHaveLength(count as number);
  expect(steps[0].text).toBe(first);
});

test('checkout recovery joins only after authorization, with independent fulfillment paths', () => {
  const result = parseSequence(checkoutSource);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  expect(result.document.participants).toHaveLength(6);
  for (const payment of ['first', 'second']) for (const fulfillment of ['first', 'second']) {
    const text = deriveSteps(result.document, { 'alt:1': `alt:1:${payment}`, 'alt:2': `alt:2:${fulfillment}` }).map(step => step.text);
    expect(text).toHaveLength(payment === 'first' ? 20 : 24);
    expect(text.includes('Declined · insufficient funds')).toBe(payment === 'second');
    expect(text.includes('Order update · shipped')).toBe(fulfillment === 'first');
    expect(text.includes('Order update · delayed')).toBe(fulfillment === 'second');
    const authorization = text.indexOf(payment === 'first' ? 'Authorized · payment ref p_82' : 'Authorized · payment ref p_83');
    expect(authorization).toBeGreaterThan(0);
    expect(text.indexOf('Relay OrderConfirmed from the outbox')).toBeGreaterThan(authorization);
  }
});
