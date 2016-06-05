modules.define("page", ["i-bem__dom", "blocks", "api"], function (provide, BEMDOM, blocks, api) {

	blocks.push(this.name);

	provide(BEMDOM.decl(this.name,
		{
			onSetMod: {
				"js": {
					"inited": function() {
						// api.notes
						// 	.get()
						// 	.then(this._doneGetNotes.bind(this));
						this._doneGetNotes([
							{id: 1, text: "text 1"},
							{id: 2, text: "text 2 dfgdsfg dsfg sg"},
						]);
					}
				}
			},

			_onOpenNotes: function(e) {
				console.log("_onOpenNotes");
			},

			_doneGetNotes: function (response) {
				this._notes = response;

				var linksSummaries = this._notes.map(function(note) {
					var maxLinkSummary = note.text.trim().substring(0, 30); // todo: magin number 30 (symbols)
					var matches = /[^\r\n]*/.exec(maxLinkSummary);

					return {
						id: note.id,
						text: matches[0]
					};
				});

				this.findBlockOn(this.elem("links"), "notes-links-pane")
					.render(linksSummaries);
			}
		},
		{
			live: function() {
				return false;
			}
		}
	));

});