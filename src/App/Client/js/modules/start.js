modules.define("start", ["jquery", "notes-link"], function(provide, $, NoteLink) {

    var _bemPage,
        _notes;

    function onOpenNote(e, id) {
        var note = _notes.find(function(x) {
            return x.id === id;
        })
        
        _bemPage.displayNote(note);
    }

    function doneGetNotes(response) {
        _notes = response;

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

    function start() {
        _bemPage = $("#page-placeholder").renderBlock("page");
        NoteLink.on(_bemPage.domElem, "click", onOpenNote);

        doneGetNotes([
            {id: 1, text: "text 1"},
            {id: 2, text: "text 2\r\ndfgdsfg dsfg sg"},
        ]);
    }

    provide(start);

});
