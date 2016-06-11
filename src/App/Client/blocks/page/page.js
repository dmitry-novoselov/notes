modules.define("page", ["i-bem__dom", "notes-link", "api"], function (provide, BEMDOM, NotesLink, api) {

    provide(BEMDOM.decl(this.name,
        {
            onSetMod: {
                "js": {
                    "inited": function () {
                        // api.notes
                        // 	.get()
                        // 	.then(this._doneGetNotes.bind(this));
                        this._doneGetNotes([
                            {id: 1, text: "text 1"},
                            {id: 2, text: "text 2 dfgdsfg dsfg sg"},
                        ]);

                        NotesLink.on(this.domElem, "click", this._onOpenNotes, this);
                    }
                }
            },

            _onOpenNotes: function (e, id) {
                console.log("_onOpenNotes: " + id);
            },

            _doneGetNotes: function (response) {
                this._notes = response;

                var linksSummaries = this._notes.map(function (note) {
                    var maxLinkSummary = note.text.trim().substring(0, 30); // todo: magic number 30 (symbols)
                    var matches = /[^\r\n]*/.exec(maxLinkSummary);

                    return {
                        id: note.id,
                        text: matches[0]
                    };
                });

                this.findBlockOn(this.elem("links"), "notes-links-pane")
                    .render(linksSummaries);
            }
        }
    ));

});