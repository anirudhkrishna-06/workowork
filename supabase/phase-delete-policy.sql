create policy "Users can delete own logs"
  on public.daily_logs for delete
  using (auth.uid() = user_id);

create policy "Users can delete own mentor feedback"
  on public.mentor_feedback for delete
  using (
    exists (
      select 1
      from public.daily_logs
      where daily_logs.id = mentor_feedback.log_id
        and daily_logs.user_id = auth.uid()
    )
  );
