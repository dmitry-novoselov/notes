using System.Collections.Generic;
using System.Configuration;
using System.Data.SqlClient;
using System.Linq;
using Core.Models;
using Dapper;

namespace Core
{
	public static class Db
	{
		public static List<Note> ReadNotes()
		{
			using (var cnn = NewConnection())
			{
				return cnn.Query<Note>(@"select * from note").ToList();
			}
		}

		public static Note ReadNote(int id)
		{
			using (var cnn = NewConnection())
			{
				return cnn.Query<Note>(@"select * from note where id = @id", new {id}).Single();
			}
		}

		public static void InsertNote(Note note)
		{
			using (var cnn = NewConnection())
			{
				cnn.Execute(@"insert note([text]) values (@text)", new { note.text });
			}
		}

		public static void UpdateNote(Note note)
		{
			using (var cnn = NewConnection())
			{
				cnn.Execute(@"update note set [text] = @text where id = @id", new { note.id, note.text });
			}
		}

		private static SqlConnection NewConnection()
		{
			return new SqlConnection(ConfigurationManager.ConnectionStrings["notes"].ConnectionString);
		}
	}
}