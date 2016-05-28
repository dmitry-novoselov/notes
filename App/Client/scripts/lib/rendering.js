var renderBlock;

(function(Handlebars, $) {

	var templatesCache = {};

	function getTemplateFor(model) {
		var blockName = model.block || model;
		var template = templatesCache[blockName];

		if (!template) {
			var templateId = "#" + blockName + "-template";
			var templateSource = $(templateId).html();
			template = templatesCache[blockName] = Handlebars.compile(templateSource);
		}

		return template;
	}

	renderBlock = function (blockName, model) {
		var template = getTemplateFor(blockName);

		var html = template(model);

		if (model.mix) {
			var jNode = $(html);
			jNode.addClass(model.mix);

			html = jNode.get(0).outerHTML;
		}

		return html;
	};

	function renderBemBlock(blockName, options) {
		return renderBlock(blockName, options.hash);
	}

	// load in all blocks
	$(function() {
		var loads = [
			{ name: "page", url: "/client/blocks/page/page.html" },
			{ name: "notes-links-pane", url: "/client/blocks/notes-links-pane/notes-links-pane.html" },
			{ name: "notes-link", url: "/client/blocks/notes-link/notes-link.html" }
		].map(function(block) {
			return $.get(block.url, function(html) {
				var script = document.createElement("script");
				script.id = block.name + "-template";
				script.type = "text/x-handlebem-template";
				script.text = html;

				document.body.appendChild(script);
			});
		});

		$.when.apply(null, loads).then(function() {
			$(document).trigger("blocks-loaded");
		});
	});

	// jQuery plugins
	$.fn.renderBlock = function(blockName, model) {
		var template = getTemplateFor(blockName);

		var html = template(model);
		var jNode = $(html);

		this.replaceWith(jNode);

		return jNode.bem(blockName);
	};

	// custom Handlebars block
	Handlebars.registerHelper("bem-block", renderBemBlock);

})(Handlebars, jQuery);