(function($) {
	$(document).on('blocks-loaded', function () {

		modules.require(['page'], function () {
			$('#page-placeholder').renderBlock('page');
		});
    
	});
})(jQuery);