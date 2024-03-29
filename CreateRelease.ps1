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

# Print message to be sure that user is on the correct branch
Write-Output "Make sure you are on the develop branch before running this script!"
Write-Output "If you are on a feature branch, this is fine too, but you need to update the develop branch after the release is done."
Write-Output "You are on branch: $(git branch --show-current)"

# Run the build and version scripts
RunScript "version:minor"

# Interrupt the script and await user for confirmation
Write-Output "Generated version number is: $(GetPackageVersion)"
Read-Host -Prompt "Press Enter to continue"

RunScript "build:newExtensionRelease"

# Get new version number
$version = GetPackageVersion

# Run the changelog script
npx git-cliff@latest --tag $version > CHANGELOG.md # we give the hint to the new version

# Commit and tag the version
git add .

Read-Host -Prompt "Press Enter to commit changes and create tag version $version"
git commit -m "Release: $version"
git tag $version

# Merge the tagged commit into main
Read-Host -Prompt "Press Enter to merge to main and push"
git checkout main
git merge $version

# Push all branches
git push --all

# Checkout the develop branch
git checkout develop