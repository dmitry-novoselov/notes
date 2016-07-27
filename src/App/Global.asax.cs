using System;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Web;
using System.Web.Http;
using System.Web.Routing;
using System.Web.Security;

namespace App
{
	public class Global : HttpApplication
	{
		public Global()
		{
			AuthenticateRequest += OnAuthenticateRequest;
			PostAuthenticateRequest += OnAuthenticateRequest;
		}

		private void Application_Start(object sender, EventArgs e)
		{
            GlobalConfiguration.Configure(WebApiConfig.Register);
			RouteConfig.RegisterRoutes(RouteTable.Routes);
		}

		private void OnAuthenticateRequest(object sender, EventArgs eventArgs)
		{
			if (HttpContext.Current.Request.IsAuthenticated)
				return;

			var authenticationCoockie = Request.Cookies[FormsAuthentication.FormsCookieName];
			if (authenticationCoockie == null)
				return;

			try
			{
				var ticket = FormsAuthentication.Decrypt(authenticationCoockie.Value);
				if (ticket == null)
					return;

				if (ticket.Expired)
					return;

				HttpContext.Current.User = new GenericPrincipal(new FormsIdentity(ticket), new string[0]);
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