# Dependency Radar

Dependency Radar is a lightweight app that turns a pasted `package.json` into an upgrade risk dashboard.

It combines:
- npm latest-version checks
- GitHub release-note keyword scanning (breaking/deprecated/migration/security/removed)
- simple semver delta detection (major/minor/patch)
- local snapshot storage for repeated audits

## Why this project

From Reddit/web research, developers repeatedly complain that dependency updates break apps and reading changelogs manually is painful:
- https://www.reddit.com/r/webdev/comments/13mmfwq/changelogdb_a_manually_collected_npm_package/
- https://www.reddit.com/r/programming/comments/11xfvj5/its_worth_putting_in_the_effort_to_regularly/
- https://www.reddit.com/r/programming/comments/1ojdrv9/the_average_codebase_is_now_50_dependencies_is/

This MVP focuses on that narrow pain: *quickly prioritize risky dependency updates before touching code*.

## Features

- Paste raw `package.json` content (dependencies + devDependencies)
- See current vs latest package versions from npm registry
- Risk score per package based on:
  - semver jump type
  - risky keyword presence in recent GitHub release notes
- Risk filter (high/medium/low) + summary counters
- Snapshot save/load/delete (browser localStorage)

## Run locally

This is a static app; open `index.html` in browser.

Optional local server:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Use `sample-package.json` for a quick test payload.

## Live demo

Live URL: https://mibragimov.github.io/dependency-radar/
