using System.Text;
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

		public ActionResult Coockies()
		{
			var sb = new StringBuilder();

			foreach (var key in Request.Cookies.AllKeys)
			{
				var cookie = Request.Cookies[key];
                sb.AppendFormat("{{'{0}' = '{1}'}} ", cookie.Name, cookie.Value);
			}

			return View(new CoockiesModel {Coockies = sb.ToString()});
		}

		public class CoockiesModel
		{
			public string Coockies;
		}
	}
}