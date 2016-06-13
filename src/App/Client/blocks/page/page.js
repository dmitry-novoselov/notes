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
                    .then(this._doneGetNote.bind(this));
            },

            _onOpenNotesList: function() {
                this.displayLinks();
            },

            _doneGetNote: function(note) {
                this.findBlockOn(this.elem("note"), "note-pane")
                    .render(note);

                this.setMod("display", "note");
            },

            _doneGetNotesCaptions: function(notesCaptions) {
                this.findBlockOn(this.elem("links"), "notes-links-pane")
                    .render(notesCaptions);

                this.setMod("display", "links");
            },

            displayLinks: function() {
                this._config.vowGetNotesCaptions(MAX_LINK_CAPTION_LENGTH)
                    .then(this._doneGetNotesCaptions.bind(this));
            }
        }
    ));

});