modules.define("api", ["jquery"], function(provide, $) {

    var api = {
        notes: {
            get: function() {
                return $.get('/api/notes');
            }
        }
    };

    provide(api);

});
