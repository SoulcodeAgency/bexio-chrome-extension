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

# Helper function to run a git command and handle errors.
# Takes the arguments as an array, e.g. RunGit @("commit", "-m", "Release: $version").
function RunGit($arguments) {
    Write-Output "Running git: $($arguments -join ' ')"
    & git @arguments
    if ($LASTEXITCODE -ne 0) {
        Write-Output "Error running git: $($arguments -join ' ')"
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

# Run the changelog script.
# Use git-cliff's -o flag instead of a `>` redirect: under Windows PowerShell 5.1 `>` writes
# UTF-16LE with a BOM, which corrupts CHANGELOG.md and breaks release-please's append.
npx --no-install git-cliff --tag $version -o CHANGELOG.md # we give the hint to the new version
if ($LASTEXITCODE -ne 0) {
    Write-Output "Error generating CHANGELOG.md with git-cliff"
    exit $LASTEXITCODE
}

# Update version in manifest.json and .release-please-manifest.json
RunScript "version:updateManifest"

# Commit and tag the version
RunGit @("add", ".")

Read-Host -Prompt "Press Enter to commit changes and create tag version $version"
RunGit @("commit", "-m", "Release: $version")
RunGit @("tag", $version)

# Merge the tagged commit into main.
# --ff-only: main also receives squash merges (release-please, Dependabot), so a merge that
# isn't a fast-forward means the branches have diverged and needs to be resolved by hand.
Read-Host -Prompt "Press Enter to merge to main and push"
RunGit @("checkout", "main")
RunGit @("merge", "--ff-only", $version)

# Push all branches, plus the release tag.
# The tag is pushed explicitly because `git tag` above creates a lightweight tag and
# `--follow-tags` only pushes annotated ones.
RunGit @("push", "--all")
RunGit @("push", "origin", "refs/tags/$version")

# Checkout the develop branch
RunGit @("checkout", "develop")