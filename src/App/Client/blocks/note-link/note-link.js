modules.define("note-link", ["i-bem__dom"], function(provide, BEMDOM) {

    /**
     * Events
     * - click(id)
     */

    provide(BEMDOM.decl(this.name,
        {},
        {
            live: function() {
                this.liveBindTo("click touchstart", function(e) {
                    e.preventDefault();
                    this.emit("click", this.params.id);
                });
            }
        }
    ));

});