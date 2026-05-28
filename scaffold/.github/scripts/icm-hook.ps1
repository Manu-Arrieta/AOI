param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("start", "pre", "post", "prompt", "compact")]
    [string]$Mode
)

$ErrorActionPreference = "Stop"

function Get-IcmBinary {
    $command = Get-Command icm -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Path
    }

    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "icm\bin\icm.exe"),
        (Join-Path $env:USERPROFILE ".local\bin\icm.exe")
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    return $null
}

$icmBin = Get-IcmBinary
if (-not $icmBin) {
    exit 0
}

$stdin = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($stdin)) {
    & $icmBin hook $Mode
} else {
    $stdin | & $icmBin hook $Mode
}

if ($LASTEXITCODE -ne $null) {
    exit $LASTEXITCODE
}