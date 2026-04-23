export function formatStorageMb(mb: number): string {
  if (mb < 0) return "unlimited";
  if (mb < 1 / 1024) return "< 1 KB";
  if (mb < 1) {
    return `${Math.round(mb * 1024)} KB`;
  }
  if (mb < 1000) {
    const whole = Math.floor(mb);
    return mb - whole < 0.01 ? `${whole} MB` : `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return gb < 10 ? `${gb.toFixed(1)} GB` : `${Math.round(gb)} GB`;
}
