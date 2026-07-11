# Apply Charme Branding

Rebrand the Salon Commission Management app to match the Charme Branding Guidelines 2015.

## Brand tokens (from the guidelines)

- **Primary (gold)**: Pantone 871C → approx `#B8955A` (CMYK 15/30/80/10). Tints for surfaces: `#C7A76F`, `#DCC69A`, `#EFE4CC`.
- **Neutrals**: white `#FFFFFF`, Cool Gray 7C `#8C8C8C` (K40), Cool Gray 11C `#333333` (K85).
- **Background rule**: prefer white; when dark is needed, use dark grey (`#333333`) — never pure black.
- **Gradient accent** (gold horizontal bar) available for hero/section accents.
- **Type**: Display = Didot (Bold) via `Didot`, fallback `"GFS Didot"` from Google Fonts. Italic accent = `Bodoni Moda` italic. Body = `"Avenir Next"` with fallback `"Nunito Sans"` from Google Fonts.
- **Motif**: the 20° rotated "slash/twinkle" pattern — reused as a subtle background texture at low opacity on auth screen and empty states.
- **Wordmark**: "CHARME" in Didot Bold with tagline *"beautify with confidence"* in Bodoni italic underneath.

## Changes

1. **`src/styles.css`** — replace the slate palette with the Charme tokens.
   - `--background` white, `--foreground` `#333333`.
   - `--primary` gold `#B8955A` with `--primary-foreground` white.
   - `--accent` warm cream `#EFE4CC`, `--muted` `#F7F2EA`.
   - `--border`/`--input` soft warm gray.
   - Dark mode uses dark grey (not black) surfaces with gold accents.
   - Add `--gradient-gold`, `--shadow-elegant`, `--font-display`, `--font-serif-italic`, `--font-body` tokens.
   - Register the new font tokens in `@theme inline`.
   - Import Google Fonts (`GFS Didot`, `Bodoni Moda`, `Nunito Sans`) via `<link>` in `index.html`.

2. **`index.html`** — add Google Font links, update `<title>` to "Charme — Commission Management", update meta description and theme-color to gold `#B8955A`.

3. **`src/components/AppShell.tsx`** — swap the scissors-in-square logo for the Charme wordmark: "CHARME" in Didot with the "beautify with confidence" italic tagline. Active nav uses gold underline/left-bar instead of the current slate. Sidebar background stays white with a subtle warm tint.

4. **`src/routes/auth.tsx`** — hero card uses the Charme wordmark, a low-opacity twinkle-pattern SVG background (inline, 20° rotated), gold primary button, italic tagline.

5. **New `src/components/CharmeLogo.tsx`** — reusable wordmark component (Didot "CHARME" + italic tagline) used in AppShell, auth, and printable invoices.

6. **Printable invoices** (`admin.invoices.$userId.$yearMonth.tsx`, `staff.invoices.$yearMonth.tsx`) — add the Charme wordmark header and gold divider so printed invoices carry the brand.

7. **Favicon** — generate a small gold "C" mark PNG (Didot style) and wire it in `index.html` per favicon rules; remove `public/favicon.ico`.

## Out of scope
No business logic, database, or route structure changes — this is purely visual rebrand.
