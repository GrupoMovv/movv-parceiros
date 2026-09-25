const db = require('../config/database');
const { planoEfetivo } = require('../config/planos');
const {
  SERVICOS_PET, PORTES_PET, RACAS_PET, CATEGORIA_PET, PRECO_MIN, PRECO_MAX,
  validarPet, validarPrecos, tipoNegocioPet, normalizarRacas,
} = require('../config/pet');
const { sqlBoostBusca } = require('./marketplaceHomeController');

const CODIGOS = {
  servico: new Set(SERVICOS_PET.map(s => s.codigo)),
  porte: new Set(PORTES_PET.map(p => p.codigo)),
  raca: new Set(RACAS_PET.map(r => r.codigo)),
};

// GET /api/public/pet/catalogo — o front (cadastro, painel, marketplace) não
// repete nenhuma lista, lê daqui.
function catalogo(req, res) {
  return res.json({
    categoria: CATEGORIA_PET, servicos: SERVICOS_PET, portes: PORTES_PET, racas: RACAS_PET,
    preco_min: PRECO_MIN, preco_max: PRECO_MAX,
  });
}

function numeroOuNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// GET /api/public/pet/parceiros?bairro=&servico=&porte=&raca=&preco_min=&preco_max=&ordem=
// Filtros do /marketplace/pet. Valor fora do catálogo é ignorado (não quebra).
//   raca: quem é especialista na raça vem primeiro, depois quem "atende
//         todas" (não marcou raça nenhuma); especialista em OUTRAS raças sai.
//   preço: "a partir de" = menor preço do serviço/porte filtrado (ou o
//         menor da tabela, sem filtro). Com faixa de preço, quem não tem
//         preço cadastrado fica de fora.
async function listarPublico(req, res) {
  try {
    const q = req.query;
    const servico = CODIGOS.servico.has(q.servico) ? q.servico : null;
    const porte = CODIGOS.porte.has(q.porte) ? q.porte : null;
    const raca = CODIGOS.raca.has(q.raca) ? q.raca : null;
    const bairro = String(q.bairro || '').trim() || null;
    const precoMin = numeroOuNull(q.preco_min);
    const precoMax = numeroOuNull(q.preco_max);
    const ordem = ['preco', 'nome'].includes(q.ordem) ? q.ordem : 'destaque';

    const ordenacao = [
      raca ? `(p.pet_racas @> ARRAY[$3::text]) DESC` : null,
      ordem === 'preco' ? 'preco_a_partir ASC NULLS LAST' : null,
      ordem === 'destaque' ? `${sqlBoostBusca('p.')} DESC` : null,
      'p.nome ASC',
    ].filter(Boolean).join(', ');

    const r = await db.query(
      `SELECT * FROM (
         SELECT p.id, p.slug, p.nome, p.logo_url, p.bairro, p.plano, p.plano_expira_em, p.cortesia_interna, p.tipo_negocio,
                p.pet_servicos, p.pet_portes, p.pet_racas,
                (SELECT MIN(pp.preco) FROM pet_precos pp
                  WHERE pp.parceiro_id = p.id
                    AND ($1::text IS NULL OR pp.servico = $1)
                    AND ($2::text IS NULL OR pp.porte = $2)) AS preco_a_partir
         FROM sindicato_parceiros p
         WHERE p.status = 'ativo' AND p.pet_servicos <> '{}'
           AND ($1::text IS NULL OR p.pet_servicos @> ARRAY[$1::text])
           AND ($2::text IS NULL OR p.pet_portes @> ARRAY[$2::text])
           AND ($3::text IS NULL OR p.pet_racas = '{}' OR p.pet_racas @> ARRAY[$3::text])
           AND ($4::text IS NULL OR lower(trim(p.bairro)) = lower($4))
       ) p
       WHERE ($5::numeric IS NULL OR p.preco_a_partir >= $5)
         AND ($6::numeric IS NULL OR p.preco_a_partir <= $6)
       ORDER BY ${ordenacao}
       LIMIT 200`,
      [servico, porte, raca, bairro, precoMin, precoMax]
    );

    // Facetas (sobre TODOS os pet shops, pra não sumir opção ao filtrar).
    const f = await db.query(
      `SELECT trim(p.bairro) AS bairro, COUNT(*)::int AS total
       FROM sindicato_parceiros p
       WHERE p.status = 'ativo' AND p.pet_servicos <> '{}' AND COALESCE(trim(p.bairro), '') <> ''
       GROUP BY 1 ORDER BY 1`
    );
    const faixa = (await db.query(
      `SELECT MIN(pp.preco) AS min, MAX(pp.preco) AS max
       FROM pet_precos pp JOIN sindicato_parceiros p ON p.id = pp.parceiro_id
       WHERE p.status = 'ativo'`
    )).rows[0];

    return res.json({
      parceiros: r.rows.map(p => ({
        slug: p.slug, nome: p.nome, logo_url: p.logo_url, bairro: p.bairro, plano: planoEfetivo(p),
        tipo_negocio: p.tipo_negocio, pet_servicos: p.pet_servicos, pet_portes: p.pet_portes, pet_racas: p.pet_racas,
        preco_a_partir: p.preco_a_partir == null ? null : Number(p.preco_a_partir),
        especialista: Boolean(raca && p.pet_racas.includes(raca)),
      })),
      facetas: {
        bairros: f.rows,
        preco: { min: faixa.min == null ? null : Number(faixa.min), max: faixa.max == null ? null : Number(faixa.max) },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar pet shops' });
  }
}

async function dadosPetDoParceiro(parceiroId) {
  const p = (await db.query('SELECT pet_servicos, pet_portes, pet_racas FROM sindicato_parceiros WHERE id = $1', [parceiroId])).rows[0];
  const precos = (await db.query(
    'SELECT servico, porte, preco FROM pet_precos WHERE parceiro_id = $1 ORDER BY servico, porte', [parceiroId]
  )).rows.map(x => ({ ...x, preco: Number(x.preco) }));
  return { servicos: p?.pet_servicos || [], portes: p?.pet_portes || [], racas: p?.pet_racas || [], precos };
}

// GET /api/parceiro/perfil/pet
async function meuPet(req, res) {
  try {
    return res.json(await dadosPetDoParceiro(req.parceiro.id));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar dados pet' });
  }
}

// PUT /api/parceiro/perfil/pet { servicos, portes, racas, precos: [{servico, porte, preco}] }
// Regrava tudo junto (transação): serviços, portes, raças, tipo derivado e a
// tabela de preços inteira. Preço de serviço/porte que deixou de ser
// oferecido cai fora sozinho.
async function salvarMeuPet(req, res) {
  try {
    const b = req.body || {};
    const pet = validarPet({ servicos: b.servicos, portes: b.portes });
    if (pet.erro) return res.status(400).json({ error: pet.erro });
    const racas = normalizarRacas(b.racas);
    if (!racas) return res.status(400).json({ error: 'Raças inválidas' });
    const tabela = validarPrecos(b.precos, pet);
    if (tabela.erro) return res.status(400).json({ error: tabela.erro });

    await db.transacao(async (client) => {
      await client.query(
        `UPDATE sindicato_parceiros
         SET pet_servicos = $1, pet_portes = $2, pet_racas = $3, tipo_negocio = $4::tipo_negocio_enum, updated_at = NOW()
         WHERE id = $5`,
        [pet.servicos, pet.portes, racas, tipoNegocioPet(pet.servicos), req.parceiro.id]
      );
      await client.query('DELETE FROM pet_precos WHERE parceiro_id = $1', [req.parceiro.id]);
      if (tabela.precos.length) {
        await client.query(
          `INSERT INTO pet_precos (parceiro_id, servico, porte, preco)
           SELECT $1, s, p, v FROM unnest($2::text[], $3::text[], $4::numeric[]) AS x(s, p, v)`,
          [req.parceiro.id, tabela.precos.map(x => x.servico), tabela.precos.map(x => x.porte), tabela.precos.map(x => x.preco)]
        );
      }
    });
    return res.json(await dadosPetDoParceiro(req.parceiro.id));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao salvar dados pet' });
  }
}

module.exports = { catalogo, listarPublico, meuPet, salvarMeuPet, dadosPetDoParceiro };
