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

# Function to run the version update script based on user input
function RunVersionUpdate {
    param (
        [string]$versionType
    )

    switch ($versionType) {
        "patch" { RunScript "version:patch" }
        "minor" { RunScript "version:minor" }
        "major" { RunScript "version:major" }
        default { Write-Output "Invalid option. Please choose patch, minor, or major." }
    }
}

# Print message to be sure that user is on the correct branch
Write-Output "Make sure you are on the develop branch before running this script!"
Write-Output "If you are on a feature branch, this is fine too, but you need to update the develop branch after the release is done."
Write-Output "You are on branch: $(git branch --show-current)"

# Prompt the user to choose the version type
$versionType = Read-Host "Enter the version type to increase (patch, minor, major)"

# Run the corresponding version update script
RunVersionUpdate -versionType $versionType

# Interrupt the script and await user for confirmation
Write-Output "Generated version number is: $(GetPackageVersion)"
Read-Host -Prompt "Press Enter to continue"

RunScript "build:newExtensionRelease"

# Get new version number
$version = GetPackageVersion

# Run the changelog script
npx --no-install git-cliff --tag $version > CHANGELOG.md # we give the hint to the new version

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