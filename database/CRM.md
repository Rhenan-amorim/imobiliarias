# CRM comercial

O painel privado abre o CRM e mantém as métricas em outra aba. A chave de acesso existente continua obrigatória em todas as operações da API. Não colocar a chave em arquivos públicos.

## Uso

- Antes de carregar uma lista, selecione **Imobiliária** ou **Corretor**. O perfil escolhido vale para todos os novos leads do lote e adapta as cinco mensagens. A prévia permite conferir um exemplo. Cadastros anteriores sem perfil explícito continuam classificados como Imobiliária. Duplicados não têm seu perfil alterado pela importação.
- No cadastro manual e na ficha existe o campo Perfil do lead. Alterá-lo recria as sugestões para revisão; salve para confirmar a mudança.

- Cadastre manualmente ou importe CSV/tabela colada do Excel, com cabeçalho. Há modelo para download e prévia de validação. Limite: 5.000 linhas por importação, em lotes de 200. Duplicados pelo WhatsApp são ignorados.
- Preencha imobiliária, contato, região e prioridade comercial. Revise as sugestões e edite quando necessário. A geração usa modelos com dados cadastrados, prioridade, categoria da resposta e diagnóstico vinculado; não consulta sites nem modelos de IA externos.
- Primeira abordagem abre o WhatsApp e move Novo para 1ª abordagem, com retorno em 2 dias.
- Após uma resposta, registre o conteúdo e selecione sua categoria. A segunda mensagem inclui o diagnóstico e move o lead para Em qualificação, com retorno em 3 dias.
- Marque Reunião agendada após confirmar data e horário. Marque Proposta enviada quando efetivamente enviar a proposta; informe valor e data de retorno. Termine em Ganho ou Perdido.
- Retornos, tempo na etapa e histórico ficam na ficha. Etapas avançadas não regridem ao reutilizar uma mensagem anterior.
- “Trazer diagnósticos” vincula o resultado mais recente por WhatsApp, examinando até 2.000 resultados recentes. Preserva as etapas dos leads já existentes. Novos contatos sem autorização comercial recebem “Não contatar”.

O botão registra uma tentativa de abertura do WhatsApp; o usuário conclui o envio. Não existe confirmação automática de entrega, leitura ou resposta. Não há disparo em massa.

## Celular

Até 700 px, o CRM abre em lista de cartões. Cada lead tem Abrir lead e um botão para a mensagem da etapa atual. O atalho usa o texto salvo na ficha, abre o WhatsApp e registra a ação; o usuário conclui o envio. O resumo pode ser expandido. Busca, filtros, perfil e histórico continuam disponíveis. A ficha tem navegação entre Mensagens, Dados do lead e Histórico.

## Implementação e validação

Migration aditiva: `database/crm.sql`, aplicada por `node --env-file=.env.local scripts/crm-schema.mjs`. Tabelas com RLS e sem permissões públicas; acesso pelo backend autenticado. Alterações de ficha usam bloqueio transacional e versão para prevenir perda de atualização. Eventos de mensagem têm identificador idempotente.

`npm test`: testes de autenticação, validação, mensagens, importação, etapas e métricas. Fluxo integrado validado com cadastros sintéticos: API → banco → histórico → resposta; UI de cadastro, edição e importação. Os cadastros de teste foram removidos, sem mensagens enviadas.
