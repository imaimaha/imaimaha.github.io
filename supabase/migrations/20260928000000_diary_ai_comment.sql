-- ローカルAI(Ollama)による日記への一言コメント機能
alter table diary_entries add column if not exists ai_comment text;
