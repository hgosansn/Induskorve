// Read CSS once per renderer creation, never once per tile/frame. No fallbacks:
// missing tokens are a configuration error, not a second hidden palette.
const tokens = [
  'background',
  'foreground',
  'card',
  'primary',
  'muted',
  'edge',
  'ink',
  'surface',
  'steel',
  'concrete',
  'concrete-light',
  'concrete-shadow',
  'ground',
  'ground-alt',
  'road',
  'power',
  'materials',
  'production',
  'danger',
  'soot',
] as const;
export function readPalette() {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    tokens.map((name) => {
      const value = style.getPropertyValue(`--${name}`).trim();
      if (!value) throw new Error(`Missing palette token: ${name}`);
      return [name, value];
    }),
  ) as Record<(typeof tokens)[number], string>;
}
export type Palette = ReturnType<typeof readPalette>;
