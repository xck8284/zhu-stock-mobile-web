# Agent 對話結束時自動 commit + push（觸發 Render / Vercel 部署）
$deployScript = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "auto-push-deploy.ps1"
if (Test-Path $deployScript) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $deployScript
}
exit 0
