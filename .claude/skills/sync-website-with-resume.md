---
name: sync-website-with-resume
description: Sync index.html (About Me, Technical Strengths, and the Experience/Education modals) with the latest content of docs/Billy_Haile-Mariam_Resume.pdf. Use whenever the resume PDF has been updated and the personal website needs to reflect the same job titles, dates, bullets, and skills — or when asked to "update the site to match the resume" / "sync the website with my resume".
---

# Sync website with resume

Keeps `index.html` in this repo aligned with `docs/Billy_Haile-Mariam_Resume.pdf`, which is the
source of truth for job history, titles, dates, bullet content, and technical strengths.

## Inputs

- Resume: `docs/Billy_Haile-Mariam_Resume.pdf`
- Site: `index.html`

Read both **in full** before making any edits — the resume with `Read` (it's a multimodal PDF,
so read it, don't try to shell out to a text extractor), and `index.html` with `Read`. Do not rely
on memory of a previous sync; the resume may have changed since.

## Sections in scope

1. **About Me** (`<section id="about">`) — the narrative paragraphs. These are prose, not a
   verbatim copy of the resume's Summary, so rewrite them to accurately reflect the resume's
   current facts (years of experience, current title/org, current responsibilities) while keeping
   the site's own voice and paragraph structure. The "currently" paragraph must describe whatever
   role is now most recent in the resume; older roles move into "previously" paragraphs.
2. **Technical Strengths** (`<section id="technical-strengths">`) — the table of skill pills.
   Replace its contents wholesale to match the resume's Technical Strengths table exactly:
   same terms, same grouping/order, same row/column count (add or remove `<td>`/`<tr>` as needed
   if the resume's grid shape changed).
3. **Experience & Education modals** (`.portfolio-box` + its paired `.modal` under `#experience`
   and `#education`) — one modal per company/school. For each:
   - Card caption (`.project-name`) — stacked title text shown before the modal opens.
   - Modal body — one `<h4>title</h4>` + `<h5>org/team | location | date range</h5>` + `<ul>` of
     bullets per role at that company, most recent role first.

Do not touch the hero carousel, nav links, contact section, or resume-download section unless the
resume itself indicates something there changed (e.g. a new email/LinkedIn).

## Process

1. Read the resume PDF (all pages) and `index.html` in full.
2. Diff mentally, company by company / section by section. For each company already present as a
   modal, compare every role: title, org/team line, location, date range, and bullet text
   word-for-word against the resume. Common mismatch patterns seen in the past:
   - Bullets reworded, added, or removed between resume revisions (e.g. bullets dropped, or new
     ones like a tooling detail added).
   - Small wording/spelling differences the resume uses consistently (e.g. "CyberArk" not
     "Cyber Ark", "microservices" not "micro-services", "Swagger UI" not "SwaggerUI",
     "Red Hat OpenShift" not "Redhat OpenShift"). Match the resume's spelling exactly, even for
     terms that appear correct as currently written.
   - A role's date range shifting because a promotion/transfer happened (the old "Present" role
     now has an end date, and a new role above it is "Present").
3. If a company gained a new role (promotion, transfer, or new "Present" entry):
   - Insert a new `<h4>`/`<h5>`/`<ul>` block at the top of that modal's body (most recent first).
   - If the previously-current role bullets/dates changed as a result (e.g. now has an end date
     instead of "Present"), update those too.
   - Widen `<div class="modal-dialog">` to `modal-dialog modal-lg` if the modal now holds enough
     content that the default width would feel cramped (compare to other multi-role modals in the
     file, which already use `modal-lg`).
   - Update the card caption if the stacked titles displayed there changed.
4. Promotion-arrow convention: this site uses `<i class="fa fa-arrow-up"></i>` next to a role's
   `<h4>` title to mean "promoted into this title from the role listed directly below it in the
   modal." Only add the arrow when the title text actually changes between chronologically
   adjacent roles at that company — never add it between two roles that share the same title
   (lateral team change), and don't forget the `<p><i class="fa fa-arrow-up"></i> = promoted</p>`
   legend at the bottom of any modal that uses the icon. Re-derive arrow placement fresh from the
   full role sequence rather than assuming the existing arrows are still in the right place —
   inserting a new role can shift which adjacent pair is the "real" promotion.
5. If the resume lists a company/school with no matching modal on the site at all (a genuinely new
   entry, not just a new role at an existing company), do not fabricate a logo image or invent one
   — stop and ask the user for the logo asset path before adding the new `.portfolio-box`/`.modal`
   pair, since every existing entry references a real image under `img/portfolio/`.
6. After edits, run `git diff --stat index.html` (or `git diff index.html`) to review the full
   scope of the change before reporting it back to the user. Do not commit unless asked.

## Out of scope / non-goals

- Don't reformat or restyle sections that already match the resume.
- Don't add commentary, comments, or restructure HTML beyond what's needed to represent the
  resume's content accurately.
- Don't invent bullets, dates, or skills that aren't in the resume.
