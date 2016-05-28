modules.define("page", ["i-bem__dom", "api"], function(provide, BEMDOM, api) {

	provide(BEMDOM.decl(this.name,
		{
			onSetMod: {
				'js': {
					'inited': function() {
						api.notes
							.get()
							.then(this._doneGetNotes.bind(this));
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

				BEMDOM.replace(
					this.elem("links"),
					renderBlock("notes-links-pane", { notes: linksSummaries, mix: "page__links" })
				);
			}
		}, {
			live: function() {
				return false;
			}
		}
	));

});