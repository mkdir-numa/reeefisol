---
name: plan-feature
description: Critically analyze a raw feature idea for the current repo and turn it into a full, implementation-ready PDR (product development request) — research fans out across product fit, UX/UI, architecture, data, dependencies and risk, then a red-team pass hardens one decisive plan with a plain-language overview, a hard Definition of Done, a mapped test protocol, and a binding "don't stop until all tests pass" implementation contract. Writes it to docs/features/ and opens a GitHub issue. Use whenever the user has an idea for a new feature/change and wants it fully fleshed out and spec'd — NOT to implement it.
allowed-tools:
  [
    "Agent",
    "Read",
    "Write",
    "Edit",
    "Bash",
    "Grep",
    "Glob",
    "WebSearch",
    "WebFetch",
    "AskUserQuestion",
  ]
---

# Plan a feature (critical PDR)

Turn a rough idea into a rigorous, implementation-ready spec. You **research and plan only** — you never write feature code here. The output is a PDR that a _fresh_ Claude Code run can pick up from a GitHub issue and implement, with a Definition of Done clear enough that "done" is unambiguous and a test protocol the implementer is contractually required to fully pass before stopping.

Be a critical partner, not a stenographer. The most valuable output is sometimes "don't build this, build that instead." Push back on scope, surface what the user hasn't thought of, and ground every claim in the actual codebase.

This skill is **project-aware, not project-specific**: it works in any repo by deriving that repo's constraints first (Step 0).

## Step 0 — Load project context (mandatory, before anything else)

1. **Check for a project appendix**: look in `references/projects/` (sibling of this file) for a file matching the current repo (by repo directory name or the markers listed at the top of each appendix). If one matches, read it in full — it is **authoritative** for this project's guardrails and known file map, and overrides anything you'd infer yourself. (No appendix exists for this repo yet — add one there if this project accumulates guardrails worth encoding.)
2. **Whether or not an appendix exists**, read the repo's own ground truth: `CLAUDE.md`, `README.md`, `docs/` (especially anything named PRD, ROADMAP, ARCHITECTURE, DESIGN, or an `adr/`/`decisions/` folder), and skim the top-level source layout.
3. From those, write down (for your own use throughout) the project's constraints in **three buckets** — keep them straight for the rest of the run:
   - **Enduring principles** — quality bars that always bind (design-system rules, data-integrity rules, review/eval gates, security tiers, mobile/a11y bars).
   - **Lifted or lifting scope-fences** — past "keep it small" cuts that are no longer law. A feature may legitimately cross them, but crossing must be a flagged, deliberate decision (ideally recorded as a new ADR/decision doc), never a side effect.
   - **Assumptions to interrogate** — load-bearing past bets (rendering strategy, platform choice, audience strategy) the PDR should actively re-examine per feature and take a reasoned position on, rather than inheriting either the old answer or its opposite.
4. If the repo has near-zero documentation, say so in the PDR's Risks section and derive constraints from the code itself — don't invent them.

## Step 1 — Intake & critical framing

1. Restate the idea in **one sentence** and name the **job-to-be-done** (who is it for, what are they trying to decide/do).
2. If the idea is underspecified in a way that changes the design, ask **2–3 sharp clarifying questions** via `AskUserQuestion` before researching. Don't ask what you can infer from the docs or code.
3. Critically assess up front: Is it strategically worth building (user job, roadmap fit, portfolio value)? What's the strongest reason **not** to build it? What's the smallest version that delivers the value, and what adjacent improvement might deliver more for less? If it adds a new capability layer (DB, auth, payments, live external data, background jobs), is that jump intended? Write down explicit **kill/scope criteria**.

## Step 2 — Parallel research fan-out

Launch the research dimensions **as parallel subagents in a single message** (multiple `Agent` calls at once). Give each agent: the one-sentence idea, the Step-0 constraint buckets, the **exact files to read** (from the appendix if present, otherwise from your Step-0 survey), and the **structured output** you need back. Use read-only `Explore` agents for discovery and a `Plan` agent for the architecture dimension.

**Scale the fan-out to the feature.** A one-screen tweak may need only dimensions 2–4 (or a single combined agent); a new capability layer needs all five. Never skip dimension 4 or 5 — dependencies/risk and verification design are where plans quietly fail.

1. **Product & strategy fit** (`Explore`) — read the PRD/roadmap/ADR-equivalents found in Step 0. Return: strategic fit verdict, the scope boundary, what to cut, competing/related roadmap items, whether the idea crosses a former scope-fence intentionally, and **at least one cheaper alternative or adjacent quick-win** that delivers similar value (or an explicit "none found").
2. **UX/UI & user flows** (`Explore`) — read the design-system docs/tokens and survey the UI code (for a non-UI product, "UX" = the interaction surface: CLI ergonomics, Slack/bot conversation design, API developer experience — treat it with the same rigor). Return: screens/routes/surfaces touched, components to reuse vs. create, **every user flow step-by-step**, all states (empty / loading / error / partial / no-results / permission-denied), mobile behavior, accessibility notes, copy/tone requirements, any missing design tokens.
3. **Architecture & data** (`Plan`) — read the architecture/schema docs and core libs. Return: where logic lives (server vs. client vs. worker), data-model/schema changes and their migration path, impact on computed/derived data and existing pipelines, rendering/runtime strategy, and a **file-level change map** (create / modify / delete, with one-line reasons).
4. **Dependencies, risks & edge cases** (`Explore`) — read the manifest(s) (`package.json` / `pyproject.toml` / etc.) and any dependency-policy docs. Return: any new deps + justification + alternatives considered, performance/bundle/cost impact, edge cases and failure modes, data-provenance/privacy/security concerns, open questions, and **a `human_action_items` list**: every step a human must do that the implementing agent cannot (create third-party accounts, generate/obtain API keys or OAuth credentials, enable providers in a dashboard, populate `.env*` or hosted secrets — the agent must never touch `.env*` — choose/confirm a paid plan or billing, configure DNS, grant console permissions, run ops-only steps). For each: what to do, where (which console/URL), and which env var / config value it produces.
5. **Verification design** (`Explore`) — survey the repo's existing test/eval/CI setup (test dirs, runners, eval suites, lint/typecheck commands, CI config). Return: which existing suites the feature must keep green, which repo-specific gates apply (e.g. eval-sensitive files, review requirements), what NEW tests the feature needs (unit / integration / e2e / manual script), and the exact commands to run them.

