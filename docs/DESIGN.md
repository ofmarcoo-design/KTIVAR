# KTIVAR — interface operacional B2B

A estrutura existente permanece: Operação, Comercial e Sistema. A direção visual
atual usa sidebar marinho, área de trabalho off-white e superfícies brancas.
O azul identifica ação principal, foco, links e seleção. Indicadores ficam neutros,
com cores semânticas discretas em estados e pendências, sempre acompanhadas de texto.

## Tokens compartilhados

| Papel | Cor |
| --- | --- |
| Sidebar | #0F172A |
| Texto da sidebar | #CBD5E1; ativo #F8FAFC |
| Superfície ativa da sidebar | #1E293B |
| Canvas | #F6F8FC |
| Superfície | #FFFFFF |
| Borda | #E2E8F0 |
| Texto | #0F172A |
| Texto secundário | #334155 |
| Metadados | #5B6B82, com contraste no canvas |
| Ação primária | #2563EB; hover #1D4ED8 |
| Sucesso | verde discreto |
| Pendência/estoque | âmbar |
| Inativo/neutro | cinza |
| Erro/atraso/ação destrutiva | vermelho |

Cores configuradas de status/etapas são preservadas como identificadores. Estoque
não representa erro; inativo não usa vermelho automaticamente. Métricas não
mudam cálculos, filtros, data de referência nem semântica.

## Componentes

Uma ação primária por página. Ações auxiliares usam borda ou texto; exportação é
terciária. Cabeçalho de 60px com contexto em dois níveis e menu de conta que mostra
o e-mail real, Configurações e Sair. Não existe link fictício de Minha conta.
Sidebar recolhível no desktop, drawer no tablet/celular, labels acessíveis e
preferência de largura local; sem alteração de permissões ou dados de usuário.

Toolbar reúne busca com debounce, filtro frequente, Mais filtros e atualização.
Filtros aplicados possuem chips removíveis e limpeza geral. Resultados e valores
do Kanban referem-se à página consultada; não apresentam total global inexistente.

Tabelas mantêm cabeçalho discreto, hover, primeira coluna identificável e ações
contextuais. Nome do cliente e código da placa abrem o registro. URL resumida
mantém a versão completa no tooltip e na cópia; instalação/vínculos e outros
campos permanecem na visualização. No celular, tabelas viram cartões rotulados.
Quadro CRM possui rolagem interna, contagem/estimativa por etapa na página e
estado vazio compacto com criação na etapa correspondente. Regras já existentes
de próxima ação obrigatória são refletidas pelos campos do formulário.

Diálogos usam contexto, título, grupos de campos e footer Cancelar/Ação. Foco
inicial de confirmação destrutiva continua em Cancelar. Clipboard tem confirmação
e seleção manual se bloqueado. QR segue vetorial, preto sobre branco, codificando
somente a URL permanente da placa. Campos textuais são inseridos com textContent.

Tipografia do sistema: títulos 28–30px/700, seções 18–20px/600, corpo 14–16px,
metadados 12–13px. Espaçamentos de 4, 8, 12, 16, 24 e 32px. Transições discretas
respeitam prefers-reduced-motion. Nenhuma dependência de frontend foi adicionada.

## Verificação

Revisar todas as views, menus e diálogos a 320/390/640/768/1440px e em landscape
844×390px. Targets de 44px, campos de 16px, foco visível, teclado, contraste de
texto mínimo 4.5:1 e ausência de overflow da página. Rolagem interna de tabelas e
Kanban é intencional; dados completos continuam acessíveis. Preservar zoom manual.

A implementação fica em public/app.css, shell.js e renderizadores existentes.
Não modifica stack, banco, autenticação, APIs, cálculo de analytics, QR ou /r/:code.
