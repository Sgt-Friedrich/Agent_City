export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function prettyMs(value: number): string {
  if (value < 1000) {
    return `${value.toFixed(0)} ms`;
  }
  return `${(value / 1000).toFixed(2)} s`;
}

export function prettyPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function shortId(value: string): string {
  if (value.length <= 12) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
