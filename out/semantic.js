"use strict";

const formatProcessed = "Processed by plug-ins: \"%s\"";

module.exports.getSettings = function (importContext) { // see package.json, "configuration":
    const selfExtensionSection =
        importContext.vscode.workspace.getConfiguration("markdown.extension.pluginDevelopment");
    const sharedSection = importContext.vscode.workspace.getConfiguration(importContext.markdownId);
    const settings = {
        debugConfigurationFileName: selfExtensionSection["debugConfigurationFileName"],
        css: sharedSection["styles"],
    } //settings
    return settings;
}; //getSettings

module.exports.unifyFileString = function (s) { return s.replace(/\\/g, '/'); }

module.exports.normalizeConfigurationPaths = function (configuration) {
    if (configuration.plugins)
        for (let index in configuration.plugins)
            if (configuration.plugins[index].path)
                configuration.plugins[index].path = module.exports.unifyFileString(configuration.plugins[index].path);
    if (configuration.testDataSet)
        for (let index in configuration.testDataSet)
            if (configuration.testDataSet[index])
                configuration.testDataSet[index] = module.exports.unifyFileString(configuration.testDataSet[index]);
    return configuration;
}; //module.exports.normalizeConfigurationPaths

module.exports.top = function (importContext) {
    if (this.importContext) return this;
    this.importContext = importContext;
    this.settings = undefined;
    this.configuration = undefined;
    const self = this;
    this.importContext.vscode.workspace.onDidChangeConfiguration(function (e) {
        self.settings = undefined;
        self.configuration = undefined;
    });
    this.importContext.vscode.workspace.onDidSaveTextDocument(function (e) {
        self.settings = undefined;
        self.configuration = undefined;
    });
    this.tmpDir = this.importContext.tmp.dirSync({ unsafeCleanup: true, prefix: "vscode.markdown-debugging-", postfix: ".tmp.js" });
    this.previewAuthority = "markdown-debug-preview";
    this.previewUri =
        this.importContext.vscode.Uri.parse(
            this.importContext.util.format(
                "%s://authority/%s", this.previewAuthority,
                this.previewAuthority));
    this.lastFiles = { content: undefined, fileName: undefined };
    this.importContext.fs.watch(this.tmpDir.name, function (event, fileName) {
        if (!self.lastFiles.content) return;
        if (!self.lastFiles.fileName) return;
        if (fileName != self.importContext.path.basename(self.lastFiles.content) &&
            (fileName != self.importContext.path.basename(self.lastFiles.fileName)))
            return;
        if (!self.importContext.fs.existsSync(self.lastFiles.content)) return;
        if (!self.importContext.fs.existsSync(self.lastFiles.fileName)) return;
        const lastName = self.importContext.fs.readFileSync(self.lastFiles.fileName, self.importContext.encoding);
        self.lastFiles.content = null;
        self.lastFiles.fileName = null;
        const fullPath = self.importContext.path.join(self.importContext.vscode.workspace.rootPath, lastName);
        if (self.importContext.fs.existsSync(fullPath))
            self.importContext.vscode.workspace.openTextDocument(fullPath, { preserveFocus: true }).then(function (doc) {
                self.importContext.vscode.window.showTextDocument(doc);
            });
    });
    return this;
} //module.exports.top
