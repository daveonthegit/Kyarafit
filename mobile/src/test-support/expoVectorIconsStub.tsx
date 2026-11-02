/**
 * @expo/vector-icons ships syntax the vitest (jsdom) runner cannot parse —
 * aliased in `src/offline/vitest.config.ts`. Tests only need icon components
 * to render as inert nodes.
 */
function makeIconSet(name: string) {
  function IconStub(_props: Record<string, unknown>) {
    return <span data-testid={`icon-${name}`} />;
  }
  IconStub.glyphMap = {} as Record<string, number>;
  return IconStub;
}

export const Ionicons = makeIconSet("ionicons");
export const MaterialIcons = makeIconSet("material");
export const MaterialCommunityIcons = makeIconSet("material-community");
export default { Ionicons, MaterialIcons, MaterialCommunityIcons };
