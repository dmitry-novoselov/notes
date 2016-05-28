modules.define("program-assembled", ["blocks"], function (provide, blocks) {

	var loads = blocks.names.map(function(blockName) {
		var url = "/client/blocks/" + blockName + "/" + blockName + ".html";

		return $.get(url, function(html) {
			blocks.templates[blockName] = Handlebars.compile(html);

			var script = document.createElement("script");
			script.id = blockName + "-template";
			script.type = "text/x-handlebem-template";
			script.text = html;

			document.body.appendChild(script);
		});
	});

	$.when.apply(null, loads).then(function () {
		// jQuery plugins
		$.fn.renderBlock = function (blockName, model) {
			var template = blocks.templates[blockName];

			var html = template(model);
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