# Design System Document: Educational Editorial

## 1. Overview & Creative North Star
**Creative North Star: The Academic Curator**

In the demanding, high-velocity environment of a classroom, a teacher’s digital tool should not feel like an overwhelming spreadsheet. This design system moves beyond the "standard dashboard" to create an editorialized, premium experience. It treats school management with the authority of a high-end publication, utilizing intentional asymmetry, layered depth, and breathing room to reduce cognitive load. 

By prioritizing "The Academic Curator" mindset, we replace rigid grids with sophisticated tonal layering and high-contrast typography, ensuring that critical data like student attendance and exam grades feels curated and accessible rather than cluttered.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
Our palette is rooted in the brand’s professional blue and forest green, but expanded into a complex range of Material-style tokens to allow for sophisticated layering.

### Palette Strategy
- **Primary (`#004ac6`) & Primary Container (`#2563eb`):** The engine of the UI. Used for critical actions and brand presence.
- **Secondary (`#1f6c3a`):** Used for growth-oriented data, such as passing grades and successful attendance marks.
- **Tertiary (`#943700`):** An earthy, authoritative accent for warnings and high-priority alerts that require teacher attention.

### The "No-Line" Rule
To achieve a premium, custom feel, **1px solid borders are prohibited for sectioning.** 
Boundaries must be defined solely through background color shifts. For example, a card (`surface-container-lowest`) should sit atop a section background (`surface-container-low`) to create a natural, seamless edge.

### Surface Hierarchy & Nesting
Treat the mobile UI as a series of physical layers.
- **Base:** `surface` (`#f8f9ff`)
- **Sectioning:** `surface-container-low` (`#eff4ff`) 
- **Active Cards:** `surface-container-lowest` (`#ffffff`) for maximum "pop" and clarity.

### The "Glass & Gradient" Rule
Standard flat colors are insufficient for a signature look. 
- **Floating Elements:** Use Glassmorphism for overlays. Combine semi-transparent `surface` colors with a 12px backdrop-blur to allow underlying content to peek through subtly.
- **CTAs:** Use subtle linear gradients (e.g., `primary` to `primary-container`) to provide a tactile "pressable" quality that feels intentional and polished.

---

## 3. Typography: Editorial Authority
We utilize a dual-typeface system to balance character with extreme legibility.

- **Display & Headlines (Manrope):** A modern sans-serif with geometric foundations. Used for page titles and large data points (e.g., overall class average). This adds the "editorial" signature.
- **Body & Labels (Inter):** A high-legibility workhorse. Specifically chosen for the "busy classroom" environment to ensure attendance lists and exam marks are readable at a glance, even in poor lighting or on small devices.

### Scale Highlights
- **Display-LG (3.5rem):** Reserved for high-impact welcome screens or milestone data.
- **Title-MD (1.125rem):** The standard for card headers and student names.
- **Label-MD (0.75rem):** Used for metadata like "Class" or "Section" labels, ensuring they are distinct from the primary data.

---

## 4. Elevation & Depth
Depth in this system is achieved through **Tonal Layering** rather than structural lines.

- **The Layering Principle:** Instead of a shadow, place a `surface-container-lowest` card on a `surface-container` background. The shift in hex code creates a soft, natural lift.
- **Ambient Shadows:** When a true floating state is required (e.g., a "Bulk Mark" FAB), use an extra-diffused shadow:
  - **Blur:** 24px - 32px
  - **Opacity:** 6% 
  - **Color:** A tinted version of `on-surface` (`#0d1c2e`) to mimic natural light.
- **The "Ghost Border" Fallback:** If accessibility requires a border, use `outline-variant` at 15% opacity. Never use 100% opaque borders.

---

## 5. Components

### Cards & Lists
- **Rule:** Forbid divider lines. Use `0.75rem` (md) or `1rem` (lg) vertical white space to separate list items.
- **Style:** Cards use `xl` (1.5rem) rounded corners for a soft, approachable feel. Content within cards should be nested using `surface-container-high` for sub-sections.

### Buttons
- **Primary:** Gradient-fill from `primary` to `primary-container`. Corner radius: `full`.
- **Secondary:** Transparent background with a `surface-variant` fill and `on-surface` text.
- **Tertiary:** Text-only, using the `primary` token for high-visibility links.

### Input Fields
- **Container:** Uses `surface-container-highest` background to create a "recessed" look.
- **Focus:** No heavy border; instead, use a 2px `primary` underline or a subtle `primary-fixed` glow.

### Status Indicators (Chips)
- **Success:** `secondary-container` background with `on-secondary-container` text.
- **Danger:** `error-container` background with `on-error-container` text.
- **Warning:** `tertiary-container` background with `on-tertiary-container` text.

### Signature App Components
- **Attendance Toggle:** A high-contrast pill chip that switches between `secondary` (Present) and `error` (Absent) with a tactile bounce animation.
- **Exam Progress Rail:** A thin, `primary-fixed-dim` track with a `primary` indicator to show grading completion percentage.

---

## 6. Do's and Don'ts

### Do
- **Do** use `surface-container` tiers to create hierarchy.
- **Do** use large, bold `display` typography for empty states to keep the app feeling premium.
- **Do** use iconography (clipboard, chart, user) consistently as the primary visual anchor for navigation.
- **Do** embrace white space; let the data breathe so teachers can focus on one student at a time.

### Don't
- **Don't** use black (`#000000`) for text. Use `on-surface` (`#0d1c2e`) for a softer, more professional contrast.
- **Don't** use 90-degree sharp corners. Everything must adhere to the `0.5rem` to `1.5rem` roundedness scale.
- **Don't** use standard grey shadows. Always tint shadows with the primary brand blue to maintain a cohesive "atmosphere."
- **Don't** use table grid lines. Separate rows and columns using subtle background alternating tints or generous padding.