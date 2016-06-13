modules.define("start", ["jquery"], function(provide, $) {

    var _bemPage,
        _notes = [
            {id: 1, text: "text 1"},
            {id: 2, text: "text 2\r\ndfgdsfg dsfg sg"},
        ];

    function vowGetNotesCaptions(maxCaptionLength) {
        var def = $.Deferred();

        var linksCaptions = _notes.map(function(note) {
            var maxLinkSummary = note.text.trim().substring(0, maxCaptionLength);
            var matches = /[^\r\n]*/.exec(maxLinkSummary);

            return {
                id: note.id,
                caption: matches[0]
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

        _bemPage.displayLinks();
    }

    provide(start);

});
