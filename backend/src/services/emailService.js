const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Grupo Movv <noreply@grupomovv.com.br>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'contato@grupomovv.com.br';
const PORTAL_URL = process.env.FRONTEND_URL || 'https://movv-parceiros.onrender.com';

async function enviar({ to, subject, html }) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      bcc: ADMIN_EMAIL,
      subject,
      html,
    });
    if (error) throw new Error(error.message);
    console.log(`[EMAIL] Enviado para ${to} | ID: ${data.id}`);
    return { sucesso: true, id: data.id };
  } catch (err) {
    console.error(`[EMAIL] Falha ao enviar para ${to}:`, err.message);
    throw err;
  }
}

function template(conteudo) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f0f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(74,14,143,0.15);">
        <tr><td style="background:#1a1a2e;padding:28px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <p style="margin:0;color:#C9A84C;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">GRUPO MOVV</p>
              <h1 style="margin:4px 0 0;color:#fff;font-size:20px;letter-spacing:1px;">MOVV PARCEIROS</h1>
              <p style="margin:4px 0 0;color:#6a6a8a;font-size:11px;">Itumbiara/GO</p>
            </td>
            <td align="right">
              <div style="width:10px;height:40px;background:#4A0E8F;border-radius:4px;display:inline-block;margin-right:4px;"></div>
              <div style="width:10px;height:40px;background:#C9A84C;border-radius:4px;display:inline-block;"></div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:36px 40px;">${conteudo}</td></tr>
        <tr><td style="background:#1a1a2e;padding:18px 40px;">
          <p style="margin:0;color:#6a6a8a;font-size:11px;text-align:center;">
            Email enviado automaticamente pelo sistema Movv Parceiros &bull; grupomovv.com.br
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function botao(texto, url) {
  return `<a href="${url}"
    style="display:inline-block;margin-top:20px;padding:14px 32px;background:#4A0E8F;
      color:#fff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.5px;">
    ${texto}
  </a>`;
}

function linha(label, valor, claro = false) {
  const bg = claro ? '#f5f0ff' : '#fafafa';
  return `<tr>
    <td style="padding:11px 16px;background:${bg};border-bottom:1px solid #ede8f8;color:#777;font-size:13px;width:42%;">${label}</td>
    <td style="padding:11px 16px;background:${bg};border-bottom:1px solid #ede8f8;font-weight:600;font-size:14px;">${valor}</td>
  </tr>`;
}

async function enviarCredenciais({ nome, email, codigoAcesso, whatsapp }) {
  const html = template(`
    <h2 style="color:#1a1a2e;margin-top:0;font-size:22px;">Bem-vindo a equipe Movv!</h2>
    <p style="color:#555;line-height:1.6;">Ola, <strong>${nome}</strong>! Seu acesso ao portal foi criado. Use as credenciais abaixo para entrar.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;border-radius:8px;overflow:hidden;border:1px solid #ede8f8;">
      ${linha('E-mail de acesso', email)}
      ${linha(`<span style="color:#4A0E8F;font-weight:700;">Codigo de acesso</span>`,
        `<span style="font-size:22px;letter-spacing:4px;color:#4A0E8F;font-weight:700;">${codigoAcesso}</span>`, true)}
      ${whatsapp ? linha('WhatsApp cadastrado', whatsapp) : ''}
    </table>
    <div style="background:#fff8e8;border-left:4px solid #C9A84C;padding:12px 16px;border-radius:0 6px 6px 0;margin:16px 0;">
      <p style="margin:0;color:#7a5e00;font-size:13px;"><strong>Atencao:</strong> Altere sua senha no primeiro acesso.</p>
    </div>
    ${botao('Acessar o Portal Movv', PORTAL_URL)}
  `);
  return enviar({ to: email, subject: 'Movv Parceiros — Suas credenciais de acesso', html });
}

async function enviarRecuperacaoSenha({ nome, email, token }) {
  const link = `${PORTAL_URL}/reset-password?token=${token}`;
  const html = template(`
    <h2 style="color:#1a1a2e;margin-top:0;font-size:22px;">Redefinicao de Senha</h2>
    <p style="color:#555;line-height:1.6;">Ola, <strong>${nome}</strong>! Recebemos uma solicitacao para redefinir sua senha.</p>
    <p style="color:#555;line-height:1.6;">Clique no botao abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.</p>
    ${botao('Redefinir Minha Senha', link)}
    <p style="color:#aaa;font-size:12px;margin-top:24px;">Se voce nao solicitou isso, ignore este email. Sua senha permanece a mesma.</p>
  `);
  return enviar({ to: email, subject: 'Movv Parceiros — Redefinicao de senha', html });
}

