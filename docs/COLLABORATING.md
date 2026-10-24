# How we collaborate on this repo

A plain-English guide for the two of us. Claude Code follows these rules automatically (they're in `CLAUDE.md` and enforced by hooks in `.claude/`), but this page explains the system so we both understand it.

## The golden rule

**Nothing goes straight into `main`.** Every change — big or small — lives on its own branch and arrives in `main` through a pull request (PR). `main` is what Netlify publishes, so it should only ever contain reviewed work.

## The cycle for any change

1. **Update main first**: `git checkout main && git pull` (Claude's session-start check reminds us when main is stale).
2. **Branch**: `git checkout -b content/update-apy` (prefix with `feat/`, `fix/`, `content/`, or `chore/`).
3. **Work and commit** on that branch.
4. **Push and open a PR**: Claude does this automatically and gives you the PR link.
5. **Send the link to the other person.** Netlify adds a **Deploy Preview** link to the PR within a minute or two: open it to see the change as it will look live. They open the PR on GitHub, read the "Files changed" tab, and either:
   - click **Review changes → Approve**, then **Merge pull request**, or
   - leave comments requesting changes.
6. After merging, the site republishes automatically at https://refihub-stake.netlify.app/ (give it a minute or two).
7. Delete the branch (GitHub offers a button after merge; locally run `git checkout main && git pull && git branch -d <branch>`).

Reviewing your own trivial PR and merging it is allowed when it's genuinely urgent or tiny — but the default is the other person reviews.

## Safety nets in place

- **Local (both machines, via this repo's `.claude/settings.json`)**: Claude is physically blocked from committing or pushing while on `main`, and is told at session start whether `main` is stale.
- **GitHub (needs the repo owner to switch on — see below)**: branch protection so *nobody* can push directly to `main`, even outside Claude.

## One-time setup for the repo owner (mkdir-numa)

Only the repo owner can enable branch protection. Takes 2 minutes:

1. Go to https://github.com/mkdir-numa/reeefisol/settings/branches
2. Click **Add branch ruleset** (or "Add rule" on older UI)
3. Name it `protect-main`, set enforcement to **Active**, target branch: **Include default branch**
4. Tick:
   - **Require a pull request before merging** (leave "Required approvals" at 0 — we encourage but don't force reviews)
   - **Block force pushes**
   - **Restrict deletions**
5. Save.

After this, GitHub itself rejects any direct push to `main` from anyone, and all changes must come through PRs.

## Future: Netlify

We plan to move hosting to Netlify. Its main benefit for this workflow: every PR gets its own temporary preview URL, so the reviewer can see the actual rendered site before merging instead of running it locally. When we do this, update `CLAUDE.md` and this file.
