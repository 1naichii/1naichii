import { optimize } from "svgo";

const basePlugins = [
  {
    name: "preset-default",
    params: {
      overrides: {
        cleanupIds: false,
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
