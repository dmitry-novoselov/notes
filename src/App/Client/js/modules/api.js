modules.define("api", ["jquery"], function(provide, $) {

    var api = {
        auth: {
            login: function(email) {
                return $.post('/auth/login', {email: email});
            },

            signOut: function() {
                return $.post('/auth/signOut');
            }
        },

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
