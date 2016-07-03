modules.define("note-pane", ["i-bem__dom", "render"], function(provide, BEMDOM, render) {

    /**
     * Events
     * - to-notes-list-click
     * - note-changed
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
                var html = render.blockContent("note-pane", {text: note.text});

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

                this.liveBindTo("text-area", "input paste", function(e) {
                    e.preventDefault();

                    clearTimeout(this._editTimeoutId);

                    var noteText = this.elem("text-area").val();
                    this._editTimeoutId = setTimeout(function() {
                        this.emit("note-changed", noteText);
                    }.bind(this), 500); // todo: magic constant
                });
            }
        }));

});