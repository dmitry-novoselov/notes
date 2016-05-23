using System.Collections.Generic;
using System.Web.Http;
using App.Models;

namespace App.Controllers
{
	public class NotesController : ApiController
	{
		public IEnumerable<Note> Get()
		{
			return new[]
			{
				new Note
				{
					id = 1,
					text = "notes 1"
				},
				new Note
				{
					id = 2,
					text = "notes 2"
				}
			};
		}

		// GET: api/Default/5
		public string Get(int id)
		{
			return "value";
		}

		// POST: api/Default
		public void Post([FromBody] string value)
		{
		}

		// PUT: api/Default/5
		public void Put(int id, [FromBody] string value)
		{
		}

		// DELETE: api/Default/5
		public void Delete(int id)
		{
		}
	}
}