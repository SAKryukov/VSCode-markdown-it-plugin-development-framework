"use strict";

exports.activate = function (context) {

    const encoding = "utf8";
    const Utf8BOM = "\ufeff";
    const defaultSmartQuotes = '“”' + "‘’";

    const vscode = require("vscode");
    const path = require("path");
    const fs = require("fs");
    const util = require("util");
    const semantic = require("./semantic");

    const jsonCommentStripper = require("./node_modules/strip-json-comments");
    const jsonFormatter = require("./node_modules/json-format");
    const tmp = require("./node_modules/tmp");

    semantic.top({ vscode: vscode, util: util, fs: fs, path: path, tmp: tmp, encoding: encoding });

    const getConfigurationFileName = function (rootPath) {
        if (!semantic.top().settings)
            semantic.top().settings = semantic.getSettings(semantic.top().importContext);
        const dirName = path.join(rootPath, ".vscode");
        try {
            fs.mkdirSync(dirName);
        } catch (ex) { }
        return path.join(dirName, semantic.top().settings.debugConfigurationFileName);
    }; //getConfigurationFileName

    const collectFiles = function (action) {
        const rootPath = vscode.workspace.rootPath;
        vscode.workspace.findFiles("**/*.md").then(function (markdownFiles) {
            vscode.workspace.findFiles("**/package.json").then(function (packageFiles) {
                const markdownDocuments = [];
                const plugins = [];
                for (let index = 0; index < markdownFiles.length; ++index)
                    markdownDocuments.push(
                        semantic.unifyFileString(path.relative(rootPath, markdownFiles[index].fsPath)));
                for (let index = 0; index < packageFiles.length; ++index)
                    plugins.push({
                        enabled: true,
                        path: semantic.unifyFileString(path.relative(rootPath, path.dirname(packageFiles[index].fsPath))),
                        options: {}
                    });
                action(markdownDocuments, plugins);
            });
        });
    }; //collectFiles

    const generateConfiguration = function () {
        const configuration = {
            markdownItOptions: {
                html: true,
                linkify: false,
                breaks: false,
                typographer: true,
                quotes: defaultSmartQuotes
            },
            plugins: [
                // {
                //     "enabled": true,
                //     "path": "plugins/plugin", // the direcotory where package.json is
                //     "options": {}
                // },  //...
            ],
            testDataSet: [],
            debugSessionOptions: {
                saveHtmlFiles: true,
                showLastHTML: true,
                quitOnFirstPluginLoadFailure: false,
                quitOnFirstPluginActivationFailure: false,
                quitOnFirstRenderingFailure: true
            }
        }; //defaultConfiguration
        const rootPath = vscode.workspace.rootPath;
        if (!rootPath) {
            vscode.window.showWarningMessage("Markdown debugging requires open folder and workspace");
            return;
        } //if
        configuration.plugins = [];
        configuration.testDataSet = [];
        collectFiles(function (markdownFiles, plugins) {
            configuration.plugins = plugins;
            configuration.testDataSet = markdownFiles;
            const fileName = getConfigurationFileName(rootPath);
            fs.writeFileSync(fileName, jsonFormatter(
                configuration,
                { type: "space", size: 4 }),
                function (err) {
                    vscode.window.showErrorMessage(err.toString());
                });
            vscode.workspace.openTextDocument(fileName, { preserveFocus: true }).then(function (doc) {
                vscode.window.showTextDocument(doc);
            });
            if (configuration.plugins.length < 1)
                vscode.window.showWarningMessage("Create at least one plug-in and try again. Plug-in is recognized by the file \"package.json\".");
            if (configuration.testDataSet.length < 1)
                vscode.window.showWarningMessage("Create at least one Markdown document (.md) and try again");
        });
    }; //generateConfiguration

    const getMdPath = function () {
        const extension = vscode.extensions.getExtension("Microsoft.vscode-markdown");
        if (!extension) return;
        const extensionPath = path.join(extension.extensionPath, "node_modules");
        return semantic.unifyFileString(path.join(extensionPath, "markdown-it"));
    }; //getMdPath

    const readConfiguration = function () {
        if (semantic.top().configuration)
            return semantic.top().configuration;
        const fileName = getConfigurationFileName(vscode.workspace.rootPath);
        if (!fs.existsSync(fileName)) {
            generateConfiguration();
            vscode.window.showInformationMessage("Edit debug configuration file and start debugger again. File names are relative to workspace.");
            return;
        } //if
        const json = fs.readFileSync(fileName, encoding);
        try {
            semantic.top().configuration = semantic.normalizeConfigurationPaths(JSON.parse(jsonCommentStripper(json)));
            return semantic.top().configuration;
        } catch (ex) {
            vscode.window.showInformationMessage(util.format("Failed configuration parsing: %s", fileName));
        } //exception
    }; //readConfiguration

    const testConfiguration = function (configuration, rootPath) {
        if (!configuration)
            return configuration;
        if (!rootPath)
            rootPath = vscode.workspace.rootPath;
        for (let index in configuration.plugins) {
            const plugin = configuration.plugins[index];
            if (!plugin.enabled) continue;
            const pluginPath = plugin.path;
            if (!fs.existsSync(path.join(rootPath, pluginPath))) {
                vscode.window.showWarningMessage(util.format("Module \"%s\" not found", pluginPath));
            } else {
                const relativeModulePath = path.join(pluginPath, "package.json");
                const modulePath = path.join(rootPath, relativeModulePath);
                if (!fs.existsSync(modulePath))
                    vscode.window.showWarningMessage(
                        util.format("Module package \"%s\" not found", relativeModulePath));
            } //of
        } //loop plug-ins
        for (let index in configuration.testDataSet) {
            if (!fs.existsSync(path.join(rootPath, configuration.testDataSet[index])))
                vscode.window.showWarningMessage(
                    util.format("Test Markdown file \"%s\" not found", configuration.testDataSet[index]));
        } //loop testDataSet
        return configuration;
    } //testConfiguration

    const startWithoutDebugging = function () {
        const debugConfiguration = testConfiguration(readConfiguration());
        if (!debugConfiguration) return;
        const debugHost = require("./debugHost");
        semantic.top().importContext.top = semantic.top();
        debugHost.start(
            semantic.top().importContext,
            debugConfiguration,
            getMdPath(),
            vscode.workspace.rootPath
        );
    }; //startWithoutDebugging

    const startDebugging = function () {



        return;
        const pathToMd = getMdPath();
        if (!pathToMd) return;
        const rootPath = semantic.unifyFileString(vscode.workspace.rootPath);
        const debugConfiguration = testConfiguration(readConfiguration(), rootPath);
        if (!debugConfiguration) return;
        semantic.clearDebugConsole(semantic.top().importContext);
        const debugConfigurationString = JSON.stringify(debugConfiguration);
        const dirName = semantic.unifyFileString(semantic.top().tmpDir.name);
        const lastFileFileName = semantic.unifyFileString(path.join(dirName, "lastFileName.txt"));
        const hostPath = semantic.unifyFileString(path.join(__dirname, "debugHost"));
        let code = util.format("const host = require(\"%s\");\n", hostPath);
        code += util.format("host.start(\n\tnull, \n\t'%s', \n\t\"%s\", \n\t\"%s\", \n\t\"%s\");",
            debugConfigurationString, pathToMd, rootPath, lastFileFileName);
        const launchConfiguration = {
            type: "node2", // a real confusion! found by tracing Visual Studio Code
            name: "Launch Extension",
            request: "launch",
            stopOnEntry: false,
            protocol: "auto"
        };
        const programName = path.join(dirName, "driver.js");
        launchConfiguration.program = programName;
        fs.writeFileSync(launchConfiguration.program, code);
        vscode.commands.executeCommand("vscode.startDebug", launchConfiguration);
        // preview:
        if (!debugConfiguration.debugSessionOptions.showLastHTML) return;
        semantic.top().lastFileName = lastFileFileName;
    }; //startDebugging

    context.subscriptions.push(
        vscode.commands.registerCommand("markdown.pluginDevelopment.startWithoutDebugging", function () {
            startWithoutDebugging();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("markdown.pluginDevelopment.startDebugging", function () {
            startDebugging();
        }));
    context.subscriptions.push(
        vscode.commands.registerCommand("markdown.pluginDevelopment.generateDebugConfiguration", function () {
            generateConfiguration();
        }));

}; //exports.activate

exports.deactivate = function deactivate() {
    if (semantic.top().tmpDir)
        semantic.top().tmpDir.removeCallback();
}; //exports.deactivate