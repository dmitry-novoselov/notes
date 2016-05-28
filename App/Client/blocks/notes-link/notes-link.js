modules.define("notes-link", ["i-bem__dom", "blocks"], function (provide, BEMDOM, blocks) {

	blocks.push(this.name);

	provide(BEMDOM.decl(this.name,
		{
			onSetMod: {
				"js": {
					"inited": function() {
						this.bindTo("click", this._onClicked);
					}
				}
			},

			_onClicked: function(e) {
				e.preventDefault();

				this.emit("click");
			}
		}
	));

});