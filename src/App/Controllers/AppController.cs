using System.Web.Mvc;

namespace App.Controllers
{
	public class AppController : Controller
	{
		public ActionResult Index()
		{
			if (!User.Identity.IsAuthenticated)
			{
				return View("MobileAuthentication");
			}

			return View("MobileIndex");
		}
	}
}