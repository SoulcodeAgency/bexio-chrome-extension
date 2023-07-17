# Creates a package for the chrome extension
[CmdletBinding()]
Param (
    [switch]
    $CreatePackage,
    [switch]
    $IgnoreExtension,
    [switch]
    $IgnoreSidePanel
)

# variables
$source = "unpacked"
$dist = "dist"
$filename = "bexio-chrome-extension.zip"
$destinationFile = "$dist/$filename"
$packageDirectorySource = Join-Path $PWD.path $source
$packageDirectoryDestination = $PWD.path + "/$destinationFile"

# Build bexio chrome extension
if (!$IgnoreExtension) {
    try {
        Push-Location .\bexio-chrome-extension
        npm run build
        Write-Host "OK Bexio chrome extension successfully built" -ForegroundColor Green
    }
    catch {
        Write-Host "An error occurred while attempting to build bexio-chrome-extension" -ForegroundColor Red
    }
    finally {
        Pop-Location
    }
}

# Build sidePanel import app
if (!$IgnoreSidePanel) {
    try {
        Push-Location .\sidePanel-import
        npm run build
        Write-Host "OK sidePanel import app successfully built" -ForegroundColor Green
    }
    catch {
        Write-Host "An error occurred while attempting to build sidePanel import app" -ForegroundColor Red
    }
    finally {
        Pop-Location
    }
}

# build the package
if ($CreatePackage) {
    Write-Host ""
    Write-Host "Creating package..."
    try {
        # create dist folder
        if (-not(Test-Path -Path $dist)) {
            New-Item -ItemType Directory -Path $dist -Force
            Write-Host "OK Creating dist folder" -ForegroundColor Green
        }
        # zip folder
        Compress-Archive -Path $packageDirectorySource -DestinationPath $packageDirectoryDestination -Force
        Write-Host "OK Package built at: $packageDirectoryDestination" -ForegroundColor Green
        Write-Host ""
    }
    catch {
        Write-Host "FAILED " -ForegroundColor Red
    }
}