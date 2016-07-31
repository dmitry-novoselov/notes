using System;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Web;
using System.Web.Http;
using System.Web.Routing;
using System.Web.Security;
using Core;

namespace App
{
	public class Global : HttpApplication
	{
		private void Application_Start(object sender, EventArgs e)
		{
            GlobalConfiguration.Configure(WebApiConfig.Register);
			RouteConfig.RegisterRoutes(RouteTable.Routes);
		}

		protected void Application_AuthenticateRequest(Object sender, EventArgs e)
		{
			Db.Log("Authenticated: " + HttpContext.Current.Request.IsAuthenticated);
//			if (HttpContext.Current.Request.IsAuthenticated)
//				return;

			Db.Log("FormsAuthentication.FormsCookieName: " + FormsAuthentication.FormsCookieName);
			Db.Log("Request.Cookies.Count: " + Request.Cookies.Count);
			Db.Log("Request.Cookies.AllKeys: " + string.Join(",", Request.Cookies.AllKeys));

			var authenticationCoockie = Request.Cookies[FormsAuthentication.FormsCookieName];
			Db.Log("authenticationCoockie == null: " + (authenticationCoockie == null));
			if (authenticationCoockie == null)
				return;

			try
			{
				var ticket = FormsAuthentication.Decrypt(authenticationCoockie.Value);
				Db.Log("ticket: " + ticket);
				if (ticket == null)
					return;

				Db.Log("ticket.Expired: " + ticket.Expired);
				Db.Log("ticket.Expired: " + ticket.Expired);
				if (ticket.Expired)
					return;

				var principal = new GenericPrincipal(new FormsIdentity(ticket), new string[0]);
				Db.Log("principal.Identity.IsAuthenticated: " + principal.Identity.IsAuthenticated);
				HttpContext.Current.User = principal;
			}
			catch (CryptographicException)
			{
			}
			catch (ArgumentException)
			{
			}

		}
	}
}