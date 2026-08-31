-- Carteirinha Digital do Associado SECI (Fase B do Portal Sindicato).
-- Execute: node migrations/run.js

ALTER TABLE sindicato_associados
  ADD COLUMN IF NOT EXISTS empresa_id                     INTEGER REFERENCES sindicato_empresas(id),
  ADD COLUMN IF NOT EXISTS empresa_nome_livre              VARCHAR(255),
  ADD COLUMN IF NOT EXISTS foto_url                        VARCHAR(500),
  ADD COLUMN IF NOT EXISTS carteirinha_hash                VARCHAR(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS carteirinha_gerada_em            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS carteirinha_valida_ate           DATE,
  ADD COLUMN IF NOT EXISTS dependentes_gerar_carteirinha    BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE sindicato_associados_dependentes
  ADD COLUMN IF NOT EXISTS grau                    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS data_nascimento         DATE,
  ADD COLUMN IF NOT EXISTS carteirinha_hash        VARCHAR(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS carteirinha_gerada_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS carteirinha_valida_ate  DATE;

-- Log de uso de benefícios (base pra Fase C — validação de desconto pelo parceiro).
CREATE TABLE IF NOT EXISTS sindicato_uso_beneficios (
  id             SERIAL PRIMARY KEY,
  associado_id   INTEGER REFERENCES sindicato_associados(id) ON DELETE CASCADE,
  dependente_id  INTEGER REFERENCES sindicato_associados_dependentes(id) ON DELETE CASCADE,
  parceiro_nome  VARCHAR(255) NOT NULL,
  validado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_origem      VARCHAR(64),
  user_agent     TEXT
);

-- Histórico de fotos enviadas (auditoria — foto_url em sindicato_associados/
-- dependentes guarda só a atual; aqui fica o rastro de quem trocou e quando).
CREATE TABLE IF NOT EXISTS sindicato_carteirinha_upload (
  id                SERIAL PRIMARY KEY,
  associado_id      INTEGER REFERENCES sindicato_associados(id) ON DELETE CASCADE,
  dependente_id     INTEGER REFERENCES sindicato_associados_dependentes(id) ON DELETE CASCADE,
  tipo_dono         VARCHAR(20) NOT NULL CHECK (tipo_dono IN ('associado', 'dependente')),
  url_arquivo       VARCHAR(500) NOT NULL,
  uploaded_por_id   INTEGER REFERENCES internal_collaborators(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sindicato_associados_empresa       ON sindicato_associados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sindicato_associados_valida_ate    ON sindicato_associados(carteirinha_valida_ate);
CREATE INDEX IF NOT EXISTS idx_sindicato_dependentes_valida_ate   ON sindicato_associados_dependentes(carteirinha_valida_ate);
CREATE INDEX IF NOT EXISTS idx_sindicato_uso_beneficios_associado ON sindicato_uso_beneficios(associado_id);
CREATE INDEX IF NOT EXISTS idx_sindicato_uso_beneficios_dependente ON sindicato_uso_beneficios(dependente_id);
CREATE INDEX IF NOT EXISTS idx_sindicato_carteirinha_upload_assoc ON sindicato_carteirinha_upload(associado_id);
CREATE INDEX IF NOT EXISTS idx_sindicato_carteirinha_upload_dep   ON sindicato_carteirinha_upload(dependente_id);