async function enviarComissaoAprovada({ nome, email, valor, mes }) {
  const valorFmt = parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const [ano, m] = mes.split('-');
  const mesFmt = new Date(parseInt(ano), parseInt(m) - 1, 1)
    .toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const html = template(`
    <h2 style="color:#1a1a2e;margin-top:0;font-size:22px;">Comissao Aprovada!</h2>
    <p style="color:#555;line-height:1.6;">Ola, <strong>${nome}</strong>! Uma comissao foi aprovada em sua conta.</p>
    <div style="background:linear-gradient(135deg,#1a1a2e 0%,#2d1b5e 100%);border-radius:12px;padding:32px;text-align:center;margin:24px 0;">
      <p style="margin:0;color:#C9A84C;font-size:11px;text-transform:uppercase;letter-spacing:3px;font-weight:700;">Valor aprovado</p>
      <p style="margin:10px 0 6px;color:#fff;font-size:38px;font-weight:700;">${valorFmt}</p>
      <p style="margin:0;color:#8a8aaa;font-size:13px;">Referente a ${mesFmt}</p>
    </div>
    <p style="color:#666;font-size:13px;line-height:1.6;">O valor sera disponibilizado no proximo ciclo de pagamento (ate o dia 5 do mes seguinte via PIX).</p>
    ${botao('Ver Meu Extrato', PORTAL_URL)}
  `);
  return enviar({ to: email, subject: `Movv Parceiros — Comissao aprovada: ${valorFmt}`, html });
}

async function enviarRelatorioMensal({ nome, email, mes, dados }) {
  const [ano, m] = mes.split('-');
  const mesFmt = new Date(parseInt(ano), parseInt(m) - 1, 1)
    .toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const totalFmt = parseFloat(dados.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const html = template(`
    <h2 style="color:#1a1a2e;margin-top:0;font-size:22px;">Relatorio Mensal — ${mesFmt}</h2>
    <p style="color:#555;line-height:1.6;">Ola, <strong>${nome}</strong>! Seu relatorio de ${mesFmt} esta disponivel.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;border-radius:8px;overflow:hidden;border:1px solid #ede8f8;">
      ${linha('Periodo', mesFmt)}
      ${linha('Total de indicacoes', dados.total_referrals || 0)}
      ${linha('Comissao total', totalFmt, true)}
    </table>
    ${botao('Acessar o Portal', PORTAL_URL)}
  `);
  return enviar({ to: email, subject: `Movv Parceiros — Relatorio de ${mesFmt}`, html });
}

async function enviarNotificacaoPagamento({ nome, email, valor, data, mes }) {
  const valorFmt = parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const [ano, m] = mes.split('-');
  const mesFmt = new Date(parseInt(ano), parseInt(m) - 1, 1)
    .toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const dataFmt = new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR');
  const html = template(`
    <h2 style="color:#1a1a2e;margin-top:0;font-size:22px;">PIX Enviado com Sucesso!</h2>
    <p style="color:#555;line-height:1.6;">Ola, <strong>${nome}</strong>! Seu pagamento foi processado.</p>
    <div style="background:linear-gradient(135deg,#1a1a2e 0%,#2d1b5e 100%);border-radius:12px;padding:32px;text-align:center;margin:24px 0;">
      <p style="margin:0;color:#C9A84C;font-size:11px;text-transform:uppercase;letter-spacing:3px;font-weight:700;">Valor enviado via PIX</p>
      <p style="margin:10px 0 6px;color:#fff;font-size:38px;font-weight:700;">${valorFmt}</p>
      <p style="margin:0;color:#8a8aaa;font-size:13px;">Referente a ${mesFmt} &bull; Enviado em ${dataFmt}</p>
    </div>
    <p style="color:#666;font-size:13px;line-height:1.6;">O comprovante esta disponivel no portal. Em caso de duvidas, entre em contato com o suporte.</p>
    ${botao('Ver Comprovante no Portal', PORTAL_URL)}
  `);
  return enviar({ to: email, subject: `Movv Parceiros — PIX enviado: ${valorFmt}`, html });
}

async function enviarConfirmacaoIndicacao({ nome, email, protocolo, produto, validade }) {
  const dataFmt = new Date(validade).toLocaleDateString('pt-BR');
  const html = template(`
    <h2 style="color:#1a1a2e;margin-top:0;font-size:22px;">Sua indicacao foi registrada!</h2>
    <p style="color:#555;line-height:1.6;">Ola, <strong>${nome}</strong>! Recebemos sua indicacao para o produto abaixo.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;border-radius:8px;overflow:hidden;border:1px solid #ede8f8;">
      ${linha(`<span style="color:#4A0E8F;font-weight:700;">Protocolo</span>`,
        `<span style="font-size:20px;letter-spacing:3px;color:#4A0E8F;font-weight:700;">${protocolo}</span>`, true)}
      ${linha('Produto de interesse', produto)}
      ${linha('Validade da indicacao', dataFmt)}
    </table>
    <div style="background:#f5f0ff;border-left:4px solid #4A0E8F;padding:12px 16px;border-radius:0 6px 6px 0;margin:16px 0;">
      <p style="margin:0;color:#4A0E8F;font-size:13px;line-height:1.6;"><strong>Proximos passos:</strong> Nossa equipe entrara em contato em breve para dar continuidade ao processo.</p>
    </div>
    <p style="color:#aaa;font-size:12px;margin-top:16px;">Guarde o numero do protocolo para acompanhar sua indicacao.</p>
  `);
  return enviar({ to: email, subject: `Movv — Protocolo de indicacao: ${protocolo}`, html });
}

module.exports = {
  enviarCredenciais,
  enviarRecuperacaoSenha,
  enviarComissaoAprovada,
  enviarRelatorioMensal,
  enviarNotificacaoPagamento,
  enviarConfirmacaoIndicacao,
};
