modules.define("page", ["i-bem__dom", "render", "notes-link", "note-pane"], function(provide, BEMDOM, render, NoteLink, NotePane) {

    const MAX_LINK_CAPTION_LENGTH = 30;
    
    provide(BEMDOM.decl(this.name,
        {
            onSetMod: {
                js: {
                    inited: function() {
                        NoteLink.on("click", this._onOpenNote, this);
                        NotePane.on("to-notes-list-click", this._onOpenNotesList, this);
                    }
                }
            },

            init: function(config) {
                this._config = config;
                
                return this;
            },

            _onOpenNote: function(e, noteId) {
                this._config.vowGetNote(noteId)
                    .then(this.displayNote.bind(this));            },

            _onOpenNotesList: function() {

            },
            
            // todo: rename into displayLinks
            display: function(){
                this._config.vowGetNotesCaptions(MAX_LINK_CAPTION_LENGTH)
                    .then(this.displayLinks.bind(this));
            },
            
            render: function() {
                var html = render.block("page");

                return BEMDOM.replace(this.domElem, html);
            },

            displayNote: function(note) {
                this.findBlockOn(this.elem("links"), "notes-links-pane")
                    .setMod("hidden");

                this.findBlockOn(this.elem("note"), "note-pane")
                    .render(note)
                    .delMod("hidden");
            },

            // todo: rename into "done..."
            displayLinks: function(linksSummaries) {
                this.findBlockOn(this.elem("note"), "note-pane")
                    .setMod("hidden");

                this.findBlockOn(this.elem("links"), "notes-links-pane")
                    .render(linksSummaries)
                    .delMod("hidden");
            }
        }
    ));

});