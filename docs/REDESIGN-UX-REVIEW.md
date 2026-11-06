# KTIVAR — Redesign estruturado para revisão

## Referências e decisão de design

Implementação incremental baseada na direção visual aprovada: Studio Admin claro como linguagem de densidade, BentoFlow para blocos compactos e PartnerMesh para análise discreta. Modo escuro do KTIVAR permanece disponível. A identidade da marca e os tokens azuis oficiais não mudam. A tela de conceito é inspiração, não uma fonte de dados ou funções.

## Implementação nesta branch

### Dashboard
- Quatro KPIs reais: clientes cadastrados, placas ativas, placas em estoque e acessos registrados em 30 dias.
- Primeiro nível mais compacto, com cartões de mesma altura.
- Área analítica renovada, com as janelas reais hoje, sete dias, trinta dias e total.
- Ranking de placas em barras horizontais relativas ao maior valor retornado pela API; rótulos e contagens permanecem disponíveis.
- Oportunidades, resultados comerciais, atividades atrasadas e atividade recente continuam com os endpoints e significados originais.

**Nota sobre gráficos:** a API `/api/overview` usada nesta tela expõe totais por janela, não uma série temporal diária. Não foi criada uma curva fictícia nem um filtro que promete dados que não existem. A eventual introdução de gráfico diário depende de uma consulta real e de revisão do backend.

### Base compartilhada
- Superfícies neutras, tipografia, controles, cards, navegação, tabelas, mensagens, filtros, formulários, modais, paginação, Kanban e relatórios recebem o mesmo conjunto de regras CSS.
- Padronização de espaçamento, cantos e elevação discreta.
- O ativo de cada módulo é identificado pela URL exclusivamente para futura composição visual; não afeta requisições, tabelas ou navegação.
- As seleções Claro/Escuro/Automático e o armazenamento da preferência existente não mudam.
- Placas, clientes, produtos, vendas, CRM, atividades, relatórios e configurações compartilham o refinamento dos componentes sem reescrita de renderizadores.

## Limites e riscos

Não houve atualização de esquema, autenticação, API, cálculo comercial, configurações dinâmicas ou destinos QR/NFC. Uma base CSS compartilhada pode provocar regressão visual; aprovação do build não é validação de UX.

O objetivo de 9/10 é uma meta subjetiva e requer avaliação nas telas reais. Não declarar o redesign concluído sem screenshots e revisão.

## Checklist obrigatório para aprovação

- [ ] `npm ci`
- [ ] `npm run security`
- [ ] `npm run build`
- [ ] `npm test`
- [ ] Desktop e mobile reais em 320, 390, 640, 768, 1024 e 1440px
- [ ] Claro / Escuro / Automático em todos os módulos
- [ ] Modais, filtros, tabelas, Kanban, links e estados de erro
- [ ] Teclado, foco, zoom 200% e reflow
- [ ] Capturas reais de antes/depois do Dashboard e de Clientes, Placas, CRM, Vendas, Produtos, Analytics, Relatórios e Configurações
- [ ] Aprovação visual explícita antes de merge

## Como continuar

Manter a branch isolada. Depois dos testes automáticos, realizar screenshots comparativos por navegador autorizado; corrigir qualquer layout fora da referência. Só integrar na `main` quando o usuário validar a melhoria real.
