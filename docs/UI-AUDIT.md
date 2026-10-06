# Auditoria incremental — 05/10/2026

Base: main d5e19c6, Express 5 / JavaScript / HTML / CSS / Supabase Auth e Postgres.

Existentes: placas PL-XXXXXX geradas por sequence, QR SVG permanente, NFC por cópia de URL, redirect /r/:code, analytics durável com retenção, histórico e auditoria, clientes/contatos/produtos/vendas, CRM/atividades, catálogos configuráveis, relatórios com períodos e backup privado. Cookies HttpOnly, CSRF, CSP, RLS e revisão concorrente são contratos preservados.

Parcial: relatórios funcionam como indicadores, sem visão operacional dedicada; cliente tem perfil operacional, mas listagem pouco hierárquica. Tema claro e navegação horizontal divergem do objetivo dark/sidebar. Sem biblioteca de ícones: usar SVG local, sem nova dependência.

Ausentes: estoque sem vínculo, geração de lote, CSV, fallback configurável e acesso final read-only. Migration aditiva amplia placas com batchId e aceita vínculos nulos exclusivamente em stock; acrescenta lote, configuração tipada e vínculo Auth→cliente. O resolver de analytics existente é reutilizado em uma única chamada. Fallback não configurado preserva 410/503 anteriores, e inexistente mantém 404.

Sem migration: design system, sidebar, login, cabeçalhos, tabelas/perfis, mensagens, exportação, rotas e views novas. Dashboard/analytics consultam o banco real, sem dados fictícios. Portal reutiliza Supabase Auth e cookies; vínculo explícito administrado, RPC sem clientId e escopo de retorno mínimo. Nenhuma policy administrativa amplia acesso aos clientes finais.

Testes adicionais: lote idempotente e sequência sem duplicação; estoque→vínculo; rollback; fallback/404/URL segura; dois clientes e IDOR; negação de mutações/rotas administrativas; backup/restauração com tabelas novas; responsividade e screenshots de todas as views. Não alterar expectativas anteriores corretas.


## Refinamento de usabilidade — 06/10/2026

Base: main f15b440. A identidade vigente é clara e azul, conforme a aprovação
mais recente e docs/DESIGN.md. A referência dark da auditoria anterior é histórica.

Atritos identificados: salvar placa apagava busca/página; filtros de referência
competiam com a busca principal; edição genérica não identificava o cadastro;
formulários e perfil exibiam informações complementares sem agrupamento;
confirmação destrutiva tinha botão genérico; faltavam cópia de código/destino/URL
permanente e mensagens claras durante salvamento e geração de lote.

Ajustes: busca, filtros e página permanecem após salvar; status/situação ficam
visíveis e filtros adicionais em Mais filtros, com resumo e limpeza; estados
vazios distinguem ausência de cadastro de ausência de resultados; formulários
usam grupos, campos obrigatórios e títulos específicos; perfil do cliente e
histórico/instalação da placa usam seções expansíveis; status no perfil usa nome
do catálogo, preservando a chave; código/URLs possuem cópia com confirmação e
alternativa manual quando o navegador nega clipboard; confirmações indicam
consequência e ação concreta; botões mostram operação e impedem repetição durante
a requisição. Lote informa códigos criados e próximos passos, preservando UUID
no retry e SVG/CSV existentes. Dashboard orienta o vínculo usando o estoque real;
relatórios agrupam os mesmos indicadores por clientes/vendas, placas e CRM.

Escopo: public/{app.css,shell.js,login.js,plates.js,manage.js,dashboard.js,reports.js},
views/{plates.html,manage.html,dashboard.html}, scripts/verify-responsive.js e
esta documentação. Sem dependência nova de produção, backend, migration ou
mudança de autenticação, API, cálculo de métricas ou GET /r/:code.

Verificação: npm run build e npm test; navegador com respostas HTTP controladas,
CSP, erros JavaScript, contraste mínimo 4.5:1 e ausência de overflow a
320/390/768/1440px e 844px em landscape. Inclui filtros/detalhes expandidos,
payload de cadastro agrupado, busca preservada após salvar, cópia e fallback,
vínculo de estoque e lote com espera, erro e retry com a mesma chave. Os testes
de interface não inserem registros no banco de produção.
