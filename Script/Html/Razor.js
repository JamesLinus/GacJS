/*
API:
    CompileRazor(razor)
        returns a function with a parameter "model", which will return the compiled HTML from the razor template.
*/
Packages.Define("Html.Razor", ["Class", "Html.RazorHelper"], function (__injection__) {
    eval(__injection__);

    /********************************************************************************
    RazorReIndent
    ********************************************************************************/

    function RazorReIndent(text) {
        var result = "";
        var lines = text.split("\n");
        var indent = undefined;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var firstChar = line.search(/[^\s]/);
            if (firstChar !== -1) {
                if (indent === undefined) {
                    indent = firstChar;
                }
                result += line.substring(indent, firstChar.length).replace(/\s*$/, "") + "\r\n";
            }
        }
        return result;
    }

    /********************************************************************************
    Razor Configurations
    ********************************************************************************/

    var regexOption = /^@(\w+)\s+(\w+)$/;
    var regexCode = /^@\{$/;
    var regexStatement = /^@((for|while|if|switch)\s*\(.*\)|(do|try))\s*\{$/;
    var regexStatementContinue = /^((else\s+if|catch)\s*\(.*\)|(else))\s*\{$/;
    var regexStatementInCode = /^((for|while|if|switch|else\s+if|catch)\s*\(.*\)|(do|try|else))\s*\{$/;
    var regexCommand = /^@(break|continue|throw(\s+.*)?|var\s+.*);$/;
    var regexFunction = /^@function\s+(\w+)\s*\(\s*(?:(\w+)(?:,\s*(\w+))*)?\s*\)\s*\{$/;
    var regexNormalCode = /^[a-zA-Z0-9_$.]$/;
    var regexExpressionEnd = /^[a-zA-Z0-9_$}"')\]/]$/;

    /********************************************************************************
    RazorBodyToJs
    ********************************************************************************/

    function RegexSwitch(text, branches) {
        for (var branch in branches) {
            if (branch !== "") {
                var regex = eval("regex" + branch);
                var match = regex.exec(text);
                if (match !== null) {
                    return branches[branch](match);
                }
            }
        }

        var defaultBranch = branches[""];
        if (defaultBranch !== undefined) {
            return defaultBranch();
        }
    }

    function IsVoidTag(tag) {
        return tag === "area" ||
            tag === "base" ||
            tag === "br" ||
            tag === "col" ||
            tag === "command" ||
            tag === "embed" ||
            tag === "hr" ||
            tag === "img" ||
            tag === "input" ||
            tag === "keygen" ||
            tag === "link" ||
            tag === "meta" ||
            tag === "param" ||
            tag === "source" ||
            tag === "track" ||
            tag === "wbr";
    }

    function RazorBodyToJs(indent, lines) {

        ////////////////////////////////////////////////////////////////////////

        var indentCounter = 0;
        var tags = [];
        var result = "";

        function AppendCode(code) {
            result += indent;
            for (var i = 0; i < indentCounter; i++) {
                result += "    ";
            }
            result += code + "\n";
        }

        function PrintHtml(text) {
            AppendCode("$printer.PrintHtml(" + JSON.stringify(text) + ");");
        }

        function PrintText(text) {
            AppendCode("$printer.PrintText(" + JSON.stringify(text) + ");");
        }

        function PrintExpr(expr) {
            AppendCode("$printer.PrintValue(" + expr + ");");
        }

        function PrintStat(stat) {
            AppendCode(stat);
        }

        function PushStatement() {
            tags.push(null);
        }

        function PopStatement() {
            if (tags.length === 0 || tags[tags.length - 1] !== null) {
                throw new Error("Razor syntax error: cannot close a JavaScript statement here.");
            }
            tags.splice(tags.length - 1, 1);
        }

        function PushTag(tag) {
            tags.push(tag);
        }

        function PopTag(tag, line) {
            if (tags.length === 0 || tags[tags.length - 1] !== tag) {
                throw new Error("Razor syntax error: cannot close HTML tag \"" + tag + "\" here: \"" + line + "\".");
            }
            tags.splice(tags.length - 1, 1);
        }

        function InCode() {
            return tags.length > 0 && tags[tags.length - 1] === null;
        }

        ////////////////////////////////////////////////////////////////////////

        function InterpretHtmlFragment(html) {
            PrintHtml(html);
        }

        ////////////////////////////////////////////////////////////////////////

        function InterpretHtmlLine(html) {
            var reading = 0;
            while (reading < html.length) {
                var atSign = html.indexOf("@", reading);
                if (atSign === -1) {
                    InterpretHtmlFragment(html.substring(reading, html.length));
                    return;
                }
                else if (atSign > reading) {
                    InterpretHtmlFragment(html.substring(reading, atSign));
                }

                if (atSign === html.length - 1) {
                    throw new Error("Razor syntax error: unexpected end of JavaScript expression: \"" + html + "\".");
                }

                var stopAtRightBracket = html[atSign + 1] === "(";
                var codeBegin = atSign + (stopAtRightBracket ? 2 : 1);
                var codeEnd = -1;

                var InExpr = 0;
                var InString = 1;
                var InRegex = 2;

                var exprCounter = (stopAtRightBracket ? 1 : 0);
                var arrayCounter = 0;
                var state = InExpr;

                for (var i = codeBegin; i < html.length && codeEnd === -1; i++) {
                    switch (state) {
                        case InExpr:
                            switch (html[i]) {
                                case "\"":
                                    state = InString;
                                    break;
                                case "/":
                                    if (i === html.length - 1) {
                                        throw new Error("Razor syntax error: unexpected end of JavaScript expression: \"" + html + "\".");
                                    }
                                    else if (html[i + 1] === "/") {
                                        throw new Error("Razor syntax error: cannot use JavaScript comment here: \"" + html + "\".");
                                    }

                                    var j = i - 1;
                                    while (html[j] === " " || html[j] === "\t") {
                                        j--;
                                    }
                                    if (regexExpressionEnd.exec(html[j]) === null) {
                                        state = InRegex;
                                    }
                                    else if (exprCounter === 0 && arrayCounter === 0) {
                                        codeEnd = i;
                                    }
                                    break;
                                case "[":
                                    arrayCounter++;
                                    break;
                                case "]":
                                    if (arrayCounter === 0) {
                                        if (exprCounter === 0) {
                                            codeEnd = i;
                                            break;
                                        }
                                        else {
                                            throw new Error("Razor syntax error: unmatched \"]\" found: \"" + html + "\".");
                                        }
                                    }
                                    arrayCounter--;
                                    break;
                                case "(":
                                    exprCounter++;
                                    break;
                                case ")":
                                    if (exprCounter === 0) {
                                        if (arrayCounter === 0) {
                                            codeEnd = i;
                                            break;
                                        }
                                        else {
                                            throw new Error("Razor syntax error: unmatched \")\" found: \"" + html + "\".");
                                        }
                                    }
                                    exprCounter--;
                                    if (exprCounter === 0 && stopAtRightBracket) {
                                        codeEnd = i;
                                        break;
                                    }
                                    break;
                                default:
                                    if (exprCounter === 0 && arrayCounter === 0) {
                                        if (regexNormalCode.exec(html[i]) === null) {
                                            codeEnd = i;
                                            break;
                                        }
                                    }
                            }
                            break;
                        case InString:
                            switch (html[i]) {
                                case "\"":
                                    state = InExpr;
                                    break;
                                case "\\":
                                    if (i === html.length - 1) {
                                        throw new Error("Razor syntax error: unexpected end of JavaScript expression: \"" + html + "\".");
                                    }
                                    i++;
                                    break;
                            }
                            break;
                        case InRegex:
                            switch (html[i]) {
                                case "/":
                                    state = InExpr;
                                    break;
                                case "\\":
                                    if (i === html.length - 1) {
                                        throw new Error("Razor syntax error: unexpected end of JavaScript expression: \"" + html + "\".");
                                    }
                                    i++;
                                    break;
                            }
                            break;
                    }
                }

                if (codeEnd === -1) {
                    if (exprCounter === 0 && arrayCounter === 0) {
                        codeEnd = html.length;
                    }
                    else {
                        throw new Error("Razor syntax error: unexpected end of JavaScript expression: \"" + html + "\".");
                    }
                }

                while (html[codeEnd - 1] === ".") {
                    codeEnd--;
                }

                if (codeBegin === codeEnd) {
                    if (stopAtRightBracket) {
                        PrintText("@()");
                    }
                    else {
                        PrintText("@");
                    }
                }
                else {
                    PrintExpr(html.substring(codeBegin, codeEnd));
                }
                reading = codeEnd + (stopAtRightBracket ? 1 : 0);
            }
        }

        ////////////////////////////////////////////////////////////////////////

        var lastPoppedStatementIndex = -1;

        AppendCode("var $printer = new RazorPrinter();");

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (InCode()) {
                RegexSwitch(line, {
                    StatementInCode: function (matches) {
                        PrintStat(line);
                        PushStatement();
                        indentCounter++;
                    },
                    "": function () {
                        if (line === "}") {
                            lastPoppedStatementIndex = i;
                            indentCounter--;
                            poppedStat = PopStatement();
                            PrintStat("}");
                        }
                        else if (line.length >= 2 && line.substring(0, 2) === "@:") {
                            InterpretHtmlLine(line.substring(2, line.length));
                        }
                        else if (line.length >= 1 && line[0] === "<") {
                            InterpretHtmlLine(line);
                        }
                        else {
                            PrintStat(line);
                        }
                    }
                });
            }
            else {
                RegexSwitch(line, {
                    Statement: function (matches) {
                        PrintStat(line.substring(1, line.length));
                        PushStatement();
                        indentCounter++;
                    },
                    Command: function (matches) {
                        PrintStat(line.substring(1, line.length));
                    },
                    StatementContinue: function (matches) {
                        if (i === lastPoppedStatementIndex + 1) {
                            PrintStat(line);
                            PushStatement();
                            indentCounter++;
                        }
                        else {
                            InterpretHtmlLine(line);
                        }
                    },
                    "": function () {
                        InterpretHtmlLine(line);
                    }
                });
            }
        }

        AppendCode("return new RazorHtml($printer.Text);");
        return result;
    }

    /********************************************************************************
    RazorToJs
    ********************************************************************************/

    function RazorToJs(razor) {
        var packages = ["Html.RazorHelper"];
        var model = null;
        var codes = [];
        var body = [];
        var functions = [];

        var InBody = 0;
        var InCode = 1;
        var InFunction = 2;
        var InFunctionBody = 3;

        var state = InBody;
        var statementCounter = 0;

        var lines = razor.split("\n");
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].replace(/^\s*/, "").replace(/\s*$/, "");
            if (line !== "") {
                RegexSwitch(line, {
                    Option: function (matches) {
                        if (state !== InBody) {
                            throw new Error("Razor syntax error: option cannot appear in code block or functions: \"" + line + "\".");
                        }
                        switch (matches[1]) {
                            case "package":
                                packages.push(matches[2]);
                                break;
                            case "model":
                                if (model === null) {
                                    model = matches[2];
                                }
                                else {
                                    throw new Error("Razor syntax error: option \"@model\" can only appear once: \"" + line + "\".");
                                }
                                break;
                            default:
                                throw new Error("Razor syntax error: unknown option: \"" + line + "\".");
                        }
                    },
                    Code: function (matches) {
                        if (state !== InBody) {
                            throw new Error("Razor syntax error: code block cannot appear in code block or functions: \"" + line + "\".");
                        }
                        state = InCode;
                    },
                    Function: function (matches) {
                        if (state !== InBody) {
                            throw new Error("Razor syntax error: code block cannot appear in code block or functions: \"" + line + "\".");
                        }
                        state = InFunction;

                        var func = { name: matches[1], parameters: [], body: [] };
                        for (var j = 2; j < matches.length; j++) {
                            var parameter = matches[j];
                            if (parameter !== undefined) {
                                func.parameters.push(parameter);
                            }
                        }
                        functions.push(func);
                    },
                    Statement: function (matches) {
                        switch (state) {
                            case InBody:
                                body.push(line);
                                break;
                            case InFunction:
                                statementCounter++;
                                functions[functions.length - 1].body.push(line);
                                break;
                            default:
                                throw new Error("Razor syntax error: illegal JavaScript statement: \"" + line + "\".");
                        }
                    },
                    "": function () {
                        switch (state) {
                            case InBody:
                                body.push(line);
                                break;
                            case InCode:
                                if (line[line.length - 1] === "{") {
                                    statementCounter++;
                                }
                                if (line === "}") {
                                    if (statementCounter === 0) {
                                        state = InBody;
                                        return;
                                    }
                                    else {
                                        statementCounter--;
                                    }
                                }
                                codes.push(lines[i]);
                                break;
                            case InFunction:
                                if (line === "}") {
                                    if (statementCounter === 0) {
                                        state = InBody;
                                        return;
                                    }
                                    else {
                                        statementCounter--;
                                    }
                                }
                                functions[functions.length - 1].body.push(line);
                                break;
                        }
                    }
                });
            }
        }

        var result = "";
        result += "(function () {\n";
        result += "    eval(Packages.Inject([" + packages.map(JSON.stringify).join(", ") + "]));\n";
        result += "\n";
        result += "    return function (model) {\n";
        if (model !== null) {
            result += "        " + model + ".RequireType(model);\n";
        }

        result += codes.map(function (code) { return "    " + code; }).join("\n");
        result += "\n";

        for (var i = 0; i < functions.length; i++) {
            var func = functions[i];
            result += "        function " + func.name + "(" + func.parameters.join(", ") + ") {\n";
            result += RazorBodyToJs("            ", func.body);
            result += "        }\n";
            result += "\n";
        }

        result += RazorBodyToJs("        ", body);
        result += "    }\n";
        result += "}())\n";
        return result;
    }

    /********************************************************************************
    CompileRazor
    ********************************************************************************/

    function CompileRazor(razor) {
        return eval(RazorToJs(razor));
    }

    /********************************************************************************
    Package
    ********************************************************************************/

    return {
        RazorReIndent: RazorReIndent,
        RazorToJs: RazorToJs,
        CompileRazor: CompileRazor,
    }
});

Packages.Define("Html.RazorHelper", ["Class"], function (__injection__) {
    eval(__injection__);

    function FQN(name) {
        return "<Html.RazorHelper>::" + name;
    }

    /********************************************************************************
    RazorHtml
    ********************************************************************************/

    var RazorHtml = Class(FQN("RazorHtml"), {
        rawHtml: Protected(null),

        GetRawHtml: Public.StrongTyped(__String, [], function () {
            return this.rawHtml;
        }),
        RawHtml: Public.Property({ readonly: true }),

        __Constructor: Public.StrongTyped(__Void, [__String], function (rawHtml) {
            this.rawHtml = rawHtml;
        }),
    });

    /********************************************************************************
    RazorPrinter
    ********************************************************************************/

    var razorPrinterDiv = document.createElement("div");

    var RazorPrinter = Class(FQN("RazorPrinter"), {
        text: Protected(""),

        GetText: Public.StrongTyped(__String, [], function () {
            return this.text;
        }),
        Text: Public.Property({ readonly: true }),

        __Constructor: Public.StrongTyped(__Void, [], function () {
        }),

        PrintHtml: Public(function (html) {
            this.text += html;
        }),

        PrintText: Public(function (text) {
            razorPrinterDiv.appendChild(document.createTextNode(text));
            this.text += razorPrinterDiv.innerHTML;
            razorPrinterDiv.innerHTML = "";
        }),

        PrintValue: Public.Overload(
            [RazorHtml], function (html) {
                this.PrintHtml(html.RawHtml);
            },
            [__Object], function (text) {
                this.PrintText(text);
            }
            ),
    });

    /********************************************************************************
    Package
    ********************************************************************************/

    return {
        RazorHtml: RazorHtml,
        RazorPrinter: RazorPrinter,
    }
});