modules.define("notes-links-pane", ["i-bem__dom", "blocks"], function (provide, BEMDOM, blocks) {

	blocks.push(this.name);

	provide(BEMDOM.decl(this.name,
		{
			onSetMod: {
				"js": {
					"inited": function() {
					}
				}
			}
		}
	));

});