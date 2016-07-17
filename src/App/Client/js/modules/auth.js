modules.define("auth", ["jquery", "api"], function(provide, $, api) {

	var _blockPage;

	function onEmailEntered(e, email) {
		api.auth.login(email)
			.then(doneLogin, failLogin);
	}
	
	function doneLogin() {
		_blockPage.displayLoginInstructions();
		window.location.reload(); // todo: remove once actual link sending is implemented
	}
	
	function failLogin() {
		_blockPage.displayLoginFailed();
	}

	function auth() {
		_blockPage = $("#page-placeholder")
            .renderBlock("auth-page")
			.on("submit-email", onEmailEntered);
	}

    provide(auth);

});
