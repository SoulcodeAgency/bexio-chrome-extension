# Creates a package for the chrome extension
[CmdletBinding()]
Param (
    [switch]
    $CreatePackage,
    [switch]
    $IgnoreExtension,
    [switch]
    $IgnoreSidePanel,
    [switch]
    $Development
)

# Helper function to run a workspace build and fail loudly on a non-zero exit code.
# PowerShell does not throw on native-command failures, so a try/catch around `npm run`
# would never fire - $LASTEXITCODE has to be checked explicitly (same pattern as the
# RunScript helper in CreateRelease.ps1).
function RunBuild($workspace, $task, $label) {
    npm run $task -w $workspace
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED An error occurred while attempting to build $label" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host "OK $label successfully built" -ForegroundColor Green
}

# Refuse to package build output that is missing the files which make it an extension.
# A zip without them is still a *valid* zip, so neither Compress-Archive nor the Chrome
# Web Store upload would notice - a broken extension would just ship.
function AssertPackageContent() {
    $missing = @()
    if (-not (Test-Path -Path (Join-Path $packageDirectorySource "manifest.json"))) {
        $missing += "$source/manifest.json"
    }
    # Only checked when the side panel was actually built: -IgnoreSidePanel deliberately
    # produces a package without it.
    if (!$IgnoreSidePanel -and -not (Test-Path -Path (Join-Path $packageDirectorySource "sidePanel-import/index.html"))) {
        $missing += "$source/sidePanel-import/index.html"
    }
    if ($missing.Count -gt 0) {
        Write-Host "FAILED Refusing to package an incomplete build. Missing: $($missing -join ', ')" -ForegroundColor Red
        exit 1
    }
}

# variables
$source = "unpacked"
$dist = "dist"
$filename = "bexio-chrome-extension.zip"
$destinationFile = "$dist/$filename"
$packageDirectorySource = Join-Path $PWD.path $source
$packageDirectoryDestination = $PWD.path + "/$destinationFile"
if ($Development) {
    $buildTask = "build:dev"
}
else {
    $buildTask = "build"
}

# Build bexio chrome extension
if (!$IgnoreExtension) {
    RunBuild "@bexio-chrome-extension/chrome-extension" $buildTask "Bexio chrome extension"
}

# Build sidePanel import app
if (!$IgnoreSidePanel) {
    RunBuild "@bexio-chrome-extension/side-panel-import" $buildTask "sidePanel import app"
}

# build the package
if ($CreatePackage) {
    Write-Host ""
    Write-Host "Creating extension package..."
    AssertPackageContent

    try {
        # create dist folder
        if (-not(Test-Path -Path $dist)) {
            New-Item -ItemType Directory -Path $dist -Force -ErrorAction Stop
            Write-Host "OK Creating dist folder" -ForegroundColor Green
        }
        # zip folder
        Compress-Archive -Path $packageDirectorySource -DestinationPath $packageDirectoryDestination -Force -ErrorAction Stop
        Write-Host "OK Package built at: $packageDirectoryDestination" -ForegroundColor Green
        Write-Host ""
    }
    catch {
        Write-Host "FAILED to create the package: $_" -ForegroundColor Red
        exit 1
    }

    # Convenience for local (Windows) use only - a headless CI runner has no browser and
    # no file explorer, so these must never fail the build.
    # Open a specific webpage
    Start-Process "https://chrome.google.com/u/1/webstore/devconsole/7ec9c1b5-988c-4cef-84b5-50b85d0fb0d0/nbmjdligmcfaeebdihmgbdpahdfddlhm/edit/package?hl=de" -ErrorAction SilentlyContinue
    # Open explorer with the dist folder containing the package
    Invoke-Item -Path "./dist" -ErrorAction SilentlyContinue
}