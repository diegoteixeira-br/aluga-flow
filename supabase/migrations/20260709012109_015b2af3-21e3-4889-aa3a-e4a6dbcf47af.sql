ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'aguardando_pagamento';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'processando_assinatura';

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS signature_fee_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS signature_fee_status TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_invoice_item_id TEXT,
  ADD COLUMN IF NOT EXISTS d4sign_document_id TEXT,
  ADD COLUMN IF NOT EXISTS d4sign_status TEXT;