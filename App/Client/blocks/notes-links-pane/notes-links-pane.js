modules.define("notes-links-pane", ["i-bem__dom", "registry"], function(provide, BEMDOM, registry) {

	registry.push(this.name);

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