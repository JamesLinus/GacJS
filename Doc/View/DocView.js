
Packages.Define("Doc.View", ["Class", "Doc.SymbolTree", "IO.Resource", "IO.Delay"], function (__injection__) {
    eval(__injection__);

    /********************************************************************************
    Views
    ********************************************************************************/

    var DocRenderType = Enum(PQN("DocRenderType"), {
        Detailed: 0,
        ClassMember: 1,
        FunctionParameter: 2,
    });

    var viewType = null;
    var viewTemplate = null;
    var viewTypedef = null;
    var viewVar = null;
    var viewFunction = null;

    function RenderType(type, continuation) {
        var model = { type: type, continuation: continuation };
        return viewType(model);
    }

    function RenderTemplate(symbol) {
        var model = { symbol: symbol };
        return viewTemplate(model);
    }

    function RenderSymbol(renderType, symbol) {
        var model = { renderType: renderType, symbol: symbol };

        if (ClassDecl.TestType(symbol)) {
            throw new Error("Rending symbol of type \"" + symbol.__Type.FullName + "\" is not implemented.");
        }
        else if (VarDecl.TestType(symbol)) {
            return viewVar(model);
        }
        else if (FuncDecl.TestType(symbol)) {
            return viewFunction(model);
        }
        else if (EnumDecl.TestType(symbol)) {
            throw new Error("Rending symbol of type \"" + symbol.__Type.FullName + "\" is not implemented.");
        }
        else if (TypedefDecl.TestType(symbol)) {
            return viewTypedef(model);
        }
        else {
            throw new Error("Cannot render symbol of type \"" + symbol.__Type.FullName + "\".");
        }
    }

    /********************************************************************************
    CancelAndRunAfterDocViewReady
    ********************************************************************************/

    var taskSucceeded = null;
    var taskFailed = null;
    var taskReady = false;
    var taskPreparing = false;

    function RunTask(succeeded) {
        if (succeeded) {
            if (taskSucceeded !== null) {
                taskSucceeded();
            }
        }
        else {
            if (taskFailed !== null) {
                taskFailed();
            }
        }

        taskSucceeded = null;
        taskFailed = null;
    }

    function PrepareDocView() {
        if (taskPreparing === false) {
            taskPreparing === true;

            var asyncType = GetResourceAsync("./Doc/View/Type.razor.html", true);
            var asyncTemplate = GetResourceAsync("./Doc/View/Template.razor.html", true);
            var asyncTypedef = GetResourceAsync("./Doc/View/Typedef.razor.html", true);
            var asyncVar = GetResourceAsync("./Doc/View/Var.razor.html", true);
            var asyncFunction = GetResourceAsync("./Doc/View/Function.razor.html", true);

            var asyncTasks = [asyncType, asyncTemplate, asyncTypedef, asyncVar, asyncFunction];
            WaitAll(asyncTasks).Then(function (result) {
                for (var i = 0; i < result.length; i++) {
                    if (DelayException.TestType(result[i])) {
                        taskPreparing = false;
                        RunTask(false);
                        return;
                    }
                }

                viewType = result[0].Razor;
                viewTemplate = result[1].Razor;
                viewTypedef = result[2].Razor;
                viewVar = result[3].Razor;
                viewFunction = result[4].Razor;

                taskReady = true;
                taskPreparing = false;
                RunTask(true);
            });
        }
    }

    function CancelAndRunAfterDocViewReady(succeeded, failed) {
        taskSucceeded = succeeded;
        taskFailed = failed;

        if (taskReady) {
            RunTask(true);
        }
        else if (!taskPreparing) {
            PrepareDocView();
        }
    }

    /********************************************************************************
    Package
    ********************************************************************************/

    return {
        DocRenderType: DocRenderType,
        RenderType: RenderType,
        RenderTemplate: RenderTemplate,
        RenderSymbol: RenderSymbol,
        CancelAndRunAfterDocViewReady: CancelAndRunAfterDocViewReady,
    }
});