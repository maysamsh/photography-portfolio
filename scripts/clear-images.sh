#!/usr/bin/env bash
# Deletes all files (only) inside images, images/full, and images/thumbs.
# Subdirectories are left intact.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

for dir in images images/full images/thumbs; do
  if [[ -d "$dir" ]]; then
    find "$dir" -maxdepth 1 -type f -delete
    echo "Cleared files in $dir"
  else
    echo "Skip (not a directory): $dir"
  fi
done
