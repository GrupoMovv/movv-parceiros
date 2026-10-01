-- Registros de acesso (Marco Civil da Internet, art. 15): data, hora e IP de
-- uso da plataforma, guardados por 6 meses e fornecidos só com ordem
-- judicial (Política de Privacidade item 11; Termos PF item 15). Grava o
-- middleware registrarAcesso (src/middleware/registroAcesso.js), que também
-- apaga as linhas com mais de 6 meses uma vez por dia.
CREATE TABLE IF NOT EXISTS registros_acesso (
  id            BIGSERIAL PRIMARY KEY,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip            VARCHAR(45) NOT NULL,
  metodo        VARCHAR(8) NOT NULL,
  rota          VARCHAR(200) NOT NULL,
  -- Quem, pelo token da requisição: parceiro | painel_publico | internal |
  -- indicator | partner | anonimo. usuario_id é o id dentro desse tipo.
  tipo_usuario  VARCHAR(16) NOT NULL,
  usuario_id    INTEGER,
  parceiro_id   INTEGER,
  user_agent    VARCHAR(300)
);
CREATE INDEX IF NOT EXISTS idx_registros_acesso_criado ON registros_acesso (criado_em);
CREATE INDEX IF NOT EXISTS idx_registros_acesso_usuario ON registros_acesso (tipo_usuario, usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_registros_acesso_ip ON registros_acesso (ip, criado_em DESC);
