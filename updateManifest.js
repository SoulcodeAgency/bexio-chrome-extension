import fs from "fs-extra";
// Read the package.json file
const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf8"));

const manifestFile = "./packages/chrome-extension/public/manifest.json";
const packageJsonFile = "./package.json";
const releasePleaseManifestFile = "./.release-please-manifest.json";

// Read the manifest.json file
const manifest = fs.readFileSync(manifestFile, "utf8");

// Update the version in the manifest.json file
const updatedManifest = manifest.replace(/"version": ".*?"/g, `"version": "${packageJson.version}"`);

// Write the updated manifest.json file
fs.writeFileSync(manifestFile, updatedManifest, "utf8");

console.log("Manifest version updated successfully!");

// Keep release-please's version tracker in sync. release-please runs in manifest mode
// (.github/workflows/release-please.yml), so it derives the next version from this file,
// not from the git tags. Leaving it stale after a manual release makes the next Release PR
// propose an already-released version, which the Chrome Web Store rejects with
// PKG_INVALID_VERSION_NUMBER.
if (fs.existsSync(releasePleaseManifestFile)) {
  const releasePleaseManifest = fs.readFileSync(releasePleaseManifestFile, "utf8");

  // Regex-replace (like the manifest.json update above) to keep the file's formatting intact.
  const updatedReleasePleaseManifest = releasePleaseManifest.replace(
    /("\."\s*:\s*)".*?"/,
    `$1"${packageJson.version}"`
  );

  fs.writeFileSync(releasePleaseManifestFile, updatedReleasePleaseManifest, "utf8");

  console.log("release-please manifest version updated successfully!");
} else {
  console.warn(`Skipped: ${releasePleaseManifestFile} not found.`);
}

// Update date in package.json
const packageJsonContent = fs.readFileSync(packageJsonFile, "utf8");
const updatedPackageJson = packageJsonContent.replace(
  /"date": ".*?"/g,
  `"date": "${new Date().toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}"`
);

// Write the updated manifest.json file
fs.writeFileSync(packageJsonFile, updatedPackageJson, "utf8");

console.log("package.json date updated successfully!");
