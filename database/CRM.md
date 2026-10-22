# CRM comercial

O painel privado abre em `/admin/` com uma senha, validada pelo servidor. Todas as APIs do CRM e das métricas exigem uma sessão válida. A antiga chave no link não autoriza mais o acesso.

Configuração: `ADMIN_PASSWORD_HASH` contém um hash scrypt criado por `hashPassword` em `lib/admin-auth.js`; nunca incluir a senha em arquivos públicos ou no Git. Aplicar `database/admin-auth.sql` antes do deploy. As sessões duram até sete dias, usam cookie HttpOnly, Secure em produção e SameSite=Strict, e são revogadas pelo botão Sair. Alterar o hash da senha invalida todas as sessões anteriores. Dez tentativas por IP em quinze minutos; somente o hash do IP é armazenado. Senhas com acentos são normalizadas em NFC.

## Uso

- Antes de carregar uma lista, selecione **Imobiliária**, **Corretor** ou **Gestor imobiliário**. O perfil escolhido vale para todos os novos leads do lote e adapta as cinco mensagens. A prévia permite conferir um exemplo. Cadastros anteriores sem perfil explícito continuam classificados como Imobiliária. Duplicados não têm seu perfil alterado pela importação.
- No cadastro manual e na ficha existe o campo Perfil do lead. Alterá-lo recria as sugestões para revisão; salve para confirmar a mudança.

- Cadastre manualmente ou importe CSV/tabela colada do Excel, com cabeçalho. Há modelo para download e prévia de validação. Limite: 5.000 linhas por importação, em lotes de 200. Duplicados pelo WhatsApp ou perfil do LinkedIn são ignorados.
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

## Gestores do LinkedIn

Importar com perfil Gestor imobiliário. Colunas reconhecidas: Nome → name; Cargo → job_title; Empresa → business; Local → city; LinkedIn → linkedin. Telefone é opcional quando existe um perfil válido do LinkedIn. Há identificação única por telefone e por URL normalizada do perfil. A mesma lista pode ser importada novamente sem duplicar os contatos.

A ficha permite abrir o perfil e copiar as mensagens para envio manual no LinkedIn. Abrir o perfil ou copiar texto não muda a etapa. O WhatsApp fica desabilitado até cadastrar um número. As etapas podem ser registradas manualmente na ficha.

Migração de instalações existentes: `node --env-file=.env.local scripts/crm-schema.mjs crm-linkedin.sql`. O telefone passa a aceitar NULL e a URL do LinkedIn ganha índice único; ao menos um dos dois contatos é obrigatório no banco.

## Botão de mensagem no LinkedIn

Copiar e abrir LinkedIn copia a mensagem selecionada (incluindo as edições feitas na ficha) e abre diretamente o perfil do contato. No LinkedIn, o usuário clica em Mensagem e cola o texto. O mesmo fluxo vale para a primeira abordagem, o diagnóstico e os acompanhamentos. A mensagem não vai na URL. Não há envio automático. Se a cópia for bloqueada, o perfil não é aberto e o CRM não avança a etapa; a interface pede a cópia manual.

A preparação da abordagem fica no histórico como `linkedin_first`; a segunda como `linkedin_second`. Assim como o WhatsApp, essas ações atualizam etapa e retorno, sem confirmar envio ou entrega. Copiar o texto pelo botão separado não altera a etapa. Migração: `node --env-file=.env.local scripts/crm-schema.mjs crm-linkedin-messaging.sql`.

A abertura do perfil usa a URL do próprio cadastro, sem rota de composição de conversa. A cópia é feita antes de abrir a nova aba.
