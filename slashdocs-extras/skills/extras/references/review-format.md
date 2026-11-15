# Review format: in-page answers, OPEN items, sidebar contents

## Reading a review round
- Pull comments with `slashdocs docs comments list <doc> --json` and read every thread,
  including replies (the user often answers in a reply).
- Sort each comment into one of:
  - **question**: answer it in the page;
  - **change request**: do the work (eng-team for code), then record the result in the page;
  - **decision**: apply it, and remove or close the matching OPEN item;
  - **correction** of something the page says: fix the text in place and say it was corrected.
- Never guess in an answer. If it isn't verified, write "I don't know" and what would
  settle it.

## Answer blocks: in context, never in a separate Q&A section
- Put each answer directly below the paragraph, list or figure the comment was anchored
  to (the comment's `selected_text`). If the anchor is inside a list or figure, place the
  block after the whole list or figure.
- Block format:
  - a `div.qa` with an accent left border;
  - an `h3` holding the user's question, cleaned up but faithful to their wording;
  - a muted status line: `Your comment · <tag>`, with tags `answered`, `in progress`
    or `answered with images`;
  - then the answer: bold lead sentences, short paragraphs, lists for steps or options,
    evidence as file:line, commit SHAs, comm-log ids, and figures where they help.
- A follow-up question in a reply gets its own `h3` "Follow-up: …" inside the same block.
- Keep the page's original text. When the page was wrong, say so where it was wrong
  ("Correction: …"), fix the text, and keep the explanation short.
- Status changes since the page was written go in a `div.upd` note (green left border)
  at the end of the affected section, such as "Update <date>: this change is gone".

## OPEN items
- Use one only for a specific question the user must decide, tied to a section.
  Never an overarching or catch-all item such as "testing hold" or "what may run".
- Markup: `div.open#open-<slug>` with a red border, starting with
  `<span class="lbl">OPEN:</span> <strong>short question</strong>`, then the options
  as a numbered list, the recommendation and what each option costs.
- Place it in the section it concerns, after the related answer block.
- When the user decides, remove the item. If the decision has lasting meaning, leave a
  one-line `div.upd` "Closed (<date>, your call): …" in its place.

## Contents sidebar (match the project doc layout)
- `div.layout` grid: a 17rem sticky `nav.toc` on the left, `main` on the right.
  Below 64rem the sidebar goes static on top and hides child items. It's hidden in print.
- Rebuild the sidebar on every push:
  - one numbered entry per `h2` section;
  - child entries for that section's OPEN items, in red (`a.openlink`, "OPEN: …");
  - child entries for answered questions ("Q: …", trimmed to about 70 characters).
- Don't keep a separate "Contents" list in the body.

## Closing out the round
- Push one new version with a multi-line `--summary`, one line per change.
- Then resolve every thread you answered, including replies. The sidebar replaces the
  comments for navigation, so don't leave answered threads open.
- Don't post status replies on threads when the answer is already in the page.
- Large pages: images are inlined as base64 (shrink to about 1400 px, JPEG quality
  about 75). If a push times out, check `slashdocs docs show <doc>` for the current
  version before retrying, so you don't create duplicates.

## Starter CSS
Define the colour tokens (`--fg`, `--muted`, `--line`, `--panel`, `--accent`, `--good`,
`--bad`) for light and dark, keyed on `:root[data-slashdocs-theme="dark"]` (see
`slashdocs guidelines theme`).

```css
.layout{display:grid;grid-template-columns:17rem minmax(0,1fr);gap:2.2rem;max-width:96rem;margin:0 auto;padding:0 1.5rem}
.layout>main{margin:0;max-width:80ch;min-width:0}
nav.toc{position:sticky;top:0;align-self:start;max-height:100vh;overflow-y:auto;padding:1.5rem .5rem 2rem 0;font-size:.84rem;line-height:1.35;border-right:1px solid var(--line)}
nav.toc h2{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 .6rem;border:0;padding:0}
nav.toc ol{list-style:none;padding:0;margin:0}
nav.toc ol ol{padding-left:.9rem;margin:.15rem 0 .45rem}
nav.toc li{margin:.18rem 0}
nav.toc a{color:var(--fg);text-decoration:none}
nav.toc ol ol a{color:var(--muted)}
nav.toc a.openlink{color:var(--bad);font-weight:600}
nav.toc a:hover{color:var(--accent);text-decoration:underline}
@media (max-width:64rem){.layout{display:block;padding:0 1rem}nav.toc{position:static;max-height:none;border-right:0;border-bottom:1px solid var(--line);padding:.8rem 0}nav.toc ol ol{display:none}}
@media print{nav.toc{display:none}.layout{display:block}}

.qa{border:1px solid var(--line);border-left:3px solid var(--accent);background:var(--panel);padding:.2rem 1rem .8rem;margin:1.4rem 0}
.qa h3{margin:.8rem 0 .3rem;font-size:1.02rem;line-height:1.35}
.qa .on{font-size:.8rem;color:var(--muted);margin:0 0 .5rem}

.open{border:1px solid var(--bad);border-left:4px solid var(--bad);background:var(--panel);padding:.6rem .9rem;margin:1.2rem 0}
.open .lbl{font-family:ui-monospace,monospace;font-weight:600;color:var(--bad)}

.upd{border:1px solid var(--line);border-left:4px solid var(--good);background:var(--panel);padding:.6rem .9rem;margin:1.2rem 0}
```

## Skeleton
```html
<div class="layout">
<nav class="toc" aria-label="Table of contents">
  <h2>Contents</h2>
  <ol>
    <li><a href="#s1">1. Section</a>
      <ol>
        <li><a class="openlink" href="#open-x">OPEN: Short question</a></li>
        <li><a href="#qa1">Q: The user's question…</a></li>
      </ol></li>
  </ol>
</nav>
<main>
  <h2 id="s1">Section</h2>
  <p>The passage the user commented on.</p>
  <div class="qa" id="qa1">
    <h3>The user's question</h3>
    <p class="on">Your comment · <span class="tag">answered</span></p>
    <p><strong>Lead answer.</strong> Detail.</p>
  </div>
  <div class="open" id="open-x"><p><span class="lbl">OPEN:</span> <strong>Short question</strong></p>
    <ol><li>Option 1 (recommended): cost.</li><li>Option 2: cost.</li></ol></div>
</main>
</div>
```
