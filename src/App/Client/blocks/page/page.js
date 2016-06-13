modules.define("page", ["i-bem__dom", "render"], function(provide, BEMDOM, render) {

    provide(BEMDOM.decl(this.name,
        {
            // todo: magic number 30 (symbols)
            
            init: function(config) {
                this._config = config;
                
                return this;
            },
            
            // todo: rename into displayLinks
            display: function(){
                this._config.vowGetNotesCaptions()
                    .then(this.displayLinks.bind(this));
            },
            
            render: function() {
                var html = render.block("page");

                return BEMDOM.replace(this.domElem, html);
            },

            displayNote: function(note) {
                this.findBlockOn(this.elem("links"), "notes-links-pane")
                    .setMod("hidden");

                this.findBlockOn(this.elem("note"), "note-page")
                    .render(note)
                    .delMod("hidden");
            },

            // todo: rename into "done..."
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