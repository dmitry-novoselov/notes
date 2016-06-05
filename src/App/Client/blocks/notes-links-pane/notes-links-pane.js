modules.define("notes-links-pane", ["i-bem__dom", "blocks", "notes-link"], function (provide, BEMDOM, blocks, Link) {

	blocks.push(this.name);

	provide(BEMDOM.decl(this.name,
		{
			onSetMod: {
				"js": {
					"inited": function() {
                        Link.on(this.domElem, "click", this._onLinkClicked, this);
					}
				}
			},

            _onLinkClicked: function(e) {
                console.log("_onLinkClicked!");
            },
			
			render: function (linksSummaries) {
                var html = $(blocks.renderBlock("notes-links-pane", { notes: linksSummaries })).html();

                BEMDOM.update(this.domElem, html);

                $(".notes-link", this.domElem).each(function(_, link) {
                    $(link).bem("notes-link");
                });
            }
		}
	));

});