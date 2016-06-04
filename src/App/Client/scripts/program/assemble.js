modules.define("program-assembled", ["blocks"], function (provide, blocks) {

	var templates = {};

	blocks.renderBlock = function (blockName, model) {
		var template = templates[blockName];

		var html = template(model);

		if (model && model.mix) {
			var jNode = $(html);
			jNode.addClass(model.mix);

			html = jNode.get(0).outerHTML;
		}

		return html;
	}

	var loads = blocks.names.map(function(blockName) {
		var url = "/blocks/" + blockName + "/" + blockName + ".html";

		return $.get(url, function(html) {
			templates[blockName] = Handlebars.compile(html);
		});
	});

	$.when.apply(null, loads).then(function () {
		// jQuery plugins
		$.fn.renderBlock = function (blockName, model) {
			var html = blocks.renderBlock(blockName, model);
			var jNode = $(html);

			this.replaceWith(jNode);

			return jNode.bem(blockName);
		};

		// custom Handlebars block
		Handlebars.registerHelper("bem-block", function(blockName, options) {
			return blocks.renderBlock(blockName, options.hash);
		});

		provide(true);
	});

});