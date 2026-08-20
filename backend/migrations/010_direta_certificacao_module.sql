-- Módulo Direta Certificação (Fernando): vendas por certificado, CRM de atividades,
-- metas/escalonamento de comissão e preços customizados por contabilidade.
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS contabilidades_precos (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  preco_certificado DECIMAL(10,2) NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(partner_id)
);

CREATE INDEX IF NOT EXISTS idx_contab_precos_partner ON contabilidades_precos(partner_id);

CREATE TABLE IF NOT EXISTS direta_sales (
  id SERIAL PRIMARY KEY,
  collaborator_id INTEGER NOT NULL REFERENCES internal_collaborators(id),
  data_venda DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo_venda VARCHAR(20) NOT NULL CHECK (tipo_venda IN ('contabilidade', 'direta')),
  contabilidade_id INTEGER REFERENCES partners(id),
  cliente_nome VARCHAR(200) NOT NULL,
  cliente_cpf_cnpj VARCHAR(20),
  cliente_whatsapp VARCHAR(20),
  preco_venda DECIMAL(10,2) NOT NULL,
  custo DECIMAL(10,2) NOT NULL DEFAULT 19.90,
  lucro DECIMAL(10,2) NOT NULL,
  comissao_pct DECIMAL(5,2) NOT NULL,
  comissao_valor DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'confirmada' CHECK (status IN ('confirmada', 'cancelada')),
  observacoes TEXT,
  reference_month VARCHAR(7) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_direta_sales_collab ON direta_sales(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_direta_sales_month ON direta_sales(reference_month);
CREATE INDEX IF NOT EXISTS idx_direta_sales_contab ON direta_sales(contabilidade_id);

CREATE TABLE IF NOT EXISTS sales_activities (
  id SERIAL PRIMARY KEY,
  collaborator_id INTEGER NOT NULL REFERENCES internal_collaborators(id),
  data_atividade DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('visita', 'ligacao', 'whatsapp', 'reuniao')),
  contabilidade_id INTEGER REFERENCES partners(id),
  contato_nome VARCHAR(200),
  observacoes TEXT NOT NULL,
  proximo_passo TEXT,
  data_proximo_passo DATE,
  status_lead VARCHAR(20) DEFAULT 'morno' CHECK (status_lead IN ('frio', 'morno', 'quente', 'fechado', 'perdido')),
  reference_month VARCHAR(7) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activities_collab ON sales_activities(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_activities_month ON sales_activities(reference_month);
CREATE INDEX IF NOT EXISTS idx_activities_status ON sales_activities(status_lead);

-- sales_goals: escalonamento de comissão e metas mensais.
-- Contadores "atingido_*" propositalmente NÃO são armazenados aqui — são sempre
-- calculados ao vivo a partir de direta_sales/sales_activities, para evitar que um
-- cancelamento ou edição de venda deixe um contador dessincronizado.
CREATE TABLE IF NOT EXISTS sales_goals (
  id SERIAL PRIMARY KEY,
  collaborator_id INTEGER NOT NULL REFERENCES internal_collaborators(id),
  reference_month VARCHAR(7) NOT NULL,
  meta_certificados INTEGER NOT NULL DEFAULT 30,
  meta_visitas INTEGER NOT NULL DEFAULT 40,
  meta_contatos INTEGER NOT NULL DEFAULT 100,
  comissao_pct DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(collaborator_id, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_goals_collab_month ON sales_goals(collaborator_id, reference_month);

-- Seed: meta inicial do Fernando para o mês corrente (idempotente)
INSERT INTO sales_goals (collaborator_id, reference_month, meta_certificados, meta_visitas, meta_contatos, comissao_pct)
SELECT id, to_char(CURRENT_DATE, 'YYYY-MM'), 30, 40, 100, 20.00
FROM internal_collaborators
WHERE role = 'comercial_full' AND active = true
ON CONFLICT (collaborator_id, reference_month) DO NOTHING;
