## Objetivo
Substituir a abordagem atual (múltiplos modelos hardcoded em código + editor único) por um **Sistema de Modelos Dinâmicos**: o usuário cria seus próprios templates de contrato no painel admin, e o Wizard permite escolher um deles, ver o texto com variáveis já substituídas, ajustar pontualmente e gerar o PDF.

## Escopo

### 1. Banco de dados (Supabase)
Nova tabela `contract_templates`:
- `id` (uuid)
- `user_id` (uuid → auth.users) — dono do template
- `name` (text) — ex.: "Residencial padrão", "Comercial sem fiador"
- `description` (text, opcional)
- `content` (text) — corpo do contrato com tokens `[nome_do_token]` (mesma sintaxe já usada em `contract-tokens.ts`)
- `property_id` (uuid, opcional) — quando setado, o template só aparece para aquele imóvel
- `is_default` (bool) — marca 1 template como padrão do usuário
- `created_at` / `updated_at`

RLS: usuário só vê/edita os seus. GRANTs para `authenticated` + `service_role`. Trigger de `updated_at`.

Seed opcional: nenhum — o usuário cria os seus. O template dinâmico embutido (`TEMPLATE_LOCACAO_DINAMICO`) continua disponível como "Restaurar modelo padrão" dentro do editor.

### 2. Nova tela: Modelos de Contrato
Rota `_authenticated/modelos-contrato.tsx`:
- Lista dos templates do usuário (nome, imóvel vinculado, data).
- Botões: **Novo modelo**, **Editar**, **Duplicar**, **Excluir**, **Definir como padrão**.
- Editor (Dialog) reutilizando o `ContractEditor` existente:
  - Campos: nome, descrição, imóvel (opcional — "Todos os imóveis" ou um específico), conteúdo.
  - Painel lateral com grupos de tokens clicáveis (reusa `TOKEN_GROUPS` de `contract-tokens.ts`).
  - Botão "Pré-visualizar" com dados fictícios.
- Adicionar link no menu lateral em `_authenticated/route.tsx` (ou onde estiver o menu).

### 3. Novo Wizard
No passo **Documento** do `contract-wizard.tsx`:
- Substituir o `Select` de templates hardcoded por: `Select` com os `contract_templates` do usuário (filtrando pelo imóvel selecionado quando houver vinculação) + opção "Editor em branco (modelo padrão)".
- Ao escolher, carrega o `content` no `ContractEditor` e resolve os tokens automaticamente na aba de pré-visualização.
- Usuário pode fazer ajustes manuais neste contrato específico (sem alterar o template salvo).
- Remover as opções `padrao_11`, `completo_20`, `residencial_20` (deixa de usar `contract-templates.ts` para geração — vira apenas fallback).

### 4. Geração do PDF
- O PDF final é gerado a partir do **texto resolvido** (tokens já substituídos + ajustes manuais), usando um gerador simples de texto→PDF (jsPDF, já disponível via `contract-pdf.ts`).
- Criar `renderTextToPDF(text, ownerProfile, title)` em `src/lib/contract-pdf.ts` que produz um PDF paginado, com margem, título e corpo justificado.
- Substituir `previewPDF()` e a montagem do `doc` em `finishElectronic()` para usar essa nova função quando o modo dinâmico for escolhido.
- Fluxo posterior (salvar contrato, gerar pagamentos, assinatura manual/eletrônica via D4Sign) permanece intacto.

## Arquivos afetados
- **Novo:** migration SQL, `src/lib/contract-template-store.ts` (queries), `src/routes/_authenticated/modelos-contrato.tsx`, componente `TemplateEditorDialog`.
- **Editado:** `src/components/contract-wizard.tsx` (passo Documento), `src/lib/contract-pdf.ts` (novo render text→PDF), menu lateral.
- **Mantido:** `contract-tokens.ts` (tokens/resolve), `contract-editor.tsx`, fluxo de assinatura D4Sign/manual.

## Fora de escopo
- Editor rich-text WYSIWYG (mantemos textarea + tokens — mesma UX já validada). Se quiser rich-text depois, adicionamos TipTap em iteração separada.
- Versionamento de templates.
- Compartilhamento entre usuários.

Confirma que posso seguir por esse caminho? Uma dúvida específica: **quer que eu já migre os 3 modelos hardcoded (Padrão 11, Completo 20, Residencial 20) como templates iniciais na sua conta ao aplicar a migração**, ou prefere começar do zero e criar os seus manualmente?