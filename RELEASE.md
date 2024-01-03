# How to make a new release

## Automatically

Simply run the script `npm run createRelease`

## Manually

* Test current version
* Run npm script `version:minor` (or what you need) to increase version number
* Run npm script `build:newExtensionRelease`
* Tag the version this is needed to have the changelog created correctly
* Run npm script `changelog` to create the changelog
* Commit Everything as new release
* Merge `tagged commit` into `main`, fast forward to keep the tag on the commit
* Push all branches and make sure all is on same level
