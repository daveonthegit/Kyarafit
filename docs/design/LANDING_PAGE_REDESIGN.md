# Landing Page Redesign

**Branch:** `design/landing-page-redesign`  
**Date:** 2025-03-06

## 1. Problems in the current landing page

### Messaging and hierarchy

- **Hero:** The main headline (“Elevated Cosplay”) appears below a large image, so the value proposition is not visible within 5 seconds. “The Art of Transformation” is poetic but does not state what the product does.
- **No clear primary CTA in hero:** The main “Get Started” action is only in the footer; Log in is in the header. New visitors need an immediate path to sign up.
- **Product definition is buried:** The supporting line (“A curated digital space…”) is small and to the side; the product (wardrobe + builds + events) is not obvious at a glance.

### Layout and structure

- **Weak section flow:** Hero image → headline → features → app download → footer. There is no “problem” framing, no “how it works,” and no repeated CTA before the footer.
- **Inconsistent spacing:** Mix of `mb-10`, `mb-16`, `pt-12` without a consistent section rhythm (design system suggests sectionGap 48px / 12 in Tailwind).
- **Features grid:** Content is good but not presented as clear cards; hierarchy between icon, title, and body could be stronger.

### Responsiveness and clarity

- **Fixed horizontal padding:** `px-8` everywhere; no responsive padding scale (e.g. smaller on mobile, larger on desktop).
- **Hero image:** `h-[40vh]` with no min-height can feel small on large screens; headline and copy sit in a narrow column on wide viewports.
- **App download block:** Long copy and two store buttons; could be tighter and scannable.
- **Footer:** Only one CTA and a note; no navigation or secondary links.

### Conversion and accessibility

- **Single primary CTA:** “Get Started on Web” appears once at the bottom; no CTA in the hero or mid-page.
- **No product preview:** No screenshot or UI glimpse, so visitors cannot visualize the app.
- **Semantic structure:** Section headings and landmarks could be clearer for screen readers.

---

## 2. New layout structure

1. **Hero**
   - Clear headline: what the product is (e.g. “Your cosplay wardrobe & build tracker”).
   - One-line supporting description.
   - Primary CTA: “Get started” (sign up).
   - Secondary: “Log in” (existing).
   - Optional: product visual (hero image or simple UI mock) so the page is understandable in ~5 seconds.

2. **Problem**
   - Short “problem” statements (e.g. scattered closet, multiple events, build chaos) in 2–3 simple cards or lines.
   - Simple language; minimal text.

3. **How it works**
   - 3–4 steps: e.g. **Catalog** → **Build** → **Plan** → **Pack**.
   - Step cards or numbered list using design-system spacing and typography.

4. **Feature highlights**
   - Digital Closet, Build Tracking, Convention Planning as clear cards (reuse or align with existing feature block).
   - Optional: MagicCard (redesigned) for subtle hover if it fits the system.

5. **Product preview**
   - One or two UI-style screenshots or a bordered “product frame” so the app feels real.
   - Responsive scaling; no heavy assets.

6. **CTA section**
   - Short reinforcement of value.
   - Single primary CTA (Get started).
   - Clean spacing.

7. **Footer**
   - Log in, Get started, optional nav (e.g. Sign in · Get started).
   - Minimal, structured.

---

## 3. Design reasoning

- **Design system as source of truth:** All spacing, color, typography, and radius come from `design_tokens.json` and the component spec (serif for display, sans-wide for labels, kyar.* colors, radius.sm, no gradients in chrome).
- **Hero-first messaging:** Headline and CTA appear at the top so the product and next step are obvious quickly.
- **Sections in order:** Problem → How it works → Features → Preview → CTA follows a conventional landing flow and supports conversion.
- **Reuse:** Button component for CTAs; existing typography classes; optional MagicCard only where it adds clarity without changing identity.
- **Responsiveness:** Responsive padding and stacking (grid → single column on small screens) so the page works on mobile, tablet, and desktop.
- **Accessibility:** Semantic headings (h1, h2), landmarks, focus states (Button/link already use kyar-accent), and alt text for images.

---

## 4. Magic UI usage

- **Considered:** MagicCard on feature cards for a subtle hover highlight. If used, it remains the existing kyar-styled version (black-only spotlight, rounded-sm).
- **Not used (current implementation):** The redesign prioritizes clarity and structure; feature blocks use simple bordered cards. MagicCard can be added later to feature or “how it works” cards if desired.
- **No other Magic UI:** No blur-fade, gradients, or flashy effects so the page stays aligned with the editorial, minimal design system.

---

## 5. Implementation summary

- **Hero:** Headline “Your closet, builds, and events in one place” with one-line support and dual CTA (Get started, Log in). Product image on the right (responsive: stacks on mobile).
- **Problem:** “Less chaos, more craft” with three short problem cards (scattered closet, builds slip, event planning manual). Responsive: vertical list on mobile, three columns with left borders on sm+.
- **How it works:** Four step cards (Catalog → Build → Plan → Pack) in a 2x2 grid on sm, 4-col on lg. Numbered with design-system borders and spacing.
- **Feature highlights:** Three cards (Digital closet, Build tracking, Convention planning) with icons; border and padding from tokens.
- **Product preview:** “On web and mobile” with app store links and a placeholder phone visual (icon). Copy notes offline and no-account local use.
- **CTA section:** “Start organizing today” with one primary button (Get started on web).
- **Footer:** Tagline + nav (Log in, Get started). Semantic `<footer>` and `<nav>`.
- **Responsiveness:** `SECTION_PADDING` uses `px-6 sm:px-8 lg:px-12`; sections use `gap-12 lg:gap-14`; hero stacks on small screens; grids collapse to one column where appropriate.
- **Accessibility:** Landmarks (`main`, `header`, `footer`, `nav`), `aria-labelledby` on sections, focus rings (kyar-accent), and descriptive link/button text.

---

## 6. Future improvements

- Add a real product screenshot or short video in the preview section.
- Add testimonials or a short “Used by cosplayers” line if social proof becomes available.
- Consider A/B testing headline and CTA copy.
- Add optional “Privacy” / “Terms” links in the footer when those pages exist.
- Lazy-load below-the-fold images if the page gains more media.
