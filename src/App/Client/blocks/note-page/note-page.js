modules.define("note-page", ["i-bem__dom"], function(provide, BEMDOM) {

    /**
     * Events
     * -
     */

    provide(BEMDOM.decl(this.name,
        {
            onSetMod: {
                "js": {
                    "inited": function() {
                    }
                }
            },

            render: function(note) {
                BEMDOM.update(this.domElem, note.text);
            }
        }));

});