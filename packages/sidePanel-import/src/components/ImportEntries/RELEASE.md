# How to make a release

* Test current version
* Run npm script `build:newExtensionRelease`
* Run npm script `version:minor` (or what you need) to increase version number
* Tag the version (TODO: automate this), this is needed to have the changelog created correctly
* Run npm script `changelog` to create the changelog
* Commit Everything as new release (probably amend) to get into the same commit as before
* Merge `tagged commit` into `master`, fast forward to keep the tag on the commit
* Push all branches and make sure all is on same level
