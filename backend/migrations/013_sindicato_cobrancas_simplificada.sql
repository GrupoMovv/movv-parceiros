-- Cobrança do Sindicato vira mensagem fixa (sem guia/valor/vencimento) — campos ficam opcionais
-- Execute: node migrations/run.js

ALTER TABLE sindicato_cobrancas ALTER COLUMN numero_guia DROP NOT NULL;
ALTER TABLE sindicato_cobrancas ALTER COLUMN valor DROP NOT NULL;
ALTER TABLE sindicato_cobrancas ALTER COLUMN data_vencimento DROP NOT NULL;
