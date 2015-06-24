Packages.Define("Doc.TreeView", ["Class", "IO.Resource", "Doc.Document"], function (__injection__) {
    eval(__injection__);

    function Text(text) {
        return document.createTextNode(text);
    }

    function Dom(type, parent) {
        var node = document.createElement(type);
        if (parent) {
            parent.appendChild(node);
        }
        return node;
    }

    /********************************************************************************
    TreeNodeContainer
    ********************************************************************************/

    var TreeNodeContainer = Class(PQN("TreeNodeContainer"), function () {
        return {
            element: Private(null),
            children: Private(null),

            GetElement: Private(function () { return this.element; }),
            Element: Public.Property({ readonly: true }),

            GetVisible: Private(function () {
                return this.element.classList.contains("Expanded");
            }),
            SetVisible: Private.StrongTyped(__Void, [__Boolean], function (value) {
                this.element.classList.remove("Expanded");
                this.element.classList.remove("Collapsed");
                if (value) {
                    this.element.classList.add("Expanded");
                }
                else {
                    this.element.classList.add("Collapsed");
                }
            }),
            Visible: Public.Property({}),

            __Constructor: Public.StrongTyped(__Void, [__Boolean, __Object], function (visible, parent) {
                this.element = Dom("ul", parent);
                this.element.doc_Owner = this.__ExternalReference;
                this.element.classList.add("TreeNodeContainer");
                this.Visible = visible;
                this.children = [];
            }),

            AddTreeNode: Public.StrongTyped(__Void, [TreeNode], function (treeNode) {
                if (this.children.indexOf(treeNode) === -1) {
                    this.children.push(treeNode);
                    this.element.appendChild(treeNode.Element);
                }
            }),
        }
    });

    /********************************************************************************
    TreeNode
    ********************************************************************************/

    var TreeNode = Class(PQN("TreeNode"), function () {
        return {
            parent: Private(null),

            element: Private(null),
            titleElement: Private(null),
            decoratorElement: Private(null),
            postfixElement: Private(null),

            nodeContainer: Private(null),
            expanded: Private(false),
            title: Private(""),
            postfix: Private(""),

            decoratorElement_OnClick: Private(function () {
                this.Expanded = !this.Expanded;
            }),

            GetParent: Private(function () { return this.parent; }),
            doc_SetParent: Public.StrongTyped(__Void, [TreeNode], function (value) {
                this.parent = value;
            }),
            Parent: Public.Property({ readonly: true }),

            GetElement: Private(function () { return this.element; }),
            Element: Public.Property({ readonly: true }),

            GetTitle: Private(function () { return this.title; }),
            SetTitle: Private.StrongTyped(__Void, [__String], function (value) {
                this.title = value;
                this.titleElement.firstChild.textContent = value;
            }),
            Title: Public.Property({}),

            GetPostfix: Private(function () { return this.postfix; }),
            SetPostfix: Private.StrongTyped(__Void, [__String], function (value) {
                this.postfix = value;
                this.postfixElement.firstChild.textContent = value;
            }),
            Postfix: Public.Property({}),

            GetHasDoc: Private(function () {
                return this.titleElement.classList.contains("HasDoc");
            }),
            SetHasDoc: Private.StrongTyped(__Void, [__Boolean], function (value) {
                if (value) {
                    return this.titleElement.classList.add("HasDoc");
                }
                else {
                    return this.titleElement.classList.remove("HasDoc");
                }
            }),
            HasDoc: Public.Property({}),

            GetExpanded: Private(function () { return this.expanded; }),
            SetExpanded: Private.StrongTyped(__Void, [__Boolean], function (value) {
                if (this.nodeContainer !== null && this.expanded !== value) {
                    this.expanded = value;
                    if (value) {
                        this.decoratorElement.firstChild.nodeValue = "[-]";
                    }
                    else {
                        this.decoratorElement.firstChild.nodeValue = "[+]";
                    }
                    this.nodeContainer.Visible = value;
                    this.ExpandedChanged.Execute(this.__ExternalReference);
                }
            }),
            Expanded: Public.Property({}),
            ExpandedChanged: Public.Event(),

            __Constructor: Public.StrongTyped(__Void, [__Boolean], function (hasChild) {
                var self = this;

                this.element = Dom("li");

                this.decoratorElement = Dom("div", this.element);
                this.decoratorElement.setAttribute("class", "TreeNodeDecorator");
                if (hasChild) {
                    this.decoratorElement.appendChild(Text("[+]"));
                    this.decoratorElement.addEventListener("click", function () {
                        self.decoratorElement_OnClick();
                    }, false);
                }
                else {
                    this.decoratorElement.appendChild(Text("\u00A0"));
                }

                this.titleElement = Dom("div", this.element);
                this.titleElement.appendChild(Text("\u00A0"));
                this.titleElement.setAttribute("class", "TreeNodeTitle");

                this.postfixElement = Dom("div", this.element);
                this.postfixElement.appendChild(Text("\u00A0"));
                this.postfixElement.setAttribute("class", "TreeNodePostfix");

                Dom("div", this.element).setAttribute("style", "clear: both;");

                if (hasChild) {
                    this.nodeContainer = new TreeNodeContainer(this.expanded, this.element);
                }
            }),

            AddTreeNode: Public.StrongTyped(TreeNode, [TreeNode], function (treeNode) {
                if (this.nodeContainer !== null && treeNode.Parent === null) {
                    treeNode.doc_SetParent(this.__ExternalReference);
                    this.nodeContainer.AddTreeNode(treeNode);
                }
                return this.__ExternalReference;
            }),
        }
    });

    /********************************************************************************
    Package
    ********************************************************************************/

    return {
        TreeNodeContainer: TreeNodeContainer,
        TreeNode: TreeNode,
    }
})