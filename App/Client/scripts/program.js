(function($) {
	$(document).on('blocks-loaded', function () {

		modules.require(['page'], function () {

			$('.page').renderBem('page');

		});
    
	});
})(jQuery);