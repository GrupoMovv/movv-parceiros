const bcrypt = require('bcryptjs');
const db = require('../config/database');
const cloudinaryService = require('../services/cloudinaryService');
const { onlyDigits, isValidCPF } = require('../utils/validators');
const { gerarTokenParceiro } = require('../middleware/parceiroAuth');
const { parceiroPublico } = require('./parceiroAuthController');
const { SEGMENTOS, gerarSlugUnico, normalizarEmail, emailValido, whatsappValido, getIp } = require('./parceiroSolicitacaoController');
const { VENDEDOR_PF_ABERTO, TERMOS_PF_VERSAO, NIVEIS_PF, IDADE_MINIMA_PF, MAX_CADASTROS_PF_POR_IP_24H } = require('../config/vendedorPf');

// Cadastro do Vendedor Pessoa Física (CPF) — "Como você vai vender?" →
// "Pessoa Física" no /vender. Diferente do /vender de CNPJ (solicitação que
// o admin aprova antes de existir conta), aqui a conta nasce na hora com
// status 'em_verificacao': o vendedor entra no painel e monta anúncios, mas
// nada dele aparece no site até o admin conferir documento + selfie
// (fotos PRIVADAS no Cloudinary — cloudinaryService.uploadDocumentoPrivado).

// idade em anos completos numa data 'YYYY-MM-DD'
function idade(dataIso, hoje = new Date()) {
  const [a, m, d] = dataIso.split('-').map(Number);
  let anos = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) anos--;
  return anos;
}

// GET /api/public/vender/pessoa-fisica/config — o que a tela mostra
function config(req, res) {
  return res.json({
    // false = /vender esconde a opção "Pessoa Física" (chave do lançamento)
    aberto_ao_publico: VENDEDOR_PF_ABERTO,
    termos_versao: TERMOS_PF_VERSAO,
    idade_minima: IDADE_MINIMA_PF,
    niveis: Object.entries(NIVEIS_PF).map(([codigo, n]) => ({ codigo, ...n })),
    segmentos: Object.entries(SEGMENTOS).filter(([k]) => k !== 'bebidas').map(([codigo, s]) => ({ codigo, label: s.label, icone: s.icone })),
  });
}

