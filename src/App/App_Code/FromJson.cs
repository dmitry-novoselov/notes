using System.Web.Http.Controllers;
using System.Web.Http.ModelBinding;
using Newtonsoft.Json;

namespace App
{
	public class FromJson<TModel> : IModelBinder
	{
		public bool BindModel(HttpActionContext actionContext, ModelBindingContext bindingContext)
		{
			if (bindingContext.ModelType != typeof(TModel))
			{
				return false;
			}

			var result = JsonConvert.DeserializeObject<TModel>(actionContext.Request.Content.ReadAsStringAsync().Result);
			bindingContext.Model = result;

			return true;
		}
	}
}