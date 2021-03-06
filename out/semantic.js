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

module.exports.clearDebugConsole = function(importContext) {
    importContext.vscode.commands.executeCommand("workbench.debug.panel.action.clearReplAction");
}; //module.exports.clearDebugConsole

module.exports.unifyFileString = function (s) { return s.replace(/\\/g, '/'); };

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
    this.tmpDir = this.importContext.tmp.dirSync({ unsafeCleanup: true, prefix: "vscode.markdown-debugging-" });
    this.lastFileName = undefined;
    this.importContext.fs.watch(this.tmpDir.name, function (event, fileName) {
        if (!self.lastFileName) return;
        if (fileName != self.importContext.path.basename(self.lastFileName))
            return;
        if (!self.importContext.fs.existsSync(self.lastFileName)) return;
        const lastName = self.importContext.fs.readFileSync(self.lastFileName, self.importContext.encoding);
        self.lastFileName = null;
        if (self.importContext.fs.existsSync(lastName))
            self.importContext.vscode.workspace.openTextDocument(lastName).then(function (doc) {
                self.importContext.vscode.window.showTextDocument(doc);
            });
    });
    return this;
} //module.exports.top
