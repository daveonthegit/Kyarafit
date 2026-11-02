/**
 * Re-mounts on every navigation, so each route fades in instead of cutting (motion rule 9).
 * Opacity only: a transform here would re-anchor the fixed tab bar and dialogs inside pages.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
