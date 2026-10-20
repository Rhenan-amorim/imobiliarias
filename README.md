# Amorim Soluções Digitais — Diagnóstico Imobiliário

Landing page: https://amorim-diagnostico-imobiliarias.vercel.app
Painel privado: https://amorim-diagnostico-imobiliarias.vercel.app/admin/

## Estrutura

- dist/: landing page e recursos estáticos.
- src/dashboard.js: painel, login por código de e-mail e exportação CSV.
- api/collect.js: validação, cálculo da nota no servidor e coleta de eventos.
- api/dashboard.js: consultas autorizadas por JWT do Neon Auth.
- database/schema.sql: esquema inicial já aplicado no novo banco Neon. Não executar novamente sobre o banco criado.

Banco e autenticação: Neon, plano Free, provisionado pela Vercel Marketplace. Credenciais de banco permanecem no servidor. A API exige JWT EdDSA válido, emissor e audiência do Neon configurado e email verificado igual a rhenanamorim230@gmail.com. As tabelas têm RLS e nenhuma permissão pública. Um JWT já emitido pode continuar válido até expirar, mesmo depois da saída no navegador.

## Métricas

Sessões usam identificador aleatório no armazenamento da aba, renovado após 30 minutos sem atividade registrada. Não representam pessoas únicas. O funil conta sessões com acesso no período; considera os eventos até o fim do período selecionado. Cliques são eventos recebidos, separados de sessões com clique. Abrir WhatsApp não confirma envio de mensagem ou venda.

Desistência: início sem conclusão e sem evento há mais de 30 minutos. Taxa = desistências / (conclusões + desistências). Sessões em andamento ficam fora do denominador. Última etapa considera perguntas e formulário final. Contatos e notas médias consideram formulários concluídos no período. Origem usa utm_source, utm_medium e utm_campaign.

Há limitação de requisições para reduzir abuso. Bloqueadores, falta de conexão e tráfego automatizado podem afetar os números. Não há dados retroativos.

Nome, imobiliária, região, telefone e email opcional são enviados apenas na conclusão do formulário. A autorização de contato comercial é opcional e guardada. O aviso de privacidade está na landing page. A exportação CSV neutraliza entradas com aparência de fórmulas.

## Desenvolvimento e publicação

npm ci --legacy-peer-deps
npm run build
npm test
node --env-file=.env.local scripts/dev.mjs

Prévia: http://localhost:4174. Variáveis locais vêm de vercel env pull .env.local e são ignoradas pelo Git. Nunca compartilhar esse arquivo. A branch main está conectada à Vercel; o build gera dist/dashboard.js, publica dist e as APIs de api/.

O Neon Auth usa inicialmente sua entrega compartilhada de e-mail. Para operação com controle de entregabilidade e remetente, configurar SMTP próprio conforme a documentação Neon. Não há envio de email comercial automatizado.
