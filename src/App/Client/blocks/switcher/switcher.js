modules.define("switcher", ["i-bem__dom"], function (provide, BEMDOM) {

    /**
     * Events
     * - switch-left()
     * - switch-right()
     */

    provide(BEMDOM.decl(this.name,
        {
        	_onSwitchedToLeftOption: function(e) {
        		e.preventDefault();

		        this.setMod("mode", "left");

		        this.emit("switch-left");
	        },

        	_onSwitchedToRightOption: function (e) {
        		e.preventDefault();

        		this.setMod("mode", "right");

		        this.emit("switch-right");
	        }
        },
	    {
	    	live: function () {
		    	this.liveBindTo("left-option", "click touchstart", function(e) {
				    this._onSwitchedToLeftOption(e);
			    });

		    	this.liveBindTo("right-option", "click touchstart", function(e) {
				    this._onSwitchedToRightOption(e);
			    });
		    }
	    }
    ));

});