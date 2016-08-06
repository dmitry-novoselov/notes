using System;
using System.Web;
using System.Web.Http;
using System.Web.Routing;

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
			CoockieAuthentication.TrySignIn(
				new HttpRequestWrapper(HttpContext.Current.Request),
				new HttpResponseWrapper(HttpContext.Current.Response));
		}
	}
}