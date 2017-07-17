"use strict";

exports.activate = function (context) {

    const encoding = "utf8";
    const Utf8BOM = "\ufeff";

    const vscode = require('vscode');
    const path = require('path');
    const fs = require('fs');

    const util = require('util');
    const jsonCommentStripper = require("./node_modules/strip-json-comments");
    const jsonFormatter = require("./node_modules/json-format");
    const markdownId = "markdown";
    const jsId = "javascript";

    const getConfigurationFileName = function (rootPath) {
        return path.join(rootPath, ".vscode", "markdown-it-debugging.settings.json");
    }; //getConfigurationFileName

    const defaultConfiguration = {
        markDownItOptions: {},
        plugins: [],
        testDataSet: [],
        options: {
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
                { type: 'space', size: 4 }),
                function (err) {
                    vscode.window.showErrorMessage(err.toString());
                });
            vscode.workspace.openTextDocument(fileName, { preserveFocus: true }).then(function (doc) {
                vscode.window.showTextDocument(doc);
            });
        });
    }; //generateConfiguration

    const createMd = function (markDownPath, markdownItOptions, plugins) {
        const rootPath = vscode.workspace.rootPath;
        const errors = []; //SA???
        const constructor = require(markDownPath);
        let md = new constructor();
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

    const runMd = function (md, debugConfiguration) {
        const rootPath = vscode.workspace.rootPath;
        for (let index in debugConfiguration.testDataSet) {
            const inputFileName = path.join(rootPath, debugConfiguration.testDataSet[index]);
            let result = md.render(fs.readFileSync(inputFileName, encoding));
            console.log(result);
            if (debugConfiguration.options.saveHtmlFiles) {
                // const effectiveOutputPath = outputPath ?
                //     path.join(vscode.workspace.rootPath, outputPath) : path.dirname(fileName);
                const effectiveOutputPath = path.dirname(inputFileName);
                result = Utf8BOM + result;
                const output = path.join(
                    effectiveOutputPath,
                    path.basename(inputFileName,
                        path.extname(inputFileName))) + ".html";
                fs.writeFileSync(output, result);
            } //if
        } //loop
    }; //runMd

    const startDebugging = function (starter) {
        const extension = vscode.extensions.getExtension("Microsoft.vscode-markdown");
        if (!extension) return;
        const fileName = getConfigurationFileName(vscode.workspace.rootPath);
        if (!fs.existsSync(fileName)) {
            vscode.window.showInformationMessage("Edit debug configuration file and start debugger again. File names are relative to workspace.");
            generateConfiguration();
            return;
        } //if
        const json = fs.readFileSync(fileName, encoding);
        const debugConfiguration = JSON.parse(jsonCommentStripper(json));
        const extensionPath = path.join(extension.extensionPath, "node_modules");
        const pathToMd = path.join(extensionPath, "markdown-it");
        const md = createMd(pathToMd, debugConfiguration.markdownItOptions, debugConfiguration.plugins);
        runMd(md, debugConfiguration);
    }; //startDebugging

    context.subscriptions.push(
        vscode.commands.registerCommand("markdown.pluginDevelopment.start", function () {
            startDebugging();
        }));

    context.subscriptions.push(
        vscode.commands.registerCommand("markdown.pluginDevelopment.generateDebugConfiguration", function () {
            generateConfiguration();
        }));

}; //exports.activate

exports.deactivate = function deactivate() { }