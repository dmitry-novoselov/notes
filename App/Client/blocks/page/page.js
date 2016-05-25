modules.define('page', ['i-bem__dom'], function(provide, BEMDOM) {

	provide(BEMDOM.decl(this.name,
		{
			onSetMod: {
				'js': {
					'inited': function () {
						this.findBlocksInside('notes-link')
							.forEach(function(link) {
								link.on('click', this._onOpenNotes, this);
							}, this);
					}
				}
			},

			_onOpenNotes: function(e) {
				console.log("_onOpenNotes");
			},

			_doneGetNotes: function(response) {
				console.log(response);
			}
		}
	));

});