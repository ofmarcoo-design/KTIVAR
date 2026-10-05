# Auditoria incremental — 05/10/2026

Base: main d5e19c6, Express 5 / JavaScript / HTML / CSS / Supabase Auth e Postgres.

Existentes: placas PL-XXXXXX geradas por sequence, QR SVG permanente, NFC por cópia de URL, redirect /r/:code, analytics durável com retenção, histórico e auditoria, clientes/contatos/produtos/vendas, CRM/atividades, catálogos configuráveis, relatórios com períodos e backup privado. Cookies HttpOnly, CSRF, CSP, RLS e revisão concorrente são contratos preservados.

Parcial: relatórios funcionam como indicadores, sem visão operacional dedicada; cliente tem perfil operacional, mas listagem pouco hierárquica. Tema claro e navegação horizontal divergem do objetivo dark/sidebar. Sem biblioteca de ícones: usar SVG local, sem nova dependência.

Ausentes: estoque sem vínculo, geração de lote, CSV, fallback configurável e acesso final read-only. Migration aditiva amplia placas com batchId e aceita vínculos nulos exclusivamente em stock; acrescenta lote, configuração tipada e vínculo Auth→cliente. O resolver de analytics existente é reutilizado em uma única chamada. Fallback não configurado preserva 410/503 anteriores, e inexistente mantém 404.

Sem migration: design system, sidebar, login, cabeçalhos, tabelas/perfis, mensagens, exportação, rotas e views novas. Dashboard/analytics consultam o banco real, sem dados fictícios. Portal reutiliza Supabase Auth e cookies; vínculo explícito administrado, RPC sem clientId e escopo de retorno mínimo. Nenhuma policy administrativa amplia acesso aos clientes finais.

Testes adicionais: lote idempotente e sequência sem duplicação; estoque→vínculo; rollback; fallback/404/URL segura; dois clientes e IDOR; negação de mutações/rotas administrativas; backup/restauração com tabelas novas; responsividade e screenshots de todas as views. Não alterar expectativas anteriores corretas.
