modules.define("api", ["jquery"], function(provide, $) {

    var api = {
        notes: {
            get: function() {
                return $.get('/api/notes');
            },

            save: function(note) {
                return $.post('/api/notes', JSON.stringify(note));
            }
        }
    };

    provide(api);

});