// POST /api/public/vender/pessoa-fisica (multipart: campos + "documento" + "selfie")
async function cadastrar(req, res) {
  const b = req.body || {};
  const cpf = onlyDigits(b.cpf);
  const email = normalizarEmail(b.email);
  const whatsapp = onlyDigits(b.whatsapp);
  const nivel = String(b.nivel || '');
  const segmento = String(b.segmento || '');
  const nascimento = String(b.data_nascimento || '');
  const senha = String(b.senha || '');
  const documento = req.files?.documento?.[0];
  const selfie = req.files?.selfie?.[0];

  if (!NIVEIS_PF[nivel]) return res.status(400).json({ error: 'Escolha se você vende de vez em quando ou sempre' });
  if (!SEGMENTOS[segmento] || segmento === 'bebidas') {
    return res.status(400).json({ error: segmento === 'bebidas' ? 'Bebida alcoólica só pode ser vendida com CNPJ, pelo Disk Bebidas.' : 'Escolha o que você vende' });
  }
  const nomeCompleto = String(b.nome_completo || '').trim().replace(/\s+/g, ' ');
  if (nomeCompleto.split(' ').length < 2) return res.status(400).json({ error: 'Informe seu nome completo' });
  const nomeVitrine = String(b.nome_vitrine || '').trim() || nomeCompleto;
  if (!isValidCPF(cpf)) return res.status(400).json({ error: 'CPF inválido' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento) || Number.isNaN(Date.parse(nascimento))) return res.status(400).json({ error: 'Data de nascimento inválida' });
  if (idade(nascimento) < IDADE_MINIMA_PF) return res.status(400).json({ error: `É preciso ter ${IDADE_MINIMA_PF} anos ou mais para vender no IUB Mais+` });
  if (!whatsappValido(whatsapp)) return res.status(400).json({ error: 'WhatsApp inválido' });
  if (!emailValido(email)) return res.status(400).json({ error: 'E-mail inválido' });
  if (senha.length < 8) return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres' });
  if (!String(b.bairro || '').trim()) return res.status(400).json({ error: 'Informe seu bairro' });
  if (b.aceite_termos !== 'true' && b.aceite_termos !== true) return res.status(400).json({ error: 'É preciso aceitar os Termos do Vendedor Pessoa Física' });
  if (b.termos_versao !== TERMOS_PF_VERSAO) return res.status(409).json({ error: 'Os termos foram atualizados. Recarregue a página e aceite a versão nova.' });
  if (!documento) return res.status(400).json({ error: 'Envie a foto do seu documento (RG ou CNH)' });
  if (!selfie) return res.status(400).json({ error: 'Envie a selfie segurando o documento' });

  const ip = getIp(req);
  try {
    if (ip) {
      const recentes = await db.query(
        `SELECT COUNT(*)::int n FROM sindicato_parceiros WHERE termos_pf_aceito_ip = $1 AND termos_pf_aceito_em >= NOW() - INTERVAL '24 hours'`, [ip]
      );
      if (recentes.rows[0].n >= MAX_CADASTROS_PF_POR_IP_24H) return res.status(429).json({ error: 'Muitos cadastros a partir desta conexão. Tente de novo mais tarde.' });
    }
    if ((await db.query('SELECT 1 FROM sindicato_parceiros WHERE cpf = $1', [cpf])).rows[0]) {
      return res.status(409).json({ error: 'Este CPF já tem cadastro de vendedor. Entre com seu e-mail e senha.' });
    }
    if ((await db.query('SELECT 1 FROM sindicato_parceiro_usuarios WHERE lower(email) = $1', [email])).rows[0]) {
      return res.status(409).json({ error: 'Este e-mail já está em uso. Entre com ele ou use outro.' });
    }

    // documento e selfie primeiro (privados): se o upload falhar, nada é criado
    // pasta sem nenhum dado pessoal no nome
    const pasta = `iubmais/pf/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const doc = await cloudinaryService.uploadDocumentoPrivado(documento.buffer, pasta);
    let foto;
    try {
      foto = await cloudinaryService.uploadDocumentoPrivado(selfie.buffer, pasta);
    } catch (err) {
      cloudinaryService.deletarDocumentoPrivado(doc.publicId);
      throw err;
    }

    const seg = SEGMENTOS[segmento];
    const slug = await gerarSlugUnico(nomeVitrine);
    const senhaHash = await bcrypt.hash(senha, 10);
    const { parceiro, usuario } = await db.transacao(async client => {
      const p = (await client.query(
        `INSERT INTO sindicato_parceiros
           (slug, nome, razao_social, categorias, categoria_principal, icone, cor_icone, whatsapp, bairro, cidade, estado, status,
            tipo_pessoa, nivel_vendedor, cpf, data_nascimento,
            identidade_status, identidade_doc_public_id, identidade_selfie_public_id, identidade_enviada_em,
            termos_pf_versao, termos_pf_aceito_em, termos_pf_aceito_ip, termos_pf_user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'GO','em_verificacao',
                 'pf',$11,$12,$13,
                 'pendente',$14,$15,NOW(),
                 $16,NOW(),$17,$18)
         RETURNING *`,
        [slug, nomeVitrine, nomeCompleto, [seg.label], seg.label, seg.icone, seg.cor, whatsapp,
          String(b.bairro).trim(), String(b.cidade || 'Itumbiara').trim(),
          nivel, cpf, nascimento, doc.publicId, foto.publicId,
          TERMOS_PF_VERSAO, ip || null, String(req.headers['user-agent'] || '').slice(0, 500) || null]
      )).rows[0];
      const u = (await client.query(
        `INSERT INTO sindicato_parceiro_usuarios (parceiro_id, email, senha_hash, cargo, ativo) VALUES ($1,$2,$3,'dono',true) RETURNING id, cargo`,
        [p.id, email, senhaHash]
      )).rows[0];
      return { parceiro: p, usuario: u };
    });

    // já entra logado no painel (em verificação)
    const token = gerarTokenParceiro({ parceiroId: parceiro.id, usuarioId: usuario.id, cargo: usuario.cargo });
    return res.status(201).json({ token, parceiro: parceiroPublico(parceiro) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Este CPF ou e-mail já tem cadastro.' });
    if (err.cloudinaryCode) return res.status(502).json({ error: 'Não deu para enviar as fotos agora. Tente de novo em instantes.' });
    console.error('[vendedorPf.cadastrar]', err);
    return res.status(500).json({ error: 'Erro ao criar cadastro' });
  }
}

module.exports = { config, cadastrar, idade };
