module.exports.start = function (
    importContext,
    debugConfiguration,
    pathToMarkdown,
    rootPath,
    callbackFileNameContentFileName) {

    const encoding = "utf8";
    const Utf8BOM = "\ufeff";
    const formatProcessed = "Processed under debugger: \"%s\"";
    const isString = function (o) { return typeof o == typeof ""; };

    const standAlong = !importContext;

    if (!importContext)
        importContext = {
            path: require("path"),
            fs: require("fs"),
            util: require("util")
        }

    if (standAlong)
        debugConfiguration = JSON.parse(debugConfiguration);

    const constructor = require(pathToMarkdown);
    const md = new constructor();
    debugConfiguration.markdownItOptions.xhtmlOut = true;
    md.set(debugConfiguration.markdownItOptions);

    const plugins = debugConfiguration.plugins;

    for (let index in plugins) {
        if (!plugins[index].enabled) continue;
        try {
            const pluginPath = importContext.path.join(rootPath, plugins[index].path);
            const plugin = require(pluginPath);
            md.use(plugin, plugins[index].options);
        } catch (ex) {
            console.error(ex.toString());
        } //exception
    } //loop

    if (debugConfiguration.testDataSet.length < 1) return;

    let lastfileName = undefined;

    for (let index in debugConfiguration.testDataSet) {
        const inputFileName = importContext.path.join(rootPath, debugConfiguration.testDataSet[index]);
        let result = md.render(importContext.fs.readFileSync(inputFileName, encoding));
        console.log(importContext.util.format("Rendering complete: %s", inputFileName));
        if (debugConfiguration.debugSessionOptions.saveHtmlFiles) {
            const effectiveOutputPath = importContext.path.dirname(inputFileName);
            result = Utf8BOM + result;
            const output = importContext.path.join(
                effectiveOutputPath,
                importContext.path.basename(inputFileName,
                    importContext.path.extname(inputFileName))) + ".html";
            importContext.fs.writeFileSync(output, result);
            console.log(importContext.util.format("Output written: %s", inputFileName));
            lastfileName = output;
        } //if
    } //loop

    console.log("All input files rendered");

    if (!lastfileName)
        for (let index in debugConfiguration.testDataSet)
            lastfileName = importContext.path.join(rootPath, debugConfiguration.testDataSet[index]);
    if (!lastfileName) return;
    if (!debugConfiguration.debugSessionOptions.showLastHTML) return;

    if (standAlong) { // under the debugger
        const callbackFileNames = {
            fileName: callbackFileNameContentFileName
        };
        if (lastfileName && debugConfiguration.debugSessionOptions.showLastHTML)
            importContext.fs.writeFileSync(callbackFileNames.fileName, lastfileName);
    } else { // without debugging
        if (importContext.fs.existsSync(lastfileName))
            importContext.vscode.workspace.openTextDocument(lastfileName, { preserveFocus: true }).then(function (doc) {
                importContext.vscode.window.showTextDocument(doc);
            });
    } //if

    if (standAlong)
        console.log("Debugging complete");

}; //module.exports.debugHost
