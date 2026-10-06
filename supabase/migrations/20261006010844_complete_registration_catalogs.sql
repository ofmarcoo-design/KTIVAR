-- Complete existing catalogues without replacing IDs, names or user configuration.
-- Case-insensitive existence checks make this seed safe to replay.
do $$
declare catalog text; label text; labels text[];
begin
 for catalog, labels in select * from (values
  ('client_segments', array['Alimentação e bebidas','Comércio e varejo','Saúde e bem-estar','Beleza e estética','Serviços profissionais','Educação','Hotelaria e turismo','Imobiliário','Automotivo','Eventos e entretenimento','Tecnologia','Indústria','Organizações e associações','Pessoa física','Outro']),
  ('client_sources', array['Google','Facebook','Prospecção direta','Evento','Outro']),
  ('product_categories', array['Placas inteligentes','Cartões e tags NFC','Displays e totens','Serviços digitais','Instalação e suporte','Personalização','Outro']),
  ('product_types', array['Outro']),
  ('tags', array['Novo cliente','Recorrente','Prioritário','Parceiro','Outro']),
  ('activity_types', array['E-mail','Visita','Demonstração','Outro']),
  ('loss_reasons', array['Prazo','Concorrência','Sem orçamento','Projeto adiado','Outro'])
 ) as defaults(catalog,labels)
 loop
  foreach label in array labels loop
   execute format('insert into public.%I(name,position) select $1,least(coalesce(max(position),-1)+1,100000) from public.%I where not exists(select 1 from public.%I where lower(trim(name))=lower($1)) having not exists(select 1 from public.%I where lower(trim(name))=lower($1))',catalog,catalog,catalog,catalog) using label;
  end loop;
 end loop;
end $$;
