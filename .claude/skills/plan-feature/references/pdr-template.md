# PDR: <Feature name>

> Status: PROPOSED · Author: plan-feature skill · Date: <YYYY-MM-DD>
> Repo: <repo> · Crosses former scope-fence: <none | which one, deliberately>

## 0. In plain terms (skim this)

<≤150 words, zero jargon, no internal component names or unexpanded acronyms.
What is this feature? Who is it for? What changes for them once it ships?
What are the one or two big decisions this plan makes?>

**Outline:**

- <3–7 bullets: the shape of the feature, each ≤1 line, plain language>

## 1. Prerequisites — actions needed from you

<Every human-only step, or "None — fully implementable as specced.">

| #   | What to do | Where (console/URL) | Produces (env var / config) | Blocking? |
| --- | ---------- | ------------------- | --------------------------- | --------- |

## 2. Problem & job-to-be-done

- **One-sentence idea:**
- **Who / job:**
- **Why now / strategic fit:** <verdict from research, incl. roadmap fit>
- **Strongest reason NOT to build:** <and why it doesn't win — or note it changed the plan>
- **Cheaper alternative considered:** <what, and why this plan beats it — or "adopted, see scope">

## 3. Scope

- **In scope:**
- **Out of scope (explicitly):**
- **Kill/scope criteria:** <conditions under which to stop or shrink>

## 4. UX / interaction spec

<For non-UI products, the interaction surface: CLI/bot/API ergonomics — same rigor.>

- **Surfaces touched:** <screens/routes/commands/conversations>
- **Components:** reuse <…> · create <…>
- **User flows (every step, happy AND unhappy):**
  1. <flow name>: step → step → outcome; failure branch → what the user sees
- **States:** empty · loading · error · partial · no-results · permission-denied — each specified, none "TBD"
- **Mobile / responsive:**
- **Accessibility:**
- **Copy & tone notes:**

## 5. Architecture & data

- **Approach (the one recommended way):**
- **Where logic lives:** <server / client / worker / job>
- **Data-model changes + migration path (and rollback):**
- **Impact on existing pipelines / computed data:**
- **Rendering/runtime strategy & position on interrogated assumptions:** <e.g. static vs dynamic — reasoned per-feature stance>
- **New capability layer?** <none | DB/auth/payments/etc. — flagged, with ops implications: hosting, migrations, secrets, cost; new ADR recommended: yes/no>

### File-level change map

| Path | Action (create/modify/delete) | Why |
| ---- | ----------------------------- | --- |

## 6. Dependencies

| Dependency | New? | Justification | Alternatives considered |
| ---------- | ---- | ------------- | ----------------------- |

Performance / bundle / cost impact: <…>

## 7. Risks, edge cases & open questions

- **Edge cases & failure modes:** <numbered>
- **Security / privacy / provenance:**
- **Risks + mitigations:**
- **Open questions (real forks only):**
- **Red-team log:** <each finding → folded in at §X | accepted risk because … | not applicable because …>

## 8. Definition of Done

<Every item objectively checkable — true/false without judgment — and tagged with the verification step(s) that prove it.>

- [ ] **DoD-1** <criterion> → verified by V-1
- [ ] **DoD-2** <criterion> → verified by V-2, V-5
- [ ] **DoD-n** All existing suites/gates listed in §9 pass (tests, lint, typecheck, evals, CI)

## 9. Verification & test protocol

<Exact, runnable. New tests to write are part of the implementation, not optional.>

| ID  | Type (unit/integration/e2e/manual) | What it proves | How to run / perform                       |
| --- | ---------------------------------- | -------------- | ------------------------------------------ |
| V-1 |                                    |                | `<exact command>` or numbered manual steps |

**Repo gates that must stay green:** <exact commands — test suite, lint, typecheck, evals, and any repo-specific gates (e.g. eval-sensitive-file rules)>

## 10. Implementation contract (binding on the implementing run)

Include verbatim in every PDR:

> Implementation of this PDR is complete only when **every** verification step in §9 passes and every §8 box is checked. A failing test is a signal to keep iterating — diagnose, fix, re-run — never a stopping point. You may not weaken, skip, or reinterpret a DoD item, delete or disable a test to make it pass, or declare partial completion. If you are genuinely blocked by something outside your control (missing secret, unprovisioned account, contradictory spec), stop and report the **specific blocker and what unblocks it** — do not ship a partial and call it done. Report final status as: all-green (with the command outputs), or blocked (with the blocker).
>
> **Working-tree discipline (parallel sessions):** implement in a dedicated worktree branched from clean `main` (`git worktree add ../<repo>-<slug> -b feat/<slug> main`) whenever one is available; if you must use a shared tree, check `git status` first and treat unrecognized uncommitted files as another session's work — never edit, revert, or commit them. Stage explicit FILES only (never directories, `.`, `-A`, or `commit -a`). Before pushing from a shared tree, re-run the gates with foreign changes stashed (`git stash -u` … `git stash pop`) so your commits are proven to stand alone.
