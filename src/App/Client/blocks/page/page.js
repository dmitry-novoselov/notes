modules.define("page", ["i-bem__dom"], function(provide, BEMDOM) {

    provide(BEMDOM.decl(this.name,
        {
            onSetMod: {
                "js": {
                    "inited": function() {
                    }
                }
            },

            displayNote: function(note) {
                this.findBlockOn(this.elem("links"), "notes-links-pane")
                    .setMod("hidden");

                this.findBlockOn(this.elem("note"), "note-page")
                    .render(note)
                    .delMod("hidden");
            },

            displayLinks: function(linksSummaries) {
                this.findBlockOn(this.elem("note"), "note-page")
                    .setMod("hidden");

                this.findBlockOn(this.elem("links"), "notes-links-pane")
                    .render(linksSummaries)
                    .delMod("hidden");
            }
        }
    ));

});