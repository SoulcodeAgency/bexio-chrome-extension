# PowerShell

# Helper function to run a script and handle errors
function RunScript($script) {
    Write-Output "Running npm script: $script"
    npm run $script
    if ($LASTEXITCODE -ne 0) {
        Write-Output "Error running script: $script"
        exit $LASTEXITCODE
    }
}

function GetPackageVersion() {
    # Get the version using npm
    $versionLine = npm run env | Select-String -Pattern 'npm_package_version' -SimpleMatch

    # Split the line at the equals sign and select the second part
    $version = $versionLine.ToString().Split('=')[1]

    # Return the version
    return $version
}

# Run the build and version scripts
RunScript "build:newExtensionRelease"
RunScript "version:minor"

# Get new version number
$version = GetPackageVersion

# Run the changelog script
npx git-cliff@latest --tag $version > CHANGELOG.md # we give the hint to the new version

# Commit and tag the version
git add .
git commit -m "Release: $version"
git tag $version

# Merge the tagged commit into main
git checkout main
git merge $version

# Push all branches
git push --all