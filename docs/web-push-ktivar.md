# KTIVAR — Web Push de lembretes (PWA)

A infraestrutura foi provisionada no projeto Supabase `owovkiijgiaujsirctgq` sem contratação de serviços. No iPhone, é necessário iOS 16.4+ e o KTIVAR instalado como aplicativo na Tela de Início.

## Componentes e frequência

- `public.ktivar_reminders`: lembretes por usuário, persistentes e protegidos por RLS.
- `public.ktivar_push_subscriptions`: inscrições autorizadas de dispositivos, protegidas por RLS.
- `public.ktivar_push_dispatch_config`: configuração **privada**, somente `service_role`; nunca expor em clientes.
- `public.ktivar_claim_due_reminders`: RPC restrita ao `service_role`, marca lotes para envio com travamento.
- `supabase/functions/ktivar-push-dispatch/index.ts`: envio Web Push criptografado, chave de invocação verificada por SHA-256.
- `pg_cron` job `ktivar-push-reminders-dispatch` (a cada minuto) invoca a Edge Function por `pg_net` com token interno.
- A tabela antiga `ktre_on` e o respectivo agendamento continuam independentes e intactos.

**Credenciais não são versionadas:** VAPID private key e o hash do token ficam apenas na configuração privada do banco; o token de invocação fica apenas na definição do job interno. Para provisionar um ambiente novo, gerar novas credenciais e ajustar somente no ambiente seguro. Nunca copiar chaves privadas para GitHub, navegador ou README.

## Teste real no iPhone

1. Acessar `https://ktivar.kimzan.com.br/notifications` pelo ícone do KTIVAR na Tela de Início, já autenticado.
2. Tocar **Ativar notificações push**, aceitar a permissão e conferir **Push ativo neste aparelho**.
3. Tocar **Agendar teste para daqui a 2 minutos**.
4. Fechar o aplicativo e bloquear o iPhone.
5. Conferir se o push apareceu na Tela Bloqueada. A entrega pode atrasar pela rede, iOS ou execução agendada.
6. Se falhar, inspecionar o histórico `cron.job_run_details` do job 3, `net._http_response`, logs da Edge Function, status da inscrição e permissão do iOS.

O teste local `Autorizar e enviar teste` prova apenas a apresentação imediata; **não** prova Web Push remoto.

## Controles de segurança

As rotas de usuário estão atrás de `authenticate` no servidor, o PostgreSQL tem RLS por `auth.uid()`, o despachante aceita somente um segredo de cron, e destinos push devem pertencer a provedores HTTPS conhecidos. A função nunca expõe chaves de envio e o Service Worker não armazena respostas privadas em cache.

As inscrições anteriores no navegador não migram automaticamente; o usuário as ativa no dispositivo. Lembretes antigos armazenados localmente podem ser importados opcionalmente.

## Limites

Isso não substitui um despertador nativo e não oferece SLA ou precisão de segundos. A suspensão por inatividade do Supabase Free interrompe o agendador até a recuperação do projeto. O monitor externo GitHub existente reduz o risco, mas não elimina essa limitação.

A publicação do GitHub na hospedagem deve ser verificada separadamente. Não declarar entrega concluída no iPhone antes da notificação real aparecer com o app fechado.
