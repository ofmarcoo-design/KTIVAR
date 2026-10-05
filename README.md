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
`code`. O endereço impresso continua igual. Não há geração de QR ou
painel de cadastro neste repositório.

`database/plates.sql` registra a estrutura mínima já aplicada ao Supabase
KTIVAR. É um script de criação para um banco novo, não deve ser reaplicado
em uma tabela existente. RLS permite leitura pública apenas dos três
campos de redirecionamento; gravação pública não é permitida.
