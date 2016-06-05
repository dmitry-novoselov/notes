(function() {

	var blocks = {
		names: [],

		push: function(name) {
			this.names.push(name);
		}
	};

	var templates = {};

	blocks.renderBlock = function (blockName, model) {
		var template = templates[blockName];

		if (!template) {
			var templateHtml = $("#" + blockName).html();
			template = templates[blockName] = Handlebars.compile(templateHtml);
		}

		var html = template(model);

		if (model && model.mix) {
			var jNode = $(html);
			jNode.addClass(model.mix);

			html = jNode.get(0).outerHTML;
		}

		return html;
	}

	// custom Handlebars block
	Handlebars.registerHelper("bem-block", function (blockName, options) {
		return blocks.renderBlock(blockName, options.hash);
	});

	// jQuery plugin
	$.fn.renderBlock = function (blockName, model) {
		var html = blocks.renderBlock(blockName, model);
		var jNode = $(html);

		this.replaceWith(jNode);

		return jNode.bem(blockName);
	};

	modules.define("blocks", function(provide) {
		provide(blocks);
	});

})();