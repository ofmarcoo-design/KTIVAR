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
terciária. No desktop, cabeçalho original de 60px com breadcrumb e menu da conta:
nome, e-mail, Configurações e Sair. No mobile, a conta fica em Configurações.
Não existe link fictício de Minha conta.
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

Padrão de topbar desktop (preservado):
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

## Dashboard operacional

Analytics aparece primeiro, com hoje, 7/30 dias e total, junto ao ranking real
de placas em 30 dias. Não representa visitantes únicos nem avaliações.
Clientes, placas ativas e estoque formam o panorama operacional: estoque é
inventário, não alerta. Resultados comerciais usam o relatório existente do
mês até hoje em Brasília, comparando datas explícitas do intervalo anterior
de igual duração; vendas canceladas são excluídas. Produtos exibem até três
resultados por valor vendido. CRM mostra até cinco negociações abertas mais
recentes, com etapa e estimativa, sem confundir estimativa com receita ou
apresentar a página consultada como funil global. Acompanhamento reúne até
quatro atividades atrasadas e auditoria recente. Atalhos preservam os fluxos
de cadastro existentes.

Resumos complementares carregam independentemente de Analytics e operação.
Erros não viram totais zero; atualização descarta respostas de ciclos antigos.
Composição modular usa tokens e componentes compartilhados, sem bibliotecas,
novas consultas de banco, mudanças de API, autenticação ou redirect. Analytics
continua usando somente sua consulta original.

## Navegação inferior e conta em Configurações

Nas views administrativas, desktop mantém o cabeçalho original, breadcrumb,
menu da conta e sidebar recolhível. Até 900px, a barra superior fica oculta; Clientes, Placas e Analytics têm navegação
inferior persistente com ícones existentes e rótulos; Menu abre a mesma sidebar
com todos os módulos, incluindo Dashboard e Configurações. Se a página estiver
fora dos três atalhos, Menu indica o contexto atual. Não adicionar um quinto
atalho sem uma tarefa frequente que justifique sua presença.

Barra considera safe-area e reserva espaço no conteúdo. O drawer tem botão
Fechar, backdrop, Escape, retorno de foco e ciclo de Tab; conteúdo e barra ficam
inert durante sua abertura. Redimensionar restaura a navegação adequada.
No mobile, Configurações mostra a identidade da sessão, avatar textual, e-mail e o mesmo
botão Sair com seu handler existente, sem nova página de conta. Login e portal
permanecem com suas estruturas próprias.

## Revisão dos formulários e buscas

- Feedback de validação junto ao campo em `shell.js`, com `aria-invalid`,
  `aria-describedby` e texto explicativo; preserva validação nativa e dados digitados.
- Valores monetários aceitam decimal brasileiro e colagem de `R$ 1.234,56`,
  sem arredondar casas excedentes ou usar floats no cálculo de centavos.
- Quantidade de venda limitada a 1–1000, desconto limitado ao valor do item,
  pelo menos um item; mesmas regras já existentes no backend.
- Campos de telefone, e-mail e endereço usam autocomplete adequado; quantidade
  usa teclado numérico. Observação aceita múltiplas linhas e datas opcionais
  começam vazias. A UF aceita duas letras, sem exigir endereço completo.
- Negociação de atividade consultada apenas para o cliente escolhido; troca de
  cliente limpa o vínculo anterior. Edições preservam vínculos existentes.
- Buscas preservam seleções e descartam respostas antigas. Visualização e
  histórico de placa também descartam respostas de consultas anteriores.
- Geração de placa pela venda mantém a confirmação e o código após atualizar
  o perfil. QR, destino público, autenticação e banco permanecem nos padrões atuais.

`npm test` verifica migrations e regras de negócio.
`scripts/verify-responsive.js` inclui casos de colagem monetária, limites,
feedback acessível, vínculos por cliente, buscas concorrentes e confirmação de
gerar placa, além de revisão das views em seis tamanhos e zoom até 200%.
