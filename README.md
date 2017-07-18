# Markdown-it Plug-in Development Framework

[![Latest Release](https://vsmarketplacebadge.apphb.com/version/sakryukov.markdown-it-plugin-development-framework.svg)](https://marketplace.visualstudio.com/items?itemName=sakryukov.markdown-it-plugin-development-framework)

This is a Visual Studio Code *extension* used to facilitate development, testing and debugging of the node.js packages playing the role of [markdown-it](https://www.npmjs.com/package/markdown-it) plug-ins.

## Usage

The developer provides one or more plug-in packages and a set of markdown documents used as a data set for testing/debugging. The environment picks up those items in a current workspace and suggests a configuration file which can be modified by the developer. It defines the markdown-it options, a chain of plug-ins to be used in a given order, with options for each plug-in. This defines the scenario of testing/debugging, which can be executed under the debugger or without debugging. On output, the execution generates a set of HTML files (optional), and show a preview of generated file (optional).

## Settings

There is only one relevant option in settings, the name of the workspace-level configuration file: "markdown.extension.pluginDevelopment.debugConfigurationFileName". All other settings are defined by this file.


