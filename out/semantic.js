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
