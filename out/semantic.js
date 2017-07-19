"use strict";

module.exports.getTemplateSet = function (path, fs, encoding) {
    return {
        html: fs.readFileSync(path.join(__dirname, "/template-html.txt"), encoding),
        style: fs.readFileSync(path.join(__dirname + "/template-style.txt"), encoding),
        embeddedStyle: fs.readFileSync(path.join(__dirname + "/template-embedded-style.txt"), encoding),
        notFoundCss: fs.readFileSync(path.join(__dirname + "/template-not-found-css.txt"), encoding)
    }
}; //getTemplateSet

module.exports.getSettings = function (importContext) { // see package.json, "configuration":
    const thisExtensionSection =
        importContext.vscode.workspace.getConfiguration("markdown.extension.pluginDevelopment");
    const sharedSection = importContext.vscode.workspace.getConfiguration(importContext.markdownId);
    const settings = {
        debugConfigurationFileName: thisExtensionSection["debugConfigurationFileName"],
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
    if (!this.importContext)
        this.importContext = importContext;
    this.tmpDir = this.importContext.tmp.dirSync({ unsafeCleanup: true, prefix: "vscode.markdown-debugging-", postfix: ".tmp.js" });
    this.previewAuthority = "markdown-debug-preview";
    this.previewUri =
        this.importContext.vscode.Uri.parse(
            this.importContext.util.format(
                "%s://authority/%s", this.previewAuthority,
                this.previewAuthority));
    this.lastFiles = { content: undefined, fileName: undefined };
    this.lastContent = undefined;

    this.importContext.fs.watch(this.tmpDir.name, function (event, fileName) {
        if (!this.lastFiles.content) return;
        if (!this.lastFiles.fileName) return;
        if (fileName != path.basename(this.lastFiles.content) &&
            (fileName != path.basename(this.lastFiles.fileName)))
            return;
        if (!fs.existsSync(this.lastFiles.content)) return;
        if (!fs.existsSync(this.lastFiles.fileName)) return;
        const lastName = this.importContextfs.readFileSync(this.lastFiles.fileName, encoding);
        this.lastContent = this.importContextfs.readFileSync(this.lastFiles.content, encoding);
        this.lastFiles.content = null;
        this.lastFiles.fileName = null;
        this.importContextvscode.commands.executeCommand(
            "vscode.previewHtml",
            this.previewUri,
            this.importContextvscode.ViewColumn.One,
            this.importContext.util.format(formatProcessed, this.importContext.path.basename(lastName)));
    });
    return this;
} //module.exports.top
