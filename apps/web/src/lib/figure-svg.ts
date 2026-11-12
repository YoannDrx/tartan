import type { SvgFigure } from "@tartan/mascot/svg";

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// Un athlète en SVG autonome, sans React : l'image est rendue par Satori, qui lit le SVG comme une image.
export const figureSvg = (figure: SvgFigure, viewBox: string) => {
  const bones = figure.bones
    .map((bone) => {
      const shapes = bone.shapes
        .map(({ tag, ...attributes }) => {
          const attrs = Object.entries(attributes)
            .map(([key, value]) => `${kebab(key)}="${String(value)}"`)
            .join(" ");
          return `<${tag} ${attrs}/>`;
        })
        .join("");
      return `<g transform="${bone.transform}">${shapes}</g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><g transform="${figure.root}">${bones}</g></svg>`;
};

export const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

