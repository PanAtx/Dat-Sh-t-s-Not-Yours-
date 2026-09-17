#!/bin/sh
# DSNYBoy version hook — keeps APP_VERSION moving on every commit.
# A new version -> a new dsnboy-shell-v* cache in sw.js -> installed PWA
# clients fetch the fresh shell on their next load. See scripts/bump-version.js.
if git diff --cached --unified=0 -- index.html | grep -Eq "^\+const APP_VERSION = '[0-9]+\.[0-9]+\.[0-9]+'"; then
  # This commit already carries a version change (a manual bump) - just make
  # sure every version point agrees with the new APP_VERSION.
  node scripts/bump-version.js check || exit 1
else
  # No version change in this commit: bump PATCH and stage the version files
  # so the bump becomes part of the commit being created.
  node scripts/bump-version.js || exit 1
  git add index.html manifest.json sw.js || exit 1
fi