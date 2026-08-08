// The tool registry. Adding a tool to the suite means adding one line here.
//
// Each entry is lazily imported the first time its tab is opened, so a suite of
// twenty tools still costs one tool's worth of parsing at start-up.

export const TOOLS = [
  { id: 'timeline', label: 'Map & timetable', load: () => import('../tools/timeline/tool.js') },
  { id: 'pacing', label: 'Pacing', load: () => import('../tools/pacing/tool.js') },
  { id: 'diffusion', label: 'Diffusion text', load: () => import('../tools/diffusion/tool.js') },
  { id: 'text', label: 'Text editor', load: () => import('../tools/text/tool.js') },
  { id: 'dimensional', label: 'Token Button', load: () => import('../tools/dimensional/tool.js') },
];
