modules.define("notes-links-pane", ["i-bem__dom", "render", "notes-link"], function (provide, BEMDOM, render, NotesLink) {

    provide(BEMDOM.decl(this.name,
        {
            onSetMod: {
                "js": {
                    "inited": function () {
                        NotesLink.on(this.domElem, "click", this._onLinkClicked, this);
                    }
                }
            },

            _onLinkClicked: function (e) {
                console.log("_onLinkClicked!");
            },

            // todo: unify block re-rendering
            render: function (linksSummaries) {
                var html = render.blockContent("notes-links-pane", {notes: linksSummaries});

                BEMDOM.update(this.domElem, html);
            }
        }
    ));

});