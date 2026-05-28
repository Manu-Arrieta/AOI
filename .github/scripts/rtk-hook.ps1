$ErrorActionPreference = "Stop"

function Get-RtkBinary {
    $command = Get-Command rtk -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Path
    }

    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "rtk\bin\rtk.exe"),
        (Join-Path $env:USERPROFILE ".cargo\bin\rtk.exe"),
        (Join-Path $env:USERPROFILE ".local\bin\rtk.exe")
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    return $null
}

$rtkBin = Get-RtkBinary
$stdin = [Console]::In.ReadToEnd()

if (-not $rtkBin) {
    [Console]::Out.Write($stdin)
    exit 0
}

if ([string]::IsNullOrEmpty($stdin)) {
    & $rtkBin hook copilot
} else {
    $stdin | & $rtkBin hook copilot
}

if ($LASTEXITCODE -ne $null) {
    exit $LASTEXITCODE
}