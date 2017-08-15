# Changelog

## Version 4.0.0

* Versions prior to 4.*.* are deprecated, because they use deprecated way of node.js starting debugging (temporary API). New version uses `vscode.debug.startDebugging` introduced with VSCode 1.15.0. Older versions of this extension still work with VSCode 1.15.0, but may appear defunct with later VSCode versions.

* Functionally, this version is equivalent to Version 3.0.1, which can be used with VSCode versions 1.14.*.

## Version 3.0.1

* Improved handling of HTML rendering results and logs

## Version 3.0.0

* Fixed critical bug: "Start Markdown Plug-in Without Debugging" command did not respond to changed plug-in code because of caching. Cache is now deleted before loading of the plug-in module.

## Version 2.0.2

* Bug fix for the case debugSessionOptions.quitOnFirstRenderingFailure

## Version 2.0.0

* Instead of HTML preview, HTML source is shown (optional)
* Added clean-up of the debug console before running the scenario under the debugger
* Added new configuration options: debugSessionOptions.quitOnFirst*Failure
* More detailed error diagnostics
* Stability fixes

## Version 1.0.0

* First production release

## Version 0.5.0

* Fixed repository URL
* Plug-ins "enabled" is taken into account
* Fixed title of preview
* Preview of the debugged output implemented

## Version 0.4.0

* Restored creation of files under the debugger and removal of temporary directory

## Version 0.3.0

* Fixed the problem when there is no .vscode directory when debugging is started

## Version 0.2.0

* Fixed the problem when there is no debugging configuration when debugging is started

## Version 0.1.0

* Pre-release to Visual Studio Marketplace

## Version 0.0.1

* Initial release
