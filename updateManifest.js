const fs = require("fs-extra");
const manifestFile = "./bexio-chrome-extension/public/manifest.json";

// Read the package.json file
const package = require("./package.json");

// Read the manifest.json file
const manifest = fs.readFileSync(manifestFile, "utf8");

// Update the version in the manifest.json file
const updatedManifest = manifest.replace(
  /"version": ".*?"/g,
  `"version": "${package.version}"`
);

// Write the updated manifest.json file
fs.writeFileSync(manifestFile, updatedManifest, "utf8");

console.log("Manifest version updated successfully!");