Do targeted `WebSearch`/`WebFetch` only when a dimension genuinely needs external facts (a library's API, an accessibility standard, a provider's pricing). Prefer the codebase.

## Step 3 — Synthesize the PDR

Read `references/pdr-template.md` (sibling of this file) and fill **every** section. Rules:

- **Open with the plain-language overview.** Section 0 of the template is a skim-readable, jargon-free summary (≤ ~150 words + a short bullet outline): what the feature is, who it's for, what changes for them, and the one or two big decisions made. Write it for a smart person who has never seen this codebase — no internal component names, no acronyms without expansion. If the founder reads only this section, they should still know exactly what's being built.
- **Then lead with what a human must do.** The "Prerequisites — actions needed from you" section comes right after: every human-only setup step that would otherwise block or silently stall implementation. If there are none, say "None — fully implementable as specced." Never bury a required key or manual setup step deep in later sections; surface it up top and cross-reference the detail.
- **Be decisive.** Present the single recommended approach, not a menu. Note alternatives only in the Risks/Open-Questions section when a real fork exists.
- **Ground every codebase claim** in a real file path. If you didn't verify it, say so explicitly ("unverified").
- **The load-bearing sections are Definition of Done and the Verification & Test Protocol — and they must be joined.** Every acceptance criterion is objectively checkable (a person or agent can confirm it true/false without judgment) **and maps by ID to at least one verification step** (an exact command, or a numbered manual check). Enumerate every user flow, including the unhappy paths. A DoD item with no way to verify it gets rewritten or cut.
- **Include the Implementation Contract verbatim from the template.** It binds the implementing run: implementation is not complete until every verification step passes; failing tests are a signal to keep iterating, never a stopping point; the implementer may not weaken, skip, or reinterpret DoD items; if genuinely blocked (missing secret, contradictory spec), it must stop and report the specific blocker rather than shipping a partial and calling it done.
- Reconcile conflicts between agents rather than pasting both. Keep it scannable: structured lists, tables, closed-set tags — no marketing prose.

## Step 4 — Red-team the draft (do not skip)

Before shipping, launch **one fresh adversarial `Explore` agent** with the draft PDR and this brief: "Find what this plan will get wrong or has missed. Check specifically: missing UI states (empty/loading/error/partial/permission-denied); migration + rollback story for any schema/data change; concurrency and race conditions; idempotency and retry behavior; security/permissions/tenancy; timezone, locale, currency and unit handling; observability (how will we know it broke in prod?); performance and cost at 10× current scale; backwards compatibility and feature-flag/rollout strategy; reversibility/undo; accessibility; and any DoD item that is vague, unverifiable, or unmapped to a test. Return a numbered list of concrete gaps, each with a proposed fix."

Fold every real finding back into the PDR (or record it as an explicit accepted risk with a reason). Discard findings that don't apply — but say so in the PDR's red-team log rather than silently dropping them.

## Step 5 — Ship the PDR

1. Write the finished doc to `docs/features/<slug>.md` (`<slug>` = kebab-case feature name). Create the dir if needed.
2. Open the issue:
   ```
   gh issue create --title "PDR: <Feature name>" --body-file docs/features/<slug>.md --label enhancement
   ```
   Use labels that actually exist in the repo (`gh label list`); drop any that don't rather than failing. If the repo has no GitHub remote or `gh` fails, skip the issue, keep the local file, and say so plainly.
3. Report back with: the **plain-language overview restated first** (so the founder can skim the outcome without opening anything), then the **"actions needed from you" list** (or "None"), then the issue URL and local path. State clearly: the PDR is ready for a fresh Claude Code run to implement — **you have not implemented it.**

## Do not

- **Do not implement the feature** — this skill stops at the PDR. (The "don't stop until tests pass" contract binds the _implementing_ run, via the PDR, not this one.)
- Don't treat lifted scope-fences as still binding — but don't cross them silently either. A new capability layer is a deliberate, flagged decision.
- Don't produce vague success criteria — if a DoD item isn't objectively checkable and mapped to a verification step, rewrite it until it is.
- Don't invent codebase facts — cite the file, or mark it unverified.
- Don't sacrifice the project's enduring principles (Step 0, bucket 1) to make the plan smaller or faster.
- Don't skip the red-team pass, and don't silently discard its findings.
