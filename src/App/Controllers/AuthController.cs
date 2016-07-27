using System;
using System.Net;
using System.Web;
using System.Web.Mvc;
using System.Web.Security;

namespace App.Controllers
{
	public class AuthController : Controller
	{
		public ActionResult Login(string email)
		{
			if (email == "dmitry.a.novoselov@yandex.ru" || email == "pw6")
			{
				var ticket = new FormsAuthenticationTicket(email, true, (int) FormsAuthentication.Timeout.TotalMinutes);
				var encriptedTicket = FormsAuthentication.Encrypt(ticket);
				var httpCookie = new HttpCookie(FormsAuthentication.FormsCookieName, encriptedTicket)
				{
					Expires = DateTime.UtcNow.Add(FormsAuthentication.Timeout)
				};

				Response.SetCookie(httpCookie);

				return new HttpStatusCodeResult(HttpStatusCode.OK, "Logged in successfully");
			}

			return new HttpStatusCodeResult(HttpStatusCode.BadRequest, "Unknown or invalid email");
		}

		public void SignOut()
		{
			FormsAuthentication.SignOut();
		}
	}
}