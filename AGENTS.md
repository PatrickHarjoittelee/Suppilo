# Suppilo Agent Notes

## Project

- Repository: `PatrickHarjoittelee/Suppilo`
- Product: Spara CRM / Suppilo.
- Main app file is usually `crm.html`.
- Public review URL is usually `https://patrickharjoittelee.github.io/Suppilo/crm.html` after merge/deploy.

## Start Of Work

- Locate the active checkout before assuming the current directory:
  - `find /workspace -maxdepth 5 -name .git -type d`
  - `find /workspace -maxdepth 5 -name crm.html -type f`
- Prefer the checkout whose remote is `https://github.com/PatrickHarjoittelee/Suppilo.git`.
- Always run `git status --short --branch`, `git remote -v`, and inspect the diff before staging.
- Do not revert unrelated local changes.

## Branch, Commit, PR

- Use `agent/{short-description}` branches for new work.
- If already on a relevant `agent/...` branch, continue on it.
- Use short Finnish commit messages, for example `Uudista historia aikajanaksi`.
- Default to a draft PR unless the user asks for merge or ready-for-review.
- Do not merge unless explicitly asked.

## Publishing

- If the user is on mobile or says local HTML files cannot be opened, prioritize pushing the branch and sharing the GitHub PR/branch URL.
- Try shell git first:
  - `git push -u origin "$(git branch --show-current)"`
- If shell git lacks GitHub credentials or `gh` is unavailable, use the GitHub connector tools to update/create the branch and PR.
- If neither route can publish, report the exact local branch and commit that are ready.

## Project Habits

- Keep Sheet/storage field names stable when possible. UI wording may change while the underlying field remains for compatibility.
- When `crm.html` changes, bump `BUILD_ID` so browser cache issues are easier to spot.
- Local `sandbox:` links are not enough for mobile review.
