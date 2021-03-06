﻿using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Web.Http;
using Core;
using Core.Models;

namespace App.Controllers
{
	[Authorize]
	public class NotesController : ApiController
	{
		public IEnumerable<Note> Get()
		{
			return Db.ReadNotes();
		}

		public Note Get(int id)
		{
			return Db.ReadNote(id);
		}

		public void Post([System.Web.Http.ModelBinding.ModelBinder(typeof(FromJson<Note>))] Note note)
		{
			Debug.Assert(note != null);
			Debug.Assert(note.text != null, "No data was sent or it failed to deserialize");

			Db.UpdateNote(note);
		}

		public void Delete(int id)
		{
			throw new NotImplementedException();
		}
	}
}