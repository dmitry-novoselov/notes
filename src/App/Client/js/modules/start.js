modules.define("start", ["jquery", "api"], function(provide, $, api) {

    var _bemPage,
        _notes;

    function asyncResolve(value) {
        var deferred = $.Deferred();

        setTimeout(function() {
            deferred.resolve(value);
        }, 0);

        return deferred.promise();
    }

    function buildLinkCaptions(notes, maxCaptionLength) {
        var linksCaptions = notes.map(function(note) {
            var maxLinkSummary = note.text.trim().substring(0, maxCaptionLength);
            var matches = /[^\r\n]*/.exec(maxLinkSummary);

            return {
                id: note.id,
                caption: matches[0]
            };
        });

        return linksCaptions;
    }

    function vowGetNotesCaptions(maxCaptionLength) {
        if (_notes) {
            return asyncResolve(buildLinkCaptions(_notes, maxCaptionLength));
        }

        return api.notes.get()
            .then(function(notes) {
                _notes = notes;
                return buildLinkCaptions(_notes, maxCaptionLength);
            }, function() {
                console.error("api.notes.get() failed");
            });
    }

    function vowGetNote(noteId) {
        var note = _notes.find(function(x) {
            return x.id === noteId;
        });

        return asyncResolve(note);
    }

    function vowSaveNote(noteId, noteText) {
        var note = {
            id: noteId,
            text: noteText
        };

        return api.notes.save(note)
            .then(doneSaveNote.bind(null, note));
    }
    
    function doneSaveNote(note) {
        var noteToUpdate = _notes.find(function(x) {
            return x.id === note.id;
        })

        $.extend(true, noteToUpdate, note);
    }

    function start() {
        _bemPage = $("#page-placeholder")
            .renderBlock("page")
            .init({
                vowGetNotesCaptions: vowGetNotesCaptions,
                vowGetNote: vowGetNote,
                vowSaveNote: vowSaveNote
            });

        _bemPage.displayLinks();
    }

    provide(start);

});
