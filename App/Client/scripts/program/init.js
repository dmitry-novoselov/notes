(function() {

	modules.define("blocks", function(provide) {
		provide({
			names: [],

			push: function(name) {
				this.names.push(name);
			}
		});
	});

})();