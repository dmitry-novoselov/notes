using System.Collections.Generic;
using System.Web.Http;
using Core;
using Core.Models;

namespace App.Controllers
{
	public class NotesController : ApiController
	{
		public IEnumerable<Note> Get()
		{
			return Db.ReadNotes();
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