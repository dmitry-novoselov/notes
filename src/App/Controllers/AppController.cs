using System;
using System.Web;
using System.Web.Mvc;

namespace App.Controllers
{
	public class AppController : Controller
	{
		public ActionResult Index()
		{
			Response.SetCookie(new HttpCookie("y", "z") {Expires = DateTime.Now.AddDays(30)});

			if (User.Identity.IsAuthenticated)
			{
				return View("MobileIndex");
			}
			else
			{
				return View("MobileAuthentication");
			}
		}
	}
}