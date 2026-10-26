import { optimize } from "svgo";

const basePlugins = [
  {
    name: "preset-default",
    params: {
      overrides: {
        cleanupIds: false,
        // Animated clip rectangles must stay <rect> so their width can animate.
        convertShapeToPath: false,
        // Elements that start hidden and fade in via <animate> must survive.
        removeHiddenElems: { opacity0: false },
      },
    },
  },
];

export function optimizeSvg(source, { prefixIds } = {}) {
  const plugins = [...basePlugins];

  if (prefixIds) {
    plugins.push({
      name: "prefixIds",
      params: { prefix: prefixIds, delim: "-" },
    });
  }

  return optimize(source, {
    multipass: true,
    plugins,
    js2svg: { pretty: false },
  }).data;
}

export function stripSvgShell(source) {
  return source
    .replace(/^<svg\b[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/\s*<(?:title|desc)\b[^>]*>.*?<\/(?:title|desc)>/gs, "");
}
