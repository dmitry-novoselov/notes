modules.define("notes-link", ["i-bem__dom"], function (provide, BEMDOM) {

	provide(BEMDOM.decl(this.name,
		{
			onSetMod: {
				js: {
					inited: function() {
					}
				}
			}
		},
		{
			live: function () {
				this.liveBindTo("click touchstart", function(e) {
                    e.preventDefault();
                    this.emit("click");
				});
			}
		}
	));

});