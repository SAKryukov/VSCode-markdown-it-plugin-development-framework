"use strict";

exports.activate = function (context) {

    const encoding = "utf8";
    const Utf8BOM = "\ufeff";
    const defaultSmartQuotes = '""' + "''";

    const vscode = require("vscode");
    const path = require("path");
    const fs = require("fs");
    const semantic = require("./semantic");

    const util = require("util");
    const jsonCommentStripper = require("./node_modules/strip-json-comments");
    const jsonFormatter = require("./node_modules/json-format");
    const tmp = require("./node_modules/tmp");

    const previewAuthority = "markdown-debug-preview";
    const previewUri =
        vscode.Uri.parse(util.format("%s://authority/%s", previewAuthority, previewAuthority));

    const TextDocumentContentProvider = (function () {
        function TextDocumentContentProvider() {
            this.changeSourceHandler = new vscode.EventEmitter();
        } //TextDocumentContentProvider
        TextDocumentContentProvider.prototype.provideTextDocumentContent = function (uri) {
            if (vscode.workspace.lastContent)
                return vscode.workspace.lastContent;
        }; //TextDocumentContentProvider.prototype.provideTextDocumentContent
        Object.defineProperty(TextDocumentContentProvider.prototype, "onDidChange", {
            get: function () { return this.changeSourceHandler.event; }, enumerable: true, configurable: true
        });
        TextDocumentContentProvider.prototype.update = function (uri) {
            this.changeSourceHandler.fire(uri);
        }; //TextDocumentContentProvider.prototype.update
        return TextDocumentContentProvider;
    }()); //TextDocumentContentProvider
    const provider = new TextDocumentContentProvider();
    const registration = vscode.workspace.registerTextDocumentContentProvider(previewAuthority, provider);

    const getConfigurationFileName = function (rootPath) {
        return path.join(rootPath, ".vscode", "markdown-it-debugging.settings.json");
    }; //getConfigurationFileName

    const defaultConfiguration = {
        markdownItOptions: {
            html: true,
            linkify: false,
            breaks: false,
            typographer: true,
            quotes: defaultSmartQuotes
        },
        plugins: [],
        testDataSet: [],
        debugSessionOptions: {
            saveHtmlFiles: true,
            showLastHTML: true,
            createErrorLog: true,
            errorLogFile: "errors.log",
            showErrorLog: true
        }
    }; //defaultConfiguration

    const collectFiles = function (action) {
        const rootPath = vscode.workspace.rootPath;
        vscode.workspace.findFiles("**/*.md").then(function (markdownFiles) {
            vscode.workspace.findFiles("**/package.json").then(function (packageFiles) {
                const markdownDocuments = [];
                const plugins = [];
                for (let index = 0; index < markdownFiles.length; ++index)
                    markdownDocuments.push(
                        path.relative(rootPath, markdownFiles[index].fsPath));
                for (let index = 0; index < packageFiles.length; ++index)
                    plugins.push({
                        path: path.relative(rootPath, path.dirname(packageFiles[index].fsPath)),
                        options: {}
                    });
                action(markdownDocuments, plugins);
            });
        });
    }; //collectFiles

    const generateConfiguration = function () {
        const rootPath = vscode.workspace.rootPath;
        if (!rootPath) {
            vscode.window.showWarningMessage("Markdown debugging requires open folder and workspace");
            return;
        } //if
        const configuration = defaultConfiguration;
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
        const errors = []; //SA???
        const constructor = require(markdownPath);
        const md = new constructor();
        markdownItOptions.xhtmlOut = true; //absolutely required default
        md.set(markdownItOptions);
        for (let index in plugins)
            try {
                const pluginPath = path.join(rootPath, plugins[index].path);
                const plugin = require(pluginPath);
                md.use(plugin, plugins[index].options);
            } catch (ex) {
                errors.push(ex.toString());
            } //exception
        return md;
    }; //createMd

    const htmlTemplateSet = semantic.getHtmlTemplateSet(path, fs, encoding);
    const runMd = function (md, debugConfiguration) {
        vscode.workspace.lastContent = undefined;
        const rootPath = vscode.workspace.rootPath;
        let lastFileName;
        for (let index in debugConfiguration.testDataSet) {
            const inputFileName = path.join(rootPath, debugConfiguration.testDataSet[index]);
            let result = md.render(fs.readFileSync(inputFileName, encoding));
            console.log(result);
            if (debugConfiguration.debugSessionOptions.saveHtmlFiles) {
                // const effectiveOutputPath = outputPath ?
                //     path.join(vscode.workspace.rootPath, outputPath) : path.dirname(fileName);
                const effectiveOutputPath = path.dirname(inputFileName);
                result = Utf8BOM + result;
                const output = path.join(
                    effectiveOutputPath,
                    path.basename(inputFileName,
                        path.extname(inputFileName))) + ".html";
                fs.writeFileSync(output, result);
                lastFileName = inputFileName;
                vscode.workspace.lastContent = result;
            } //if
        } //loop
        if (debugConfiguration.testDataSet.length < 1) return;
        if (!lastFileName)
            for (let index in debugConfiguration.testDataSet)
                lastFileName = path.join(rootPath, debugConfiguration.testDataSet[index]);
        if (lastFileName && debugConfiguration.debugSessionOptions.showLastHTML) {
            vscode.commands.executeCommand(
                "vscode.previewHtml",
                previewUri,
                vscode.ViewColumn.One,
                util.format("Preview \"%s\"", path.basename(lastFileName)));
        } //if        
    }; //runMd

    const getMdPath = function() {
        const extension = vscode.extensions.getExtension("Microsoft.vscode-markdown");
        if (!extension) return;
        const extensionPath = path.join(extension.extensionPath, "node_modules");
        return path.join(extensionPath, "markdown-it");
    }; //getMdPath

    const readConfiguration = function() {
        const fileName = getConfigurationFileName(vscode.workspace.rootPath);
        if (!fs.existsSync(fileName)) {
            generateConfiguration();
            vscode.window.showInformationMessage("Edit debug configuration file and start debugger again. File names are relative to workspace.");
            return;
        } //if
        const json = fs.readFileSync(fileName, encoding);
        return JSON.parse(jsonCommentStripper(json));
    }; //readConfiguration

    const startWithoutDebugging = function (starter) {
        const pathToMd = getMdPath();
        if (!pathToMd) return;
        const debugConfiguration = readConfiguration();
        const md = createMd(pathToMd, debugConfiguration.markdownItOptions, debugConfiguration.plugins);
        runMd(md, debugConfiguration);
    }; //startWithoutDebugging

    const startDebugging = function () {
        const pathToMd = getMdPath().replace(/\\/g, '/');
        if (!pathToMd) return;
        const rootPath = vscode.workspace.rootPath;
        const launchConfiguration = {
            type: "node2",
            protocol: "auto",
            request: "launch",
            name: "Launch Extension",
            program: "${file}",
            stopOnEntry: false
        };
        const debugConfiguration = readConfiguration();
        const debugConfigurationString = jsonFormatter(
                debugConfiguration,
                { type: "space", size: 2 }); 
        let code = "console.log(\"Start:\");\n\n";
        code += "const path = require(\"path\");\n";
        code += "const fs = require(\"fs\");\n\n";
        code += util.format("const debugConfiguration = %s;\n\n", debugConfigurationString);
        code += util.format("const constructor = require(\"%s\");\n", pathToMd);
        code += "const md = new constructor();\n";
        code += "debugConfiguration.xhtmlOut = true;\n\n";
        code += util.format("const rootPath = \"%s\"\n\n", rootPath).replace(/\\/g, '/');
        code += "const plugins = debugConfiguration.plugins;\n";
        code += "for (let index in plugins)\n";
        code += "    try {\n";
        code += "        const pluginPath = path.join(rootPath, plugins[index].path);\n";
        code += "        const plugin = require(pluginPath);\n";
        code += "        md.use(plugin, plugins[index].options);\n";
        code += "    } catch (ex) {\n";
        code += "        console.log(ex.toString());\n";
        code += "    } //exception\n\n";
        code += "for (let index in debugConfiguration.testDataSet) {\n";
        code += "    const inputFileName = path.join(rootPath, debugConfiguration.testDataSet[index]);\n";
        code += "    let result = md.render(fs.readFileSync(inputFileName, 'utf8'));\n";
        code += "}\n\n";
        code += "console.log(\"1\");\n\nconsole.log(\"2\");\n\nconsole.log(\"3\");\n\nconsole.log(\"4\");\n\n";
        code += "console.log(\"Debugging complete\")\n\n";
        if (!vscode.workspace.tmpDir)
            vscode.workspace.tmpDir = tmp.dirSync({ prefix: "vscode.markdown-debugging-", postfix: "tmp.js"});
        const dirName = vscode.workspace.tmpDir.name;
        launchConfiguration.program = path.join(dirName, "driver.js");
        fs.writeFileSync(launchConfiguration.program, code);
        vscode.commands.executeCommand("vscode.startDebug", launchConfiguration);
    }; //startDebugging

    context.subscriptions.push(
        vscode.commands.registerCommand("markdown.pluginDevelopment.startWithoutDebugging", function () {
            startWithoutDebugging();
        }));

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
    if (vscode.workspace.tmpDir)
        vscode.workspace.tmpDir.removeCallback();
}; //exports.deactivate