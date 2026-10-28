# Auth screens — login, sign-up, admin login

Screenshots of the mobile-first auth screens after the UI polish (PR "Auth screens: mobile UI
polish"). Everything here is the **same component** — `src/components/auth-mobile-screen.tsx` —
rendered by `/login`, `/signup` and `/admin-login`.

## Files

| File | Screen | Viewport | Theme |
| --- | --- | --- | --- |
| `login-360x640-light.png` / `-dark.png` | Sign in | 360 × 640 (small phone) | light / dark |
| `login-390x844-light.png` / `-dark.png` | Sign in | 390 × 844 (iPhone 14) | light / dark |
| `login-desktop-1440x900-light.png` / `-dark.png` | Sign in | 1440 × 900 (still a centred phone-width card) | light / dark |
| `login-error-390x844-light.png` / `-dark.png` | Sign in with an inline error banner | 390 × 844 | light / dark |
| `signup-360x640-light.png` | Sign up | 360 × 640 | light |
| `signup-390x844-light.png` / `-dark.png` | Sign up | 390 × 844 | light / dark |
| `signup-desktop-1440x900-light.png` | Sign up | 1440 × 900 | light |
| `admin-login-360x640-light.png` | Admin (email) sign in | 360 × 640 | light |
| `admin-login-390x844-light.png` / `-dark.png` | Admin (email) sign in | 390 × 844 | light / dark |
| `admin-login-desktop-1440x900-light.png` / `-dark.png` | Admin (email) sign in | 1440 × 900 | light / dark |
| `before-login-phone-390.png`, `before-login-desktop-1440.png` | Previous sign in screen, for comparison | 390 / 1440 | light |

## How these were produced

No browser engine is available in the agent sandbox (no Chromium download, no
Cairo/Pango, no package mirror), so the PNGs are rendered from the component's own structure,
copy, spacing scale and `globals.css` design tokens with `satori` + `resvg`, using PT Sans
(the app font). They are pixel-accurate for layout, colour and typography, but the live
build is the authoritative check:

```bash
npm run dev   # -> http://localhost:5000/login, /signup, /admin-login
```

A browser screenshot can be taken from that build at the same viewports if needed.

## What changed

- Branded hero (navy → indigo brand tokens only, soft brand glows + dot texture), larger
  logo mark and wordmark, headline and one-line sub-line. Compact on short phones.
- Form sheet overlaps the hero with a 28px radius, soft shadow and its own surface.
- 52–56px inputs on `bg-white` (dark: translucent white) with a 1.5px border, brand-coloured
  bare UXWing icons, brand focus ring and readable placeholders.
- Phone field carries a `+254 · Kenya` chip; PIN fields get `inputMode="numeric"`,
  `pattern="[0-9]*"`, `maxLength=6`, spaced digits and a bare eye show/hide toggle.
- Primary action is a full-width 56px button directly under the fields (brand colour, spinner
  state); secondary actions are a 48px outlined button plus a quiet icon text link.
- The dense PIN paragraph is now a one-line hint plus a `Forgot PIN? Get help` disclosure that
  expands the same guidance.
- The sheet fills the viewport (`min-h-dvh`, hero top, form centred, footer note pinned) so
  there is no dead gap; short viewports (`max-height` 740/700/660px) tighten the hero,
  spacing and optional copy so the primary action stays above the fold.
- Inline error banner with an icon and `aria-live`, 16px+ input text, labels tied to inputs,
  logical focus order, fade/slide-in on mount disabled under `prefers-reduced-motion`.
