modules.define("notes-link", ["i-bem__dom"], function (provide, BEMDOM) {

	provide(BEMDOM.decl(this.name,
		{
			onSetMod: {
				'js': {
					'inited': function () {
						this.bindTo('click', this._onClicked);
					}
				}
			},

			_onClicked: function (e) {
				e.preventDefault();

				this.emit('click');
			}
		}
	));

});