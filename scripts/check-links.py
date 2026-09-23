"""Relative markdown links must resolve, case-exactly.

Compared against `git ls-files` rather than the filesystem: macOS is
case-insensitive and the CI runner is not, so a wrong-case link passes
locally and 404s in CI.

Links inside fenced code blocks are examples, not links. The ADR template
is skipped entirely -- its NNNN placeholders are deliberate.
"""

import posixpath
import subprocess
import sys

SKIP = {"docs/decisions/0000-template.md"}


def tracked_files():
    out = subprocess.run(
        ["git", "ls-files"], capture_output=True, text=True, check=True
    ).stdout
    return set(out.splitlines())


def links(line):
    i = 0
    while True:
        a = line.find("](", i)
        if a == -1:
            return
        b = line.find(")", a)
        if b == -1:
            return
        target = line[a + 2 : b]
        i = b + 1
        yield target.split(" ")[0].split("#")[0]


def main():
    tracked = tracked_files()
    problems = []
    for path in sorted(f for f in tracked if f.endswith(".md")):
        if path in SKIP:
            continue
        try:
            with open(path, encoding="utf-8") as fh:
                lines = fh.read().splitlines()
        except OSError:
            continue
        fenced = False
        for line in lines:
            stripped = line.lstrip()
            if stripped.startswith("```") or stripped.startswith("~~~"):
                fenced = not fenced
                continue
            if fenced:
                continue
            for target in links(line):
                if not target or not target.endswith(".md"):
                    continue
                if target.startswith(("http://", "https://", "mailto:", "/")):
                    continue
                resolved = posixpath.normpath(
                    posixpath.join(posixpath.dirname(path), target)
                )
                if resolved not in tracked:
                    problems.append(f"{path} -> {target}")
    for p in problems:
        print(p)
    return 0


if __name__ == "__main__":
    sys.exit(main())
