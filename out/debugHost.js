module.exports.start = function (
    importContext,
    debugConfiguration,
    pathToMarkdown,
    rootPath,
    callbackFileNameContentFileName) {

    const encoding = "utf8";
    const Utf8BOM = "\ufeff";
    const formatProcessed = "Processed under debugger: \"%s\"";

    const standAlong = !importContext;

    function OnFirstProblemException(fileName, inner) {
        this.fileName = fileName;
        this.inner = inner;
        this.format = "%s";
        this.toString = function () { if (inner) return inner.toString(); else return ""; }
    } // OnFirstProblemException
    function QuitOnFirstPluginLoadFailureException(fileName, inner) {
        OnFirstProblemException.call(this, fileName, inner);
        this.format = "Failure to load plug-in: %s";
    }
    function QuitOnFirstPluginActivationFailureException(fileName, inner) {
        OnFirstProblemException.call(this, fileName, inner);
        this.format = "Failure to activate plug-in: %s";
    }
    function QuitOnFirstRenderingFailureException(fileName, inner) {
        OnFirstProblemException.call(this, fileName, inner);
        this.format = "Failure to render file: %s";
    }
    function logQuitException(ex) {
        if (ex.format && ex.fileName)
            console.error(importContext.util.format(ex.format, ex.fileName));
        if (ex.inner)
            console.error(ex.inner.toString());
    } //logQuitException

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

    (function () {
        let problems;
        try {
            usePlugins();
            if (debugConfiguration.testDataSet.length < 1) return;
            const renderingResult = renderAll();
            console.log("All input files rendered");
            showResults(renderingResult);
        } catch (ex) {
            problems = true;
            if ((ex.constructor === QuitOnFirstPluginLoadFailureException)
                || (ex.constructor === QuitOnFirstPluginActivationFailureException)
                || (ex.constructor == QuitOnFirstRenderingFailureException))
                logQuitException(ex);
            else
                console.error(ex.toString());
            if (!standAlong)
                importContext.vscode.window.showErrorMessage(
                    importContext.util.format("Markdown test failed. For more detail, run under the debugger. %s",
                        ex.toString()));
        } //exception
        if (problems)
            console.error("Debugging session complete with issues");
        else
            console.log("Debugging session complete");
    })();

    function usePlugins() {
        const plugins = debugConfiguration.plugins;
        for (let index in plugins) {
            if (!plugins[index].enabled) continue;
            try {
                const pluginPath = importContext.path.join(rootPath, plugins[index].path);
                let plugin;
                try {
                    delete require.cache[require.resolve(pluginPath)];
                    plugin = require(pluginPath);
                } catch (exInner) {
                    if (debugConfiguration.debugSessionOptions.quitOnFirstPluginLoadFailure)
                        throw new QuitOnFirstPluginLoadFailureException(plugins[index].path, exInner);
                    else {
                        console.error(exInner.toString());
                        continue;
                    } //if
                } //inner exception
                md.use(plugin, plugins[index].options);
            } catch (ex) {
                if (debugConfiguration.debugSessionOptions.quitOnFirstPluginActivationFailure)
                    throw new QuitOnFirstPluginActivationFailureException(plugins[index].path, ex);
                if (ex.constructor === QuitOnFirstPluginLoadFailureException)
                    throw ex;
                console.error(ex.toString());
            } //exception
        } //loop
    } //usePlugins

    function renderAll() {
        let lastFileName = undefined;
        let lastContent = undefined;
        let exceptionFileName;
        for (let index in debugConfiguration.testDataSet) {
            try {
                exceptionFileName = debugConfiguration.testDataSet[index];
                const inputFileName = importContext.path.join(rootPath, debugConfiguration.testDataSet[index]);
                const result = Utf8BOM + md.render(importContext.fs.readFileSync(inputFileName, encoding));
                lastContent = result;
                console.log(importContext.util.format("Rendering complete: %s", inputFileName));
                if (debugConfiguration.debugSessionOptions.saveHtmlFiles) {
                    const effectiveOutputPath = importContext.path.dirname(inputFileName);
                    const output = importContext.path.join(
                        effectiveOutputPath,
                        importContext.path.basename(inputFileName,
                            importContext.path.extname(inputFileName))) + ".html";
                    importContext.fs.writeFileSync(output, result);
                    console.log(importContext.util.format("Output written: %s", inputFileName));
                    lastFileName = output;
                } //if
            } catch (ex) {
                if (debugConfiguration.debugSessionOptions.quitOnFirstRenderingFailure)
                    throw new QuitOnFirstRenderingFailureException(exceptionFileName, ex);
            } //exception
        } //loop
        return { lastFileName: lastFileName, lastContent: lastContent };
    } //render

    function showResults(renderingResult) {
        if (standAlong) { // under the debugger
            if (!renderingResult.lastFileName)
                return;
            const callbackFileNames = {
                fileName: callbackFileNameContentFileName
            };
            if (renderingResult.lastFileName && debugConfiguration.debugSessionOptions.showLastHTML)
                importContext.fs.writeFileSync(callbackFileNames.fileName, renderingResult.lastFileName);
        } else { // without debugging
            if (!renderingResult.lastFileName && !renderingResult.lastContent) return;
            if (renderingResult.lastFileName) {
                if (importContext.fs.existsSync(renderingResult.lastFileName))
                    importContext.vscode.workspace.openTextDocument(renderingResult.lastFileName).then(function (doc) {
                        importContext.vscode.window.showTextDocument(doc);
                    });
            } else
                importContext.vscode.workspace.openTextDocument({ content: renderingResult.lastContent, language: "html" }).then(function (doc) {
                    importContext.vscode.window.showTextDocument(doc);
                });
        } //if
    } //showResults

}; //module.exports.debugHost
