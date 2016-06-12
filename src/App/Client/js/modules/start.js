modules.define("start", ["jquery", "notes-link", "note-page"], function(provide, $, NoteLink, NotePage) {

    var _bemPage,
        _notes;

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

    function doneGetNotes(response) {
        _notes = response;

        displayNotes();
    }

    function start() {
        _bemPage = $("#page-placeholder").renderBlock("page");
        NoteLink.on("click", onOpenNote);
        NotePage.on("to-notes-list-click", onOpenNotesList);

        doneGetNotes([
            {id: 1, text: "text 1"},
            {id: 2, text: "text 2\r\ndfgdsfg dsfg sg"},
        ]);
    }

    provide(start);

});
