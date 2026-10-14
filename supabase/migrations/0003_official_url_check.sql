-- Defence in depth: official update links must be http(s), never javascript: or data:.
alter table official_updates
  add constraint official_updates_source_url_http
  check (source_url is null or source_url ~* '^https?://');
