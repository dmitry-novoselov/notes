-- use novosel_six9g;

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

if (not exists (select null
                from information_schema.tables 
				where table_name = 'logs'))
begin
    
	create table dbo.logs(
		id int identity(1, 1) constraint PK_logs primary key,
		createdDateUtc datetime not null constraint DF_logs_createdDateUtc default(getutcdate()),
		[text] varchar(100) not null
	);

end;