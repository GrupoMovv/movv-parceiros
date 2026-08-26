-- Envio de benefícios do Sindicato via WhatsApp (Renan)
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS sindicato_colaboradores (
  id                 SERIAL PRIMARY KEY,
  nome               VARCHAR(255) NOT NULL,
  whatsapp           VARCHAR(25) NOT NULL,
  empresa_id         INTEGER REFERENCES sindicato_empresas(id) ON DELETE SET NULL,
  observacoes        TEXT,
  cadastrado_por_id  INTEGER REFERENCES internal_collaborators(id),
  ativo              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sindicato_mensagens_template (
  id          SERIAL PRIMARY KEY,
  tipo        VARCHAR(50) NOT NULL,
  titulo      VARCHAR(255) NOT NULL,
  conteudo    TEXT NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sindicato_envios (
  id                SERIAL PRIMARY KEY,
  colaborador_id    INTEGER NOT NULL REFERENCES sindicato_colaboradores(id) ON DELETE CASCADE,
  template_id       INTEGER REFERENCES sindicato_mensagens_template(id),
  enviado_por_id    INTEGER REFERENCES internal_collaborators(id),
  telefone_usado    VARCHAR(25),
  mensagem_enviada  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sindicato_colab_empresa   ON sindicato_colaboradores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sindicato_colab_nome      ON sindicato_colaboradores(nome);
CREATE INDEX IF NOT EXISTS idx_sindicato_colab_whatsapp  ON sindicato_colaboradores(whatsapp);
CREATE INDEX IF NOT EXISTS idx_sindicato_template_tipo   ON sindicato_mensagens_template(tipo);
CREATE INDEX IF NOT EXISTS idx_sindicato_envios_colab    ON sindicato_envios(colaborador_id);

-- Seed idempotente: só insere se ainda não existir um template com esse tipo+título
INSERT INTO sindicato_mensagens_template (tipo, titulo, conteudo)
SELECT 'beneficios', 'Catálogo de Benefícios SECI', $msg$🎁 CATÁLOGO DE BENEFÍCIOS SECI

Olá! 👋

Você sabia que, sendo associado ao SECI – Sindicato dos Empregados no Comércio de Itumbiara, você pode ter acesso a vários benefícios e descontos para você e sua família?

Confira nossas parcerias:

💊 01. NOSSA DROGARIA
Produtos com super descontos para associados.
📲 WhatsApp: (64) 99299-1403

🏋️ 02. ACADEMIA ATLÉTICA
Mensalidade promocional de apenas R$ 30,00, todos os dias.
🔹 Necessário apresentar a carteirinha do associado.

🏨 03. DIROMA FIORI – CALDAS NOVAS
Pacote de final de semana, de sexta a domingo, por R$ 300,00.
📲 Reservas somente pelo WhatsApp: (64) 99264-0899

👓 04. ÓTICAS DINIZ
20% de desconto para associados.
📲 WhatsApp: (64) 3432-0708

🥗 05. EZÉQUIEL REIS – NUTRICIONISTA
Consulta pelo convênio por apenas R$ 70,00.
Inclui:
✅ Plano alimentar personalizado
✅ Avaliação completa
✅ Acompanhamento online
✅ Suporte pelo WhatsApp
📲 WhatsApp: (64) 99322-2304

🧠 06. PLENITUDE – CONSULTÓRIO DE PSICOLOGIA
Atendimento de:
🔹 Psicoterapia para adultos
🔹 Psicóloga infantil
🔹 Psicóloga especialista em ABA
🔹 Psicóloga clínica
🔹 Neuropsicóloga
📲 WhatsApp: (64) 99201-2585

🥽 07. NESPLORA – AVALIAÇÃO NEUROPSICOLÓGICA
Avaliação neuropsicológica com realidade virtual.
💰 R$ 400,00 com relatório
📲 WhatsApp: (64) 99201-2585

💆‍♀️ 08. LAURA CLEMENTE – FARMACÊUTICA ESTETA
Serviços de estética corporal e facial:
🔹 Limpeza de pele, Botox, Harmonização facial
🔹 Tratamento para varizes
🔹 Enzimas para celulite/gordura localizada
🔹 Laser para depilação
🎁 10% de desconto em qualquer região
📲 WhatsApp: (64) 99230-0587

💇‍♀️ 09. STUDIO VIP – BELEZA & SAÚDE CAPILAR
20% de desconto nos serviços.

💙 SECI – Sindicato dos Empregados no Comércio de Itumbiara
Aqui, o associado tem mais economia, mais qualidade de vida e mais parcerias de confiança!

📲 Quer solicitar sua carteirinha de associado?
Entre em contato pelo WhatsApp:
(64) 99264-0899

👉 Aproveite seus benefícios e compartilhe com sua família!
SECI – Seu sindicato, sempre com você!$msg$
WHERE NOT EXISTS (
  SELECT 1 FROM sindicato_mensagens_template WHERE tipo = 'beneficios' AND titulo = 'Catálogo de Benefícios SECI'
);
