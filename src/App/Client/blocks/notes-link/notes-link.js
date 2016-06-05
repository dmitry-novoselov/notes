modules.define("notes-link", ["i-bem__dom", "blocks"], function (provide, BEMDOM, blocks) {

	blocks.push(this.name);

	provide(BEMDOM.decl(this.name,
		{
			_onClicked: function(e) {
				e.preventDefault();

				this.emit("click");
			}
		},
		{
			live: function () {
				this.liveBindTo("click touchstart", function(e) {
					this._onClicked(e);
				});
			}
		}
	));

});