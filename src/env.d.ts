declare module 'virtual:seqshow-export-player' {
  const code: string;
  export default code;
}

// The M0 esbuild harness imports CSS as text. Vite uses ?raw for export CSS.
declare module '*.css' {
  const text: string;
  export default text;
}
