-- Senha compartilhada validada no servidor; tokens aleatórios armazenados somente como hash.
create table if not exists diagnostic_private.admin_sessions (
 token_hash text primary key,
 password_version text not null,
 expires_at timestamptz not null
);
create index if not exists admin_sessions_expiry_idx on diagnostic_private.admin_sessions(expires_at);
alter table diagnostic_private.admin_sessions enable row level security;
revoke all on diagnostic_private.admin_sessions from public;
create table if not exists diagnostic_private.admin_login_attempts (
 ip_hash text primary key,
 window_start timestamptz not null,
 attempts integer not null
);
create index if not exists admin_login_window_idx on diagnostic_private.admin_login_attempts(window_start);
alter table diagnostic_private.admin_login_attempts enable row level security;
revoke all on diagnostic_private.admin_login_attempts from public;
