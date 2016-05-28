﻿using System.Web.Optimization;

namespace App
{
	public static class BundleConfig
	{
		public static void RegisterBundles(BundleCollection bundles)
		{
			bundles.Add(new StyleBundle("~/css")
				.Include("~/client/css/app.css")
				.IncludeDirectory("~/client/blocks", "*.css", true));

			bundles.Add(new ScriptBundle("~/js/lib")
				.Include("~/client/scripts/lib/jquery.min.js")
				.Include("~/client/scripts/lib/bem-core.no-autoinit.js")
				.Include("~/client/scripts/lib/handlebars.min.js")
				.Include("~/client/scripts/lib/rendering.js"));

			bundles.Add(new ScriptBundle("~/js/app")
				.Include("~/client/scripts/api.js")
				.Include("~/client/scripts/program.js")
				.IncludeDirectory("~/client/blocks", "*.js", true));
		}
	}
}