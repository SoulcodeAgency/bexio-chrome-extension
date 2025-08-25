import fs from "fs-extra";
// Read the package.json file
const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf8"));

const manifestFile = "./packages/chrome-extension/public/manifest.json";
const packageJsonFile = "./package.json";

// Read the manifest.json file
const manifest = fs.readFileSync(manifestFile, "utf8");

// Update the version in the manifest.json file
const updatedManifest = manifest.replace(/"version": ".*?"/g, `"version": "${packageJson.version}"`);

// Write the updated manifest.json file
fs.writeFileSync(manifestFile, updatedManifest, "utf8");

console.log("Manifest version updated successfully!");

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
