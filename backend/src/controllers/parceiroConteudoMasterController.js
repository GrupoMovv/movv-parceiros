const db = require('../config/database');
const { beneficios, planoEfetivo } = require('../config/planos');

// As duas abas exclusivas do Master ("Materiais Exclusivos" e "Lives
// Exclusivas") — cadastro é só via admin (sindicatoPlanosController), aqui
// é só a leitura pro parceiro autenticado. Nunca retorna 403: quem não é
// Master recebe `acesso: false` e lista vazia, pro front mostrar o banner
// de upgrade em vez de um erro.
async function listarMateriais(req, res) {
  try {
    const plano = planoEfetivo(req.parceiro);
    const acesso = Boolean(beneficios(plano).materiais_educativos);
    if (!acesso) return res.json({ acesso, materiais: [] });

    const result = await db.query(
      `SELECT id, titulo, descricao, tipo, url_conteudo, categoria, created_at
       FROM sindicato_materiais_master WHERE ativo = true ORDER BY created_at DESC`
    );
    return res.json({ acesso, materiais: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar materiais' });
  }
}

async function listarLives(req, res) {
  try {
    const plano = planoEfetivo(req.parceiro);
    const acesso = Boolean(beneficios(plano).grupo_vip);
    if (!acesso) return res.json({ acesso, lives: [] });

    const result = await db.query(
      `SELECT id, titulo, descricao, video_url, data_gravacao, duracao_minutos
       FROM sindicato_lives_master WHERE ativo = true ORDER BY data_gravacao DESC NULLS LAST, created_at DESC`
    );
    return res.json({ acesso, lives: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar lives' });
  }
}

module.exports = { listarMateriais, listarLives };
