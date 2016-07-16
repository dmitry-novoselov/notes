modules.define("api", ["jquery"], function(provide, $) {

    function asyncResolve(value) {
        var deferred = $.Deferred();

        setTimeout(function() {
            deferred.resolve(value);
        }, 0);

        return deferred.promise();
    }

    var api = {
        notes: {
            get: function() {
                return asyncResolve([
                    {id: 1, text: "text 1"},
                    {id: 2, text: "text 2\r\ndfgdsfg dsfg sg"},
                ]);
            },

            save: function(note) {
                return asyncResolve(note);
            }
        }
    };

    provide(api);

});
