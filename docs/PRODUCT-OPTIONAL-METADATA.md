# KTIVAR — Metadados opcionais em Produtos e Serviços

## Decisão de modelagem
A categoria do produto continua sendo `categoryId`. O catálogo padrão inclui `Outro`. Não criamos novos registros em `product_categories` para nomes informados pelo usuário.

A migração `20261110165000_product_optional_metadata.sql` adiciona à tabela `products`:
- `otherLabel`: texto opcional de até 160 caracteres, exibido apenas ao escolher a categoria existente Outro/Outros.
- `description`: texto opcional de até 2000 caracteres, com múltiplas linhas.

Ambas as colunas permitem NULL; produtos antigos não precisam de backfill.

## Fluxo de interface
- Formulários de criação e edição usam o mesmo fluxo.
- O campo de identificação personalizada só aparece com a categoria Outro(s).
- Ao escolher outra categoria, o texto personalizado é ocultado, desativado e limpo.
- A descrição pode ficar vazia, ser preenchida ou removida.
- Os cartões de produto exibem descrição e identificação quando preenchidas.
- O filtro por categoria continua usando exclusivamente `categoryId`.

## API
- O backend valida os limites dos campos e resolve a categoria atual.
- Se a categoria não for Outro(s), a API força `otherLabel=null` inclusive em atualizações, prevenindo informações órfãs.
- Não altera a tabela `sale_items`, nem o snapshot histórico de vendas, nem qualquer rota QR/NFC.

## Implantação
**Obrigatório:** aplicar a migração do Supabase antes de publicar a nova versão do backend/frontend. Se os arquivos forem publicados primeiro, o PostgREST rejeitará os novos campos por coluna inexistente.

Usar o mecanismo de migrações já adotado no projeto e confirmar aplicação no banco de destino. Não fazer migração manual não rastreada.

## Validação
1. `npm ci`, `npm run security`, `npm run build`, `npm test`.
2. Navegador: testar seleção de Outros, edição, descrição multilinha, responsividade e ambos os temas.
3. Banco: verificar constraints, atualização de produtos antigos e `NULL` em campos vazios.
4. API: verificar filtro por categoria, limpeza do rótulo ao trocar a categoria e preservação de `categoryId`.
5. Confirmar compatibilidade com vendas existentes.

Esta branch deve permanecer sem merge até a migração e os testes serem revisados.
