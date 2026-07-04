## O que vou corrigir e adicionar

### 1. Correção do título e slug "geraçao"
O que aconteceu: ao gerar o artigo, o campo `title` retornado pela IA não estava sendo respeitado — o editor abriu com o texto do tema ("geraçao") em vez do título completo do artigo (que ficou só dentro do conteúdo como "# Lei do Inquilinato Atualizada...").

Correções na Edge Function `generate-blog-article` e no componente `AiArticleAssistant`:
- Reforçar o prompt para **obrigar** retorno de `title` longo (mín. 40 caracteres) e `slug` válido em kebab-case.
- Se a IA devolver título curto/vazio, usar **o título da sugestão clicada** como fallback (não o tema digitado).
- **Remover do `content` Markdown** a primeira linha `# Título` (evita duplicação, já que o título fica no campo separado).
- Recalcular `slug` sempre a partir do título final via `slugify()`.
- Garantir `excerpt` ≥ 80 caracteres; se vier curto, pedir uma 2ª passada curta só do resumo.

### 2. Banco de imagens grátis (Unsplash) como alternativa à IA
Na seção "Foto de capa" do editor de post, vou reorganizar em **3 opções lado a lado**:
1. **Colar URL** (já existe)
2. **Gerar com IA** (já existe)
3. **Buscar no Unsplash** (novo)

Novo componente `UnsplashPicker`:
- Abre um diálogo com campo de busca já pré-preenchido com palavras-chave do título do artigo (ex.: "lei do inquilinato" → "contrato aluguel imóvel").
- Mostra grade de 12 resultados (thumbnails) da API oficial do Unsplash.
- Botão "Usar esta imagem" preenche `cover_image_url` com a URL `regular` da foto escolhida.
- Crédito do autor é registrado automaticamente em `author_name`-adjacente? Não — apenas guardamos a URL; Unsplash permite hotlink direto. Para conformidade, vou disparar o endpoint de `download` do Unsplash (exigência da API) sem baixar o arquivo.

Nova Edge Function `unsplash-search` (admin-only):
- Aceita `{ query, page }` e proxya `GET https://api.unsplash.com/search/photos` usando o secret `UNSPLASH_ACCESS_KEY`.
- Também aceita `{ action: "track_download", downloadUrl }` para chamar o link `links.download_location` (exigido pelos Termos da API).

**Atenção (pedido ao usuário antes de ativar):** preciso que você gere uma chave gratuita em https://unsplash.com/developers (basta criar um app de demonstração) e me passar o **Access Key**. Vou armazená-la como secret `UNSPLASH_ACCESS_KEY`. Sem a chave, mantenho só "Gerar com IA" + "Colar URL".

### Arquivos afetados
- `supabase/functions/generate-blog-article/index.ts` — prompt mais rígido + sanitização do content
- `src/components/ai-article-assistant.tsx` — fallback de título/slug usando a sugestão
- `supabase/functions/unsplash-search/index.ts` — **novo**
- `src/components/unsplash-picker.tsx` — **novo**
- `src/routes/_authenticated/admin.blog.tsx` — botão "Buscar no Unsplash" ao lado de "Gerar capa com IA"

### Pergunta rápida
Você consegue criar a chave gratuita no Unsplash agora? Se preferir, posso implementar tudo já preparado e você só cola a chave depois — me avise.
