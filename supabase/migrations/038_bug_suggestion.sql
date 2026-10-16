-- Bug：优化建议（给 +1 / 研发看的建议）

alter table bugs add column if not exists suggestion text;
