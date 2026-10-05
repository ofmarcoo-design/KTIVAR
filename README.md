# KTIVAR — redirecionamento de placas

Servidor Express / Node 20. Execute `npm install`, `npm run build`,
`npm test` e `npm start`. Não há etapa de compilação de frontend;
o build verifica a sintaxe do servidor.

Variáveis existentes: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e
`PORT` (opcional, padrão 3000).

## QR fixo, destino editável

O QR físico e a tag NFC devem conter apenas
`https://<dominio>/r/PL-000143`. Nunca grave `destinationUrl` no QR.

A rota pública `GET /r/:code` consulta `public.plates` em cada acesso:

- `code`: identificador único no formato PL-XXXXXX.
- `active`: booleano; apenas `true` permite o redirecionamento.
- `destinationUrl`: endereço HTTP/HTTPS atual.

Retornos: 302 (ativa), 404 (inexistente/código inválido), 410 (inativa),
503 (banco/configuração/destino indisponível). Todas as respostas da rota
usam `Cache-Control: no-store`.

Para mudar o destino, atualize somente `destinationUrl`, preservando
`code`. O endereço impresso continua igual. O painel gera o QR desta URL permanente,
sem gravar o destino final dentro do QR.

`database/plates.sql` registra a estrutura mínima já aplicada ao Supabase
KTIVAR. É um script de criação para um banco novo, não deve ser reaplicado
em uma tabela existente. RLS permite leitura pública apenas dos três
campos de redirecionamento; gravação pública não é permitida.

## Módulo de placas — etapa 1

A página principal leva a `/plates`; sem sessão válida, abre `/login`.
O login usa e-mail e senha do Supabase Auth. Tokens ficam em cookies
HttpOnly, SameSite=Lax e Secure quando servido em HTTPS, com renovação
pela sessão do Supabase. Nenhuma chave secreta ou senha fica no frontend.

O painel permite cadastrar, editar, visualizar e listar placas, com busca
pelo código e paginação. O código PL-XXXXXX é gerado por sequência no banco
e não pode ser alterado. Um cliente pode ter várias placas.

Campos: cliente obrigatório; produto opcional; status (pendente, ativa,
inativa); finalidade; local de instalação; destino HTTP/HTTPS; NFC
opcional; data de entrega opcional; criação e atualização automáticas.
O código da placa também identifica o QR, evitando um campo redundante.
`active` é sincronizado pelo banco com o status para preservar a rota
pública existente.

Como não existiam cadastros de referência, o formulário inclui criação
mínima de cliente (nome, empresa e telefone opcionais) e produto (nome).
A geração de QR foi adicionada na etapa 2. Não há scans, histórico de destinos
ou integração NFC.

### Autorização

O acesso ao módulo exige uma linha em `public.plate_access` com o ID do
usuário do Supabase Auth. A conta inicial é `ofmarcoo@gmail.com`; sua senha
foi entregue separadamente e não é versionada. Não há inscrição pública
na interface. Mesmo um usuário autenticado do Supabase não consegue ler
ou alterar os cadastros sem autorização explícita.

Para autorizar outro usuário: crie-o em Supabase → Authentication → Users
e execute no SQL Editor, substituindo o e-mail:

```sql
insert into public.plate_access ("userId")
select id from auth.users where lower(email) = lower('usuario@exemplo.com')
on conflict do nothing;
```

Para revogar acesso, exclua sua linha de `plate_access`. Os usuários
explicitamente autorizados compartilham a gestão de todas as placas.
Dados de clientes, produtos, NFC e instalação não têm acesso público.

### Verificação

`npm run build` valida a sintaxe do servidor, módulo e scripts da interface.
`npm test` cobre a rota existente, validação de dados, login, autorização,
renovação de sessão, logout e proteção de origem. O projeto é JavaScript,
portanto não há TypeScript nem etapa de `tsc`.

As migrations desta etapa estão em `supabase/migrations` e já foram
aplicadas ao banco KTIVAR. Elas pressupõem a tabela `plates` original
registrada em `database/plates.sql`. Não execute esse script de criação
novamente no banco existente.

`scripts/verify-plates.js` é um teste opt-in com banco real e variáveis
`TEST_EMAIL`/`TEST_PASSWORD`. Ele cria registros temporários e imprime
`CLEANUP_IDS` para remoção administrativa após o teste. Não faz parte do
`npm test` e não contém credenciais.

## QR Code — etapa 2

A visualização de cada placa mostra o QR, o código, a URL permanente e o
destino atual. “Baixar QR para impressão (SVG)” entrega um arquivo vetorial,
preto sobre branco, com margem de quatro módulos, sem perda de resolução.

A URL codificada é exclusivamente `https://<host-da-requisição>/r/PL-XXXXXX`.
O host vem da requisição da aplicação, sem domínio fixo ou configuração
adicional de hosting. O protocolo público é sempre HTTPS, inclusive quando
a Hostinger termina o TLS antes do servidor Express. `destinationUrl` não
participa da geração; editar o destino não altera o QR para o mesmo domínio.

`GET /api/plates/:code/qr.svg` reutiliza autenticação e consulta a existência
da placa no Supabase. `?download=1` envia o SVG como anexo. Placas inexistentes
retornam 404 e usuários sem autorização não acessam a geração. A biblioteca
`qrcode` está fixada na versão 1.5.4, com dependências registradas no lockfile.
Não houve alterações no banco ou em `GET /r/:code`.

## Responsividade — regra para todas as etapas

Todas as telas existentes e futuras devem funcionar em celular e desktop.
Preserve o viewport mobile, campos com fonte de pelo menos 16px e ações com
área de toque de pelo menos 44px. Valide telas estreitas a partir de 320px,
tablets e desktop, incluindo conteúdo longo e diálogos com rolagem vertical.
Não esconda dados ou ações necessários apenas por falta de espaço.

A listagem usa tabela em desktop e cartões rotulados até 900px. Formulários,
paginação, login e visualização do QR se adaptam às telas menores, sem exigir
rolagem horizontal da página. O SVG baixado mantém sua resolução vetorial.
