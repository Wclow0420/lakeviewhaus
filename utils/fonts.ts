/**
 * Plus Jakarta Sans is loaded in app/_layout.tsx via @expo-google-fonts.
 *
 * React Native (as of 0.81 / React 18 / automatic JSX transform) does not
 * offer a reliable way to globally replace the default font for every Text
 * component without either a Babel plugin or refactoring every component.
 * Attempts tried and rejected:
 *   - `Text.render` monkey-patch: `render` is not a callable property on RN's
 *     new Text internals.
 *   - `react/jsx-runtime` patch: Babel captures jsx into local bindings at
 *     import time, so runtime patching is too late.
 *   - `Text.defaultProps.style`: React replaces (not merges) default style
 *     whenever the caller passes a style prop, which is nearly every Text.
 *   - Replacing `RN.Text` on the module: breaks other libraries that have
 *     already captured the original export; produced native-module resolution
 *     failures in practice.
 *
 * The supported pattern is: reference `Fonts.{regular,medium,semibold,bold}`
 * from `constants/theme.ts` inside styles that want the brand font. See
 * `components/store/MenuItem.tsx` for an example.
 */

export const DEFAULT_FONT_FAMILY = 'PlusJakartaSans_400Regular';

/** No-op kept for API compatibility. */
export const installFontPatch = () => {};
