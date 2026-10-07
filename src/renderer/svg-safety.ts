// Fail closed at the SVG/export boundary. A new Mermaid DOM shape needs review.
export function assertSafeSvg(svg: SVGSVGElement) {
  const tags = new Set(['svg', 'g', 'defs', 'marker', 'path', 'line', 'rect', 'text',
    'tspan', 'circle', 'ellipse', 'polygon', 'polyline', 'title', 'desc', 'style', 'symbol', 'use']);
  const ids = new Set(Array.from(svg.querySelectorAll('[id]'), node => node.id));
  ids.add(svg.id);
  const checkUrls = (value: string) => {
    for (const match of value.matchAll(/url\s*\((.*?)\)/giu)) {
      const ref = match[1].trim().replace(/^['"]|['"]$/gu, '');
      if (!ref.startsWith('#') || !ids.has(ref.slice(1))) throw new Error(`Unsafe SVG resource: ${ref}`);
    }
  };
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    if (node.namespaceURI !== 'http://www.w3.org/2000/svg' || !tags.has(node.localName)) {
      throw new Error(`Unsupported SVG element: ${node.localName}`);
    }
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || ['src', 'srcset', 'action', 'formaction', 'xml:base'].includes(name)) {
        throw new Error(`Unsafe SVG attribute: ${name}`);
      }
      if (name === 'href' || name === 'xlink:href') {
        if (!attr.value.startsWith('#') || !ids.has(attr.value.slice(1))) throw new Error('External SVG reference');
      }
      if (name === 'style') checkCss(attr.value);
      checkUrls(attr.value);
    }
    if (node.localName === 'style') checkCss(node.textContent || '');
  }
  function checkCss(css: string) {
    // Escapes/comments could hide resource-bearing tokens; generated CSS needs neither.
    if (/\\|\/\*|@import|@font-face|expression\s*\(/iu.test(css)) throw new Error('Unsupported SVG CSS');
    checkUrls(css);
  }
}
