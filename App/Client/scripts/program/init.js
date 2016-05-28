(function ($) {

	modules.define("blocks", function (provide) {
		provide({

			names: [],
			templates: {},

			add: function(name) {
				this.names.push(name);
			},

			renderBlock: function(blockName, model) {
				var template = this.templates[blockName];

				var html = template(model);

				if (model.mix) {
					var jNode = $(html);
					jNode.addClass(model.mix);

					html = jNode.get(0).outerHTML;
				}

				return html;
			},

			renderBemBlock: function(blockName, options) {
				return this.renderBlock(blockName, options.hash);
			}

		});
	});

})(jQuery);