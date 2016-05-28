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

		private static SqlConnection NewConnection()
		{
			return new SqlConnection(ConfigurationManager.ConnectionStrings["notes"].ConnectionString);
		}
	}
}