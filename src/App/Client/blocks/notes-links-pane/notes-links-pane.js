modules.define("notes-links-pane", ["i-bem__dom", "render"], function(provide, BEMDOM, render) {

    provide(BEMDOM.decl(this.name,
        {
            // todo: unify block re-rendering
            render: function(linksSummaries) {
                var html = render.blockContent("notes-links-pane", {notes: linksSummaries});

                BEMDOM.update(this.domElem, html);
            }
        }
    ));

});