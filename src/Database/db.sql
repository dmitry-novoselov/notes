if (not exists (select null
                from information_schema.tables 
				where table_name = 'note'))
begin
    
	create table dbo.note(
		id int identity(1, 1) constraint PK_notes primary key,
		createdDateUtc datetime not null constraint DF_notes_createdDateUtc default(getutcdate()),
		updatedDateUtc datetime not null constraint DF_notes_updatedDateUtc default(getutcdate()),
		[text] nvarchar(max) not null
	);

end;