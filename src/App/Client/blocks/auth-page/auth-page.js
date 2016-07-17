modules.define("auth-page", ["i-bem__dom"], function(provide, BEMDOM) {

    /**
     * Events
     * - submit-email(email)
     */

    var KEYCODE_ENTER = 13;

    provide(BEMDOM.decl(this.name,
        {
            displayLoginInstructions: function() {
                this.delMod(this.elem("login-instructions"), "hidden");
                this.setMod(this.elem("login-failed-note"), "hidden");
            },

            displayLoginFailed: function() {
                this.setMod(this.elem("login-instructions"), "hidden");
                this.delMod(this.elem("login-failed-note"), "hidden");
            }
        },
        {
            live: function() {
                this.liveBindTo("email", "keydown", function(e) {
                    if (e.keyCode === KEYCODE_ENTER) {
                        var email = this.elem("email").val();
                        this.emit("submit-email", email);
                    }
                });
            }
        }
    ));

});