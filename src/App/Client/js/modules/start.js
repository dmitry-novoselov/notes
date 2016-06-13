modules.define("start", ["jquery", "notes-link", "note-pane"], function(provide, $, NoteLink, NotePage) {

    var _bemPage,
        _notes = [
            {id: 1, text: "text 1"},
            {id: 2, text: "text 2\r\ndfgdsfg dsfg sg"},
        ];

    function onOpenNote(e, id) {
        var note = _notes.find(function(x) {
            return x.id === id;
        })
        
        _bemPage.displayNote(note);
    }

    function onOpenNotesList() {
        displayNotes();
    }

    function displayNotes() {
        var linksSummaries = _notes.map(function(note) {
            var maxLinkSummary = note.text.trim().substring(0, 30); // todo: magic number 30 (symbols)
            var matches = /[^\r\n]*/.exec(maxLinkSummary);

            return {
                id: note.id,
                text: matches[0]
            };
        });

        _bemPage.displayLinks(linksSummaries);
    }

    function vowGetNotesCaptions(maxCaptionLength) {
        var def = $.Deferred();

        var linksCaptions = _notes.map(function(note) {
            var maxLinkSummary = note.text.trim().substring(0, maxCaptionLength);
            var matches = /[^\r\n]*/.exec(maxLinkSummary);

            return {
                id: note.id,
                text: matches[0] // todo: rename into "caption"
            };
        });

        def.resolve(linksCaptions);

        return def.promise();
    }

    function vowGetNote(noteId) {
        var def = $.Deferred();

        var note = _notes.find(function(x) {
            return x.id === noteId;
        });

        def.resolve(note);

        return def.promise();
    }

    function start() {
        _bemPage = $("#page-placeholder")
            .renderBlock("page")
            .init({
                vowGetNotesCaptions: vowGetNotesCaptions,
                vowGetNote: vowGetNote
            });

        _bemPage.display();

        NoteLink.on("click", onOpenNote);
        NotePage.on("to-notes-list-click", onOpenNotesList);
    }

    provide(start);

});
