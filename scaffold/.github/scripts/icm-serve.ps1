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
    [Console]::Error.WriteLine('{"error": "icm binary not found. Rerun project setup (setup.sh on macOS/Linux, setup.ps1 on Windows)."}')
    exit 1
}

& $icmBin serve --compact
if ($LASTEXITCODE -ne $null) {
    exit $LASTEXITCODE
}