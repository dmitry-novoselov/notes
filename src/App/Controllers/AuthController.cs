using System.Net;
using System.Web.Mvc;

namespace App.Controllers
{
	public class AuthController : Controller
	{
		public ActionResult Login(string email)
		{
			if (email == "dmitry.a.novoselov@yandex.ru")
			{
				CoockieAuthentication.SetAuthCoockie(email, Response);

				return new HttpStatusCodeResult(HttpStatusCode.OK, "Logged in successfully");
			}

			return new HttpStatusCodeResult(HttpStatusCode.BadRequest, "Unknown or invalid email");
		}

		public void SignOut()
		{
			CoockieAuthentication.SignOut(Response);
        }
	}
}