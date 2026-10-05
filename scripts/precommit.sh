#!/bin/sh
# DSNYBoy version hook — keeps APP_VERSION moving on every commit.
# A new version -> a new dsnboy-shell-v* cache in sw.js -> installed PWA
# clients fetch the fresh shell on their next load. See scripts/bump-version.js.
#
# Detection: compare the STAGED index.html APP_VERSION against the version in
# HEAD. If the commit being created already carries a DIFFERENT version (a
# manual bump), just validate that every version point agrees with it.
# Otherwise bump PATCH and stage the version files so the bump is part of
# this commit. Comparing concrete version strings is far more robust than
# grepping a diff line, and is immune to indentation / line-ending quirks.
extract_ver() {
  # $1 = a full git-show ref, e.g. ":index.html" (staged) or "HEAD:index.html"
  git show "$1" 2>/dev/null \
    | grep -Eo "const APP_VERSION = '[0-9]+\.[0-9]+\.[0-9]+'" \
    | grep -Eo "[0-9]+\.[0-9]+\.[0-9]+" \
    | head -n 1
}

staged_ver=$(extract_ver ":index.html")     # the version in the index (what this commit will carry)
head_ver=$(extract_ver "HEAD:index.html")   # the version already committed

if [ -n "$staged_ver" ] && [ "$staged_ver" != "$head_ver" ]; then
  # This commit already carries a version change (a manual bump) - just make
  # sure every version point agrees with the new APP_VERSION.
  node scripts/bump-version.js check || exit 1
else
  # No version change in this commit: bump PATCH and stage the version files
  # so the bump becomes part of the commit being created.
  node scripts/bump-version.js || exit 1
  git add index.html manifest.json sw.js || exit 1
fi
