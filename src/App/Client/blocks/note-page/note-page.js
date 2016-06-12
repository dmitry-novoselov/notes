modules.define("note-page", ["i-bem__dom", "render"], function(provide, BEMDOM, render) {

    /**
     * Events
     * - to-notes-list-click
     */

    provide(BEMDOM.decl(this.name,
        {
            onSetMod: {
                "js": {
                    "inited": function() {
                    }
                }
            },

            // todo: unify block re-rendering
            render: function(note) {
                var html = render.blockContent("note-page", {text: note.text});

                BEMDOM.update(this.domElem, html);
                
                return this;
            }
        },
        {
            live: function() {
                this.liveBindTo("to-notes-list", "click touchstart", function(e) {
                    e.preventDefault();
                    this.emit("to-notes-list-click");
                });
            }
        }));

});