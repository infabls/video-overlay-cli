<#
.SYNOPSIS
  Pull the original author's updates (remote "upstream") into main and rebase the GTA work (branch gta-sa) on top.
  main always mirrors upstream; own changes live only on gta-sa.
#>
$ErrorActionPreference = "Stop"
if (git status --porcelain --untracked-files=no) { throw "Commit or stash tracked changes first." }
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
git switch gta-sa
git rebase main
if ($LASTEXITCODE -ne 0) { throw "Rebase conflict: resolve, then 'git rebase --continue'." }
git push --force-with-lease origin gta-sa
