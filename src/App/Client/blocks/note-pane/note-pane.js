modules.define("note-pane", ["i-bem__dom", "render", "switcher"], function(provide, BEMDOM, render, Switcher) {

    /**
     * Events
     * - to-notes-list-click
     * - note-changed
     */

	function textToHtml(text) {
		return text
			.replace(/(https?:\/\/[^\s]+)/g, "<a href='$1'>$1</a>")
			.replace(/\n/g, "<br/>");
	}

    provide(BEMDOM.decl(this.name,
        {
            onSetMod: {
                "js": {
                	"inited": function () {
                		this.setMod("mode", "links");

                		Switcher
			                .on("switch-left", this._onSwitchedToLinks, this)
			                .on("switch-right", this._onSwitchedToEditor, this);
	                }
                },

				"mode": {
					"links": function () {
						this.findBlockInside(this.elem("switcher"), "switcher")
							.setMod("position", "left");
					},

					"editor": function() {
						this.findBlockInside(this.elem("switcher"), "switcher")
							.setMod("position", "right");
					}
				}
            },

        	_onSwitchedToLinks: function(e) {
        		this.setMod("mode", "links");
        	},

        	_onSwitchedToEditor: function (e) {
        		this.setMod("mode", "editor");
        	},

        	_updateLinksPane: function(text) {
		        this.elem("links-area")
			        .html(textToHtml(text));
	        },

            // todo: unify block re-rendering
            render: function (note) {
	            var noteText = note.text;
	            var noteHtml = textToHtml(noteText);

                var html = render.blockContent("note-pane", {text: noteText, html: noteHtml});

                BEMDOM.update(this.domElem, html);
                this.dropElemCache("text-area");

	            this.setMod("mode", "links");

                return this;
            }
        },
        {
            live: function() {
                this.liveBindTo("to-notes-list", "click touchstart", function(e) {
                    e.preventDefault();
                    this.emit("to-notes-list-click");
                });

                this.liveBindTo("text-area", "change", function(e) {
                    clearTimeout(this._editTimeoutId);

                    var noteText = this.elem("text-area").val();
                    this._editTimeoutId = setTimeout(function () {
                    	this._updateLinksPane(noteText);
                    	this.emit("note-changed", noteText);
                    }.bind(this), 500); // todo: magic constant
                });
            }
        }));

});