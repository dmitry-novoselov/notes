using System;
using System.Security.Principal;
using System.Web;
using System.Web.Security;

namespace App
{
	/// <summary>
	/// Я не смог понять, почему, но встроенная Forms-аутентификая не работает - перестаёт аутентифицировать посетителя спустя минут 20 после установки cookie.
	/// </summary>
	public static class CoockieAuthentication
	{
		public static void TrySignIn(HttpRequestBase request)
		{
			if (request.IsAuthenticated)
				return;

			var authenticationCoockie = request.Cookies["auth"];
			if (authenticationCoockie == null)
				return;

			var ticket = FormsAuthentication.Decrypt(authenticationCoockie.Value);
			if (ticket == null)
				return;

			if (ticket.Expired)
				return;

			SetUser(ticket);
		}

		public static void SetAuthCoockie(string userId, HttpResponseBase response)
		{
			var ticket = new FormsAuthenticationTicket(userId, true, (int) FormsAuthentication.Timeout.TotalMinutes);

			var encriptedTicket = FormsAuthentication.Encrypt(ticket);
			var httpCookie = new HttpCookie("auth", encriptedTicket)
			{
				Expires = DateTime.Now.Add(FormsAuthentication.Timeout)
			};

			response.SetCookie(httpCookie);
			SetUser(ticket);
        }

		private static void SetUser(FormsAuthenticationTicket ticket)
		{
			HttpContext.Current.User = new GenericPrincipal(new FormsIdentity(ticket), new string[0]);
		}

		public static void SignOut(HttpResponseBase response)
		{
			var httpCookie = new HttpCookie("auth")
			{
				Expires = DateTime.Now.AddDays(-1)
			};

			response.SetCookie(httpCookie);
			HttpContext.Current.User = null;
		}
	}
}