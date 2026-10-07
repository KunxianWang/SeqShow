import { expect, test } from 'vitest';
import { safeJson } from '../../src/export';

test.each([
  '</script><script>window.exportInjected=1</script>',
  '"quoted" & <tag> \\ backslash',
  '中文消息\u2028第二行\u2029第三行',
])('export JSON preserves text without ending the script element: %s', text => {
  const data = { text, nested: [text] };
  const encoded = safeJson(data);
  expect(JSON.parse(encoded)).toEqual(data);
  expect(encoded).not.toMatch(/<|\u2028|\u2029/u);
});
