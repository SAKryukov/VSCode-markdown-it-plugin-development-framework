# Markdown-it Plug-in Development Framework

[![Latest Release](https://vsmarketplacebadge.apphb.com/version/sakryukov.markdown-it-plugin-development-framework.svg)](https://marketplace.visualstudio.com/items?itemName=sakryukov.markdown-it-plugin-development-framework)

This is a Visual Studio Code *extension* used to facilitate development, testing and debugging of the node.js packages playing the role of [markdown-it](https://www.npmjs.com/package/markdown-it) plug-ins.

## Usage

The developer provides one or more plug-in packages and a set of markdown documents used as a data set for testing/debugging. The environment picks up those items from current workspace workspace and suggests a configuration file which can be modified by the developer. It defines the markdown-it options, a chain of plug-ins to be used in a given order, with options for each plug-in. This defines the scenario of testing/debugging, which can be executed under the debugger or without debugging. On output, the execution generates a set of HTML files (optional), and show a generated HTML file (optional).

## Settings

There is only one relevant option in settings, the name of the workspace-level configuration file: "`markdown.extension.pluginDevelopment.debugConfigurationFileName`". Default value is "markdown-it-debugging.settings.json". All other settings are defined by this file.

Here is a self-explaining example of "markdown-it-debugging.settings":

```
{
    "markdownItOptions": {
        "html": true,
        "linkify": false,
        "breaks": false,
        "typographer": true,
        "quotes": "“”‘’" // if typographer is enabled
    },
    "plugins": [ // used in given order:
        {
            "enabled":  true,
            "path": "plugins/p1"
        },
        {
            // "enabled": true, comments are fine: disabled
            "path": "plugins/p2"
        },
        {
            "enabled": true,
            // not found files will be ignored,
            // with warning
            "path": "who-knows-what"
        },
        {
            "enabled": true,
            "path": "plugins/moreAdvanced",
            "options": { // introduce plug-in options:
                "tocRegexPattern": "\\\\[\\\\]\\\\(\\\\(toc)]\\\\", 
                // depending on heading level:
                "listElementClasses": [ "special", "chapter" ],
                "listElementTypes": [ "ul", "ul", "ol" ],
                "listItemPrefixes": [ "", "&mdash; " ]
            }
        }        
    ],
    "testDataSet": [
        //"secondSample.md", // disabled
        "sample.md"
    ],
    "debugSessionOptions": {
        "saveHtmlFiles": true,
        "showLastHTML": true // if saveHtmlFiles is enabled
        "quitOnFirstPluginLoadFailure": false,
        "quitOnFirstPluginActivationFailure": false,
        "quitOnFirstRenderingFailure": true
    }
}
```

File names are relative to current VSCode *workspace*. To re-create this file based on the files found in the current workspace, delete this file and invoke one of the "Start Markdown plug-in*" commands or the "Create Markdown Extension Debug Configuration" command found in context menus of Explorer, editor or editor title of any of the open files.