// Set true while calibrating hospital shots; normal play has no debug output.
export const PRERENDER_DEBUG = false;
export const prerenderDebugEnabled = () => PRERENDER_DEBUG ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debugPrerender'));
