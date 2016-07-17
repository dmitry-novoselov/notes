using System.Web.Mvc;

namespace App.Controllers
{
	public class AppController : Controller
	{
		public ActionResult Index()
		{
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