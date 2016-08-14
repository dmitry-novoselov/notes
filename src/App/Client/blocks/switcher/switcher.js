modules.define("switcher", ["i-bem__dom"], function (provide, BEMDOM) {

    /**
     * Events
     * - switch-left()
     * - switch-right()
     */

    provide(BEMDOM.decl(this.name,
        {
        	js: {
				inited: function () {
					this.on(this.elem("left"))
				}
			}
        }
    ));

});