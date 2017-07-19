"use strict";

exports.activate = function (context) {

    const encoding = "utf8";
    const Utf8BOM = "\ufeff";
    const defaultSmartQuotes = '“”' + "‘’";
    const formatProcessed = "Processed by plug-ins: \"%s\"";

    const vscode = require("vscode");
    const path = require("path");
    const fs = require("fs");
    const util = require("util");
    const semantic = require("./semantic");

    const jsonCommentStripper = require("./node_modules/strip-json-comments");
    const jsonFormatter = require("./node_modules/json-format");
    const tmp = require("./node_modules/tmp");

    const setWorspaceGlobal = (function () {
        console.assert(!vscode.workspace.hasOwnProperty("env"), "vscode.workspace.env property already exists");
        vscode.workspace.env = {};
        vscode.workspace.env.importContext = { vscode: vscode, util: util, fs: fs, path: path };
        vscode.workspace.env.tmpDir = tmp.dirSync({ unsafeCleanup: true, prefix: "vscode.markdown-debugging-", postfix: ".tmp.js" });
        vscode.workspace.env.previewAuthority = "markdown-debug-preview";
        vscode.workspace.env.previewUri =
            vscode.Uri.parse(util.format("%s://authority/%s", vscode.workspace.env.previewAuthority, vscode.workspace.env.previewAuthority));
        vscode.workspace.env.lastFiles = { content: undefined, fileName: undefined };
        vscode.workspace.env.lastContent = undefined;
        fs.watch(vscode.workspace.env.tmpDir.name, function (event, fileName) {
            if (!vscode.workspace.env.lastFiles.content) return;
            if (!vscode.workspace.env.lastFiles.fileName) return;
            if (fileName != path.basename(vscode.workspace.env.lastFiles.content) &&
                (fileName != path.basename(vscode.workspace.env.lastFiles.fileName)))
                return;
            if (!fs.existsSync(vscode.workspace.env.lastFiles.content)) return;
            if (!fs.existsSync(vscode.workspace.env.lastFiles.fileName)) return;
            const lastName = fs.readFileSync(vscode.workspace.env.lastFiles.fileName, encoding);
            vscode.workspace.env.lastContent = fs.readFileSync(vscode.workspace.env.lastFiles.content, encoding);
            vscode.workspace.env.lastFiles.content = null;
            vscode.workspace.env.lastFiles.fileName = null;
            vscode.commands.executeCommand(
                "vscode.previewHtml",
                vscode.workspace.env.previewUri,
                vscode.ViewColumn.One,
                util.format(formatProcessed, path.basename(lastName)));
        });
    }()); //setWorspaceGlobal

    const TextDocumentContentProvider = (function () {
        function TextDocumentContentProvider() {
            this.changeSourceHandler = new vscode.EventEmitter();
        } //TextDocumentContentProvider
        TextDocumentContentProvider.prototype.provideTextDocumentContent = function (uri) {
            if (vscode.workspace.env.lastContent)
                return vscode.workspace.env.lastContent;
            vscode.workspace.env.lastContent = null;
        }; //TextDocumentContentProvider.prototype.provideTextDocumentContent
        Object.defineProperty(TextDocumentContentProvider.prototype, "onDidChange", {
            get: function () { return this.changeSourceHandler.event; }, enumerable: true, configurable: true
        });
        TextDocumentContentProvider.prototype.update = function (uri) {
            this.changeSourceHandler.fire(uri);
        }; //TextDocumentContentProvider.prototype.update
        return TextDocumentContentProvider;
    }()); //TextDocumentContentProvider

    const getConfigurationFileName = function (rootPath) {
        if (!vscode.workspace.settings)
            vscode.workspace.settings = semantic.getSettings(vscode.workspace.env.importContext);
        const dirName = path.join(rootPath, ".vscode");
        try {
            fs.mkdirSync(dirName);
        } catch (ex) { }
        return path.join(dirName, vscode.workspace.settings.debugConfigurationFileName);
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
                showLastHTML: true
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

    const createMd = function (markdownPath, markdownItOptions, plugins) {
        const rootPath = vscode.workspace.rootPath;
        const constructor = require(markdownPath);
        const md = new constructor();
        markdownItOptions.xhtmlOut = true; //absolutely required default
        md.set(markdownItOptions);
        for (let index in plugins) {
            const plugin = plugins[index];
            if (!plugin.enabled) continue;
            try {
                const pluginPath = path.join(rootPath, plugin.path);
                const plugin = require(pluginPath);
                md.use(plugin, plugin.options);
            } catch (ex) {
                errors.push(ex.toString());
            } //exception
        } //loop
        return md;
    }; //createMd

    const templateSet = semantic.getTemplateSet(path, fs, encoding);

    const getMdPath = function () {
        const extension = vscode.extensions.getExtension("Microsoft.vscode-markdown");
        if (!extension) return;
        const extensionPath = path.join(extension.extensionPath, "node_modules");
        return path.join(extensionPath, "markdown-it");
    }; //getMdPath

    const readConfiguration = function () {
        const fileName = getConfigurationFileName(vscode.workspace.rootPath);
        if (!fs.existsSync(fileName)) {
            generateConfiguration();
            vscode.window.showInformationMessage("Edit debug configuration file and start debugger again. File names are relative to workspace.");
            return;
        } //if
        const json = fs.readFileSync(fileName, encoding);
        return JSON.parse(jsonCommentStripper(json));
    }; //readConfiguration

    const startWithoutDebugging = function () {
        const debugHost = require("./debugHost");
        debugHost.start(
            vscode.workspace.env.importContext,
            readConfiguration(),
            getMdPath(),
            vscode.workspace.rootPath
        );
    }; //startWithoutDebugging

    const startDebugging = function () {
        const pathToMd = semantic.unifyFileString(semantic.unifyFileString(getMdPath()));
        if (!pathToMd) return;
        const rootPath = semantic.unifyFileString(vscode.workspace.rootPath);
        const debugConfiguration = readConfiguration();
        if (!debugConfiguration) return;
        const debugConfigurationString = JSON.stringify(semantic.normalizeConfigurationPaths(debugConfiguration));
        const dirName = semantic.unifyFileString(vscode.workspace.env.tmpDir.name);
        const htmlFileName = semantic.unifyFileString(path.join(dirName, "last.html"));
        const lastFileFileName = semantic.unifyFileString(path.join(dirName, "lastFileName.txt"));
        const hostPath = semantic.unifyFileString(path.join(__dirname, "debugHost"));
        let code = util.format("const host = require(\"%s\");\n", hostPath);
        code += util.format("host.start(\n\tnull, \n\t'%s', \n\t\"%s\", \n\t\"%s\", \n\t\"%s\", \n\t\"%s\");",
            debugConfigurationString, pathToMd, rootPath, htmlFileName, lastFileFileName);
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
        vscode.workspace.env.lastFiles.content = htmlFileName;
        vscode.workspace.env.lastFiles.fileName = lastFileFileName;
    }; //startDebugging

    vscode.workspace.onDidChangeConfiguration(function (e) {
        vscode.workspace.settings = undefined;
    }); //vscode.workspace.onDidChangeConfiguration

    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(
            vscode.workspace.env.previewAuthority,
            new TextDocumentContentProvider()));

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
    if (vscode.workspace.env.tmpDir)
        vscode.workspace.env.tmpDir.removeCallback();
}; //exports.deactivate