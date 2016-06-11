(function($, Handlebars) {

    var templates = {};

    var render = {
        block: function(blockName, model) {
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
        },

        blockContent: function(blockName, model) {
            var outerHtml = render.block(blockName, model);
            return $(outerHtml).html();
        }
    };

    // custom Handlebars block
    Handlebars.registerHelper("bem-block", function(blockName, options) {
        return render.block(blockName, options.hash);
    });

    // jQuery plugin
    $.fn.renderBlock = function(blockName, model) {
        var html = render.block(blockName, model);
        var jNode = $(html);

        this.replaceWith(jNode);

        return jNode.bem(blockName);
    };

    modules.define("render", function(provide) {
        provide(render);
    });

})(jQuery, Handlebars);