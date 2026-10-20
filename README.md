# Amorim Soluções Digitais — Diagnóstico Imobiliário

Site estático responsivo, sem dependências de build. Os arquivos publicáveis estão em `dist/`.

Fluxo: abertura → 11 perguntas → identificação do negócio → diagnóstico com notas por pilar, recomendações, teste opcional de busca, download em texto e WhatsApp.

WhatsApp comercial configurado em `dist/app.js`: 5521971146102.

Para visualizar localmente, execute `python -m http.server 4173 --directory dist` nesta pasta e abra http://localhost:4173.

O diagnóstico funciona integralmente no navegador. Não há banco de leads, rastreamento ou envio automático de informações. O botão final abre o WhatsApp com o resumo para o próprio visitante enviar. A identificação não exige telefone. Uma futura captura em CRM ou banco precisa de integração de servidor e atualização do aviso de privacidade.

A pontuação mede processos declarados: nove respostas de 0 a 3 pontos, três por pilar, convertidas em índices de 0 a 100. Não realiza auditoria de SEO ou consulta automática às IAs e não estima receita perdida. As duas perguntas iniciais contextualizam o perfil e não alteram a nota.

Fontes externas: Google Fonts, com fontes locais de fallback. Os nomes de imobiliárias na ilustração são fictícios e o cartão está identificado como simulação.
