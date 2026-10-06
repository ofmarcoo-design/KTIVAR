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

## Interface B2B híbrida — 06/10/2026

Base: main 3ecb982. Revisão das dez áreas administrativas com screenshots e
navegação em navegador antes da edição. Atritos restantes: sidebar clara e
métricas coloridas competiam com conteúdo; cabeçalho repetia marca e e-mail;
toolbars ocupavam linhas separadas; nomes/URLs longos aumentavam linhas e
quebravam códigos; dashboard repetia intervalos de Analytics; Kanban não mostrava
contagem/estimativa nem orientava criação em uma coluna vazia.

Padrão global em app.css e shell.js: marinho/off-white/white, métricas neutras,
escala tipográfica, espaços, sidebar recolhível e drawer existente, cabeçalho com
contexto, conta real com logout existente, toolbar compacta e chips removíveis,
tabelas com hover/cabeçalho sticky no scroll interno, diálogos/contexto e estados
interativos. Nome do cliente abre perfil; telefone ganha formatação de leitura.
Placas priorizam código/status/cliente/destino/acessos; produto é informação
secundária do cliente e permanece integral na visualização. Código abre placa,
estoque oferece Vincular, demais placas oferecem Editar destino. Cópia usa URL
completa, nunca a versão resumida. Campos continuam acessíveis no modal.

Dashboard: três indicadores reais (clientes cadastrados, placas ativas e acessos
em 30 dias), estoque e atividades atrasadas pela API já existente, atividade
recente e quatro atalhos que abrem os formulários atuais. Clientes não foram
renomeados para ativos, pois a consulta de overview conta todos. Atividades
paginadas exibem 50+ quando necessário e não inventam total exato. Consulta lenta ou falha nessa
consulta não bloqueia nem apaga as métricas disponíveis. Analytics mantém Hoje/7/30/Total,
prioriza ranking e torna a explicação de contagem secundária.

CRM: largura operacional e scroll interno, soma de estimativas dos registros
carregados (explicitamente nesta página), responsável, próxima ação e indicador
de compra preservado. Criação no estado vazio seleciona a etapa correspondente.
Obrigatoriedade de ação/data reflete requiresFollowup existente; fechamento/perda
mantêm as regras anteriores. Links de atividade recente reutilizam GET/formulários
existentes para clientes, produtos, vendas, negociações e atividades.

Não implementados: gráficos/tendências sem séries confiáveis, receita nova no
dashboard, pendências inferidas de clientes, Minha conta sem tela existente,
command palette, temas personalizáveis e widgets. São elementos sem dados ou
valor suficiente para esta etapa. Sem backend/migration/dependência de produção.

Validação: build, os 13 testes existentes (incluindo Auth, RLS, migrations,
transações, redirect e QR) e scripts/verify-responsive.js. Este último percorre
todas as views, filtros/detalhes/menu expandidos, contraste e overflow em seis
viewports; cobre criação/edição de cliente, criação/vínculo de placa, destino sem
mudança do QR, lote com erro/retry idempotente, downloads, chips/períodos,
sidebar, atalhos, exigência de follow-up/movimentação, settings e login/logout.
Respostas HTTP controladas nos testes visuais não alteram registros de produção.

## Identidade e cabeçalho — 06/10/2026

Refinamento sobre a versão existente: SVGs oficiais intactos, assinatura na
sidebar/login/portal, símbolo na sidebar recolhida e favicon. Topbar permanece
60px e mantém a grid do conteúdo. Nome Marco Ferratti/MF associado exclusivamente
a ofmarcoo@gmail.com na apresentação; e-mail secundário. Outras contas preservam
sua identidade. Menu tem somente Configurações e Sair. Categorias redundantes
removidas das views; breadcrumbs corrigidos para Gestão e Visão operacional.

Revisão visual de Dashboard, Clientes, Placas, Analytics, CRM, Produtos, Vendas,
Atividades, Relatórios, Configurações, Login e Portal. Verificação Chromium em
320×640, 390×844, 640×900, 768×1024, 1440×900 e 844×390: contraste, overflow,
logo carregada, nome/avatar/menu, cadastro/edição, QR, lote, configurações e
logout/login. Fluxos HTTP controlados, sem inserir dados no banco de produção.
Também conferida identidade de outra conta para impedir rótulo indevido.
Build: 25 arquivos JavaScript válidos. npm test: 13/13, incluindo migrations
e contratos de autenticação, redirect e QR. Nenhuma alteração em Auth, schema,
APIs, métricas ou hosting.

## Inter e gramática tipográfica — 06/10/2026

Aplicado o briefing Texto colado(20261006-203826).txt à arquitetura existente.
Inter Variable 4.1 original local, com licença OFL, fonte/proveniência e preload
em todas as views. Pesos 400/500/600/700, tokens compartilhados, títulos
28/26/24px, seções 20px, corpo 14px, tabelas 13px, auxiliares 12px. Inputs
preservam 16px; categorias da sidebar 11px são a exceção explícita do briefing.
KPIs 28px/700; códigos Inter com numerais tabulares e zero cortado; dados
numéricos tabulares. Timestamp de apresentação pt-BR: data · hora, Brasília.

Logo Proposta 3 intacta, assinatura 136px. Mantida a base branca da sidebar:
nenhum arquivo oficial negativo foi fornecido, não se redesenhou a marca.
Paleta, layout, APIs, Auth, banco, métricas, QR/NFC/redirect permanecem.

Revisão visual de todas as telas administrativas, portal/login e formulários.
Verificação de font-face realmente carregada, contraste, sem overflow, menus,
cadastro/edição, lote e QR nos seis viewports existentes. Checagem adicional
de reflow equivalente a zoom 100/125/150/200% em sete views e formulário de
placa, e ampliação real de texto a 200% na listagem/formulário. Não equivale
a um ensaio manual em todos os navegadores/dispositivos. Responses HTTP de
verificação são controladas; nenhum registro alterado no banco de produção.
Build 25 JS, npm test 13/13. O teste de navegador recebeu limpeza de intercept
pendente e espera explícita pela abertura de diálogos antes das asserções.
