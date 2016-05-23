(function($) {
	$(document).on('blocks-loaded', function () {

		modules.require(['api', 'page'], function (api) {

			api.notes.get()
				.then(function(response) {
					$('.page').renderBem('page', { notes: response });
				});

		});
    
	});
})(jQuery);