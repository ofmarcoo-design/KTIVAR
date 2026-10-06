# KTIVAR — design para operação

Referência de partida: DESIGN-dell-1996.md, enviado por Marco. A adaptação usa
blocos de cor chapada, títulos fortes, separação por bordas e uma hierarquia
visível. Cada tela deve facilitar encontrar, cadastrar, conferir e editar dados.

## Paleta

| Papel | Cor | Aplicação |
| --- | --- | --- |
| Canvas | #F3F6FB | Fundo da plataforma |
| Superfície | #FFFFFF | Navegação, cartões, formulários e diálogos |
| Texto | #17243B | Títulos e conteúdo principal |
| Texto secundário | #52647D | Contexto, rótulos auxiliares e datas |
| Azul | #2563EB | Ação principal, seleção e navegação |
| Azul claro | #E8F1FF / #1E40AF | Informação e indicadores gerais |
| Verde | #E7F6EC / #166534 | Sucesso, confirmação, conclusão e estado ativo |
| Amarelo | #FFF4CE / #854D0E | Pendências e tarefas abertas |
| Vermelho | #FEECEC / #991B1B | Erros, perdas, atrasos e ações destrutivas |

Toda cor de estado acompanha texto. As cores já configuradas pelo usuário nos
catálogos permanecem como identificadores. Placas com redirect habilitado usam
sinalização de sucesso; estoque informa que cliente e destino serão vinculados
depois. Valores de relatório mantêm o cálculo e o período existentes.

## Componentes

Ação principal azul; controles auxiliares claros com borda; concluir uma tarefa
verde; cancelar venda, revogar acesso e desabilitar redirect vermelho. Confirmações
mantêm o botão Cancelar e foco inicial nele. Mensagens usam tom explícito para
sucesso ou erro. Conteúdo de texto é inserido com textContent.

Indicadores usam cartões com cabeçalho separado, faixa superior de cor e números
legíveis. Tabelas preservam cabeçalhos no desktop e rótulos por campo no celular.
Campos possuem rótulos, escolhas reais, contraste, foco visível e tamanho de fonte
mínimo de 16px. O QR permanece preto sobre branco para impressão e leitura.

Tipografia sans-serif do sistema, títulos com peso forte, bordas de 1px, cantos
de 6–8px, espaçamento regular e ausência de elementos decorativos que concorram
com o conteúdo. Apenas diálogos usam sombra para indicar sobreposição.

## Verificação

Validar 320px, 390px, 768px, desktop 1440px e orientação landscape 844×390px.
Ações devem ter área de toque de pelo menos 44px. Preservar zoom manual e
rolagem vertical dos diálogos. Inspecionar contraste mínimo de texto de 4.5:1,
navegação por teclado, foco e informações que dependem de cor.

A implementação fica em public/app.css e nos renderizadores existentes. O design
não muda a stack, o banco, a autenticação, a permanência do QR nem GET /r/:code.
