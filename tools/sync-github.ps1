[CmdletBinding()]
param(
    [string]$Repo = 'cookyyykc/my-budget-app',
    [string]$Branch = 'main',
    [string]$Message = 'chore: sync deployment files',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$token = $env:GITHUB_TOKEN
if ([string]::IsNullOrWhiteSpace($token)) {
    throw 'Set GITHUB_TOKEN in the current process before running this script. The token is never written to disk.'
}

$api = "https://api.github.com/repos/$Repo"
$headers = @{
    Authorization = "Bearer $token"
    Accept = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}

function Invoke-GhApi {
    param(
        [Parameter(Mandatory)][string]$Uri,
        [string]$Method = 'GET',
        [object]$Body
    )
    $json = $null
    if ($null -ne $Body) { $json = $Body | ConvertTo-Json -Depth 12 -Compress }
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            $params = @{ Uri = $Uri; Method = $Method; Headers = $headers; TimeoutSec = 30 }
            if ($null -ne $json) {
                $params.ContentType = 'application/json'
                $params.Body = $json
            }
            return Invoke-RestMethod @params
        }
        catch {
            $statusCode = $null
            if ($_.Exception.Response) { $statusCode = [int]$_.Exception.Response.StatusCode }
            if ($attempt -lt 3 -and ($null -eq $statusCode -or $statusCode -in 429,500,502,503,504)) {
                Start-Sleep -Seconds $attempt
                continue
            }
            if ($statusCode) { throw "GitHub API failed ($statusCode): $($_.Exception.Message)" }
            throw "GitHub API failed: $($_.Exception.Message)"
        }
    }
}

function Get-GitBlobSha {
    param([byte[]]$Bytes)
    $header = [Text.Encoding]::ASCII.GetBytes("blob $($Bytes.Length)" + [char]0)
    $stream = [IO.MemoryStream]::new()
    $stream.Write($header, 0, $header.Length)
    $stream.Write($Bytes, 0, $Bytes.Length)
    $sha1 = [Security.Cryptography.SHA1]::Create()
    try {
        $hash = $sha1.ComputeHash($stream.ToArray())
        return ([BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
    }
    finally {
        $sha1.Dispose()
        $stream.Dispose()
    }
}

$started = Get-Date
$root = (Get-Location).Path
$trackedRaw = git -c core.quotepath=false ls-files -z
if ($LASTEXITCODE -ne 0) { throw 'git ls-files failed' }
$tracked = @($trackedRaw -split "`0" | Where-Object { $_ })
if ($tracked.Count -eq 0) { throw 'No tracked files found' }

$ref = Invoke-GhApi -Uri "$api/git/ref/heads/$Branch"
$baseSha = $ref.object.sha
$baseCommit = Invoke-GhApi -Uri "$api/git/commits/$baseSha"
$remoteTree = Invoke-GhApi -Uri "$api/git/trees/$($baseCommit.tree.sha)?recursive=1"
$remoteBlobs = @{}
foreach ($entry in $remoteTree.tree) {
    if ($entry.type -eq 'blob') { $remoteBlobs[$entry.path] = $entry.sha }
}

$changed = @()
foreach ($path in $tracked) {
    $full = Join-Path $root ($path -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { continue }
    $bytes = [IO.File]::ReadAllBytes($full)
    $localSha = Get-GitBlobSha -Bytes $bytes
    if ($remoteBlobs[$path] -ne $localSha) {
        $changed += [pscustomobject]@{ Path = $path; Bytes = $bytes; Sha = $localSha }
    }
}

$elapsed = [math]::Round(((Get-Date) - $started).TotalSeconds, 2)
if ($changed.Count -eq 0) {
    "GitHub is already up to date ($elapsed s, $($tracked.Count) tracked files)."
    return
}
if ($DryRun) {
    "Would update $($changed.Count) file(s) in $elapsed s:"
    $changed | ForEach-Object { "  - $($_.Path)" }
    return
}

$entries = @()
foreach ($file in $changed) {
    $blob = Invoke-GhApi -Uri "$api/git/blobs" -Method POST -Body @{
        content = [Convert]::ToBase64String($file.Bytes)
        encoding = 'base64'
    }
    $entries += @{ path = $file.Path; mode = '100644'; type = 'blob'; sha = $blob.sha }
}

$tree = Invoke-GhApi -Uri "$api/git/trees" -Method POST -Body @{
    base_tree = $baseCommit.tree.sha
    tree = $entries
}
$commit = Invoke-GhApi -Uri "$api/git/commits" -Method POST -Body @{
    message = $Message
    tree = $tree.sha
    parents = @($baseSha)
}
Invoke-GhApi -Uri "$api/git/refs/heads/$Branch" -Method PATCH -Body @{
    sha = $commit.sha
    force = $false
} | Out-Null

$elapsed = [math]::Round(((Get-Date) - $started).TotalSeconds, 2)
"GitHub sync succeeded: $($changed.Count) file(s) updated in $elapsed s (commit $($commit.sha.Substring(0,12)))."
