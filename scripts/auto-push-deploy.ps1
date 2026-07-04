# Auto commit + push for zhu-stock-mobile-web and zhu-stock-app.
# Render / Vercel deploy automatically when main is pushed.
# Usage: powershell -File scripts/auto-push-deploy.ps1 "optional commit message"

$ErrorActionPreference = "Stop"

$repos = @(
    @{
        Name = "zhu-stock-mobile-web"
        Path = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    },
    @{
        Name = "zhu-stock-app"
        Path = "C:\Users\user\Desktop\zhu-stock-app"
    }
)

function Invoke-RepoPush {
    param(
        [string]$RepoName,
        [string]$RepoPath,
        [string]$CommitMessage
    )

    if (-not (Test-Path (Join-Path $RepoPath ".git"))) {
        Write-Host "[skip] $RepoName - not a git repo: $RepoPath"
        return $false
    }

    Push-Location $RepoPath
    try {
        $status = git status --porcelain 2>$null
        if (-not $status) {
            Write-Host "[ok] $RepoName - nothing to commit"
            return $false
        }

        git add -A
        git reset HEAD -- "**/__pycache__/**" 2>$null
        git reset HEAD -- "**/node_modules/**" 2>$null
        git reset HEAD -- ".env" ".env.*" 2>$null

        $staged = git diff --cached --name-only
        if (-not $staged) {
            Write-Host "[ok] $RepoName - no staged changes after filters"
            return $false
        }

        git commit -m $CommitMessage
        git push origin HEAD
        Write-Host "[pushed] $RepoName -> origin ($(git rev-parse --short HEAD))"
        return $true
    }
    finally {
        Pop-Location
    }
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$defaultMessage = "Auto-deploy: agent changes ($timestamp)"
$commitMessage = $args[0]
if (-not $commitMessage) { $commitMessage = $defaultMessage }

$pushedAny = $false
foreach ($repo in $repos) {
    $pushed = Invoke-RepoPush -RepoName $repo.Name -RepoPath $repo.Path -CommitMessage $commitMessage
    if ($pushed) { $pushedAny = $true }
}

if ($pushedAny) {
    Write-Host ""
    Write-Host "Deploy triggered:"
    Write-Host "  Backend  -> https://zhu-stock-app.onrender.com (Render, ~1-3 min)"
    Write-Host "  Frontend -> Vercel (push main, ~1-2 min)"
} else {
    Write-Host "No repos had changes to push."
}
