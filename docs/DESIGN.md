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

Tipografia oficial Inter, hospedada localmente: títulos 28px/700, seções 20px/600,
corpo 14px/400, tabelas 13px, metadados 12px. Espaçamentos de 4, 8, 12, 16, 24 e 32px. Transições discretas
respeitam prefers-reduced-motion. Nenhuma dependência de frontend foi adicionada.

## Verificação

Revisar todas as views, menus e diálogos a 320/390/640/768/1440px e em landscape
844×390px. Targets de 44px, campos de 16px, foco visível, teclado, contraste de
texto mínimo 4.5:1 e ausência de overflow da página. Rolagem interna de tabelas e
Kanban é intencional; dados completos continuam acessíveis. Preservar zoom manual.

A implementação fica em public/app.css, shell.js e renderizadores existentes.
Não modifica stack, banco, autenticação, APIs, cálculo de analytics, QR ou /r/:code.

## Acabamento de identidade

Usar os SVGs oficiais em `public/brand` sem alterar caminhos, proporções ou
cores. A assinatura horizontal recebe uma base branca na sidebar marinho;
na navegação recolhida, exibir somente o símbolo original. Não duplicar o nome
em texto ao lado da assinatura. Login e portal compartilham a marca.

Topbar de 60px, alinhada aos 28px do conteúdo desktop, 20px no tablet e 16px
no celular. Breadcrumb discreto à esquerda; menu real da conta à direita.
Nome tem peso 600; e-mail secundário em 12px; avatar 34px. No celular, avatar
e chevron abrem o menu que preserva nome/e-mail e as ações Configurações/Sair.
Não adicionar Minha conta, notificações ou pesquisa sem funcionalidade.

## Sistema tipográfico oficial — Inter

Inter Variable 4.1 original em `public/fonts`, com licença OFL incluída. Única
família da interface; fallback do sistema apenas enquanto carrega/na falha.
Preload compartilhado nas views e `font-display: swap`; nenhuma CDN externa.
Logo vetorial permanece separada da fonte da interface e não foi redesenhada.
A assinatura horizontal mede 136px. Mantida a base clara na sidebar porque
os arquivos oficiais fornecidos são positivos; não fabricar versão negativa.

| Elemento | Tamanho / peso | Linha |
| --- | --- | --- |
| Título de página | 28px / 700; tablet 26px; celular 24px | 36 / 34 / 32px |
| Seção | 20px / 600 | 28px |
| Card | 16px / 600 | 24px |
| Corpo | 14px / 400 | 20px |
| Labels | 13px / 500 | 18px |
| Tabela | 13px / 400; principal 500 | 18px |
| Cabeçalho da tabela | 12px / 600 | 16px |
| Metadados | 12px / 400 | 16px |
| Botões | 14px / 500 | 20px |
| Breadcrumb | 13px / 400; atual 500 | 18px |
| Status | 12px / 500 | 16px |
| KPI | 28px / 700 | 34px |
| Título de KPI | 13px / 600 | 18px |

Tokens puros e semânticos no CSS compartilhado. Pesos aprovados: 400, 500, 600,
700. Corpo sem tracking; título -.02em; seção -.01em; categorias da sidebar
11px/500 com .08em (única exceção ao piso auxiliar de 12px). Inputs de 16px
em todas as telas mantêm o comportamento mobile existente.

Dados usam tabular-nums/lining-nums. Códigos usam Inter com tabular-nums e
slashed-zero, sem família monoespaçada adicional. Valores BRL, percentuais com
vírgula, telefones BR e datas em pt-BR permanecem; timestamps são apresentados
como data · hora no fuso de Brasília. URLs e códigos completos preservados
na cópia, QR e vínculos; não alterar dados por truncamento visual.

Validar reflow equivalente ao zoom 100%, 125%, 150% e 200% (viewport em CSS
reduzida proporcionalmente), além de ampliação de texto a 200%, responsividade,
menus, formulários e carregamento real de Inter. Não confundir emulação de
reflow com teste manual de zoom em Safari/iPhone.
