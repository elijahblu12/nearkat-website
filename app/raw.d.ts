declare module '*.html?raw' {
  const html: string;
  export default html;
}

declare module '*.jpg?inline' {
  const dataUrl: string;
  export default dataUrl;
}
