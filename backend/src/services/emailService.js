const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Movv Parceiros <noreply@grupomovv.com.br>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'contato@grupomovv.com.br';
const PORTAL_URL = process.env.FRONTEND_URL || 'https://movv-parceiros.onrender.com';

async function enviar({ to, subject, html }) {
  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) throw new Error(error.message);
    console.log(`[EMAIL] Enviado para ${to} | ID: ${data.id}`);
    return { sucesso: true, id: data.id };
  } catch (err) {
    console.error(`[EMAIL] Falha ao enviar para ${to}:`, err.message);
    throw err;
  }
}

function template(conteudo) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr><td style="background:#1a1a2e;padding:28px 40px;">
            <h1 style="margin:0;color:#fff;font-size:22px;">🚗 MOVV PARCEIROS</h1>
            <p style="margin:4px 0 0;color:#a0a0c0;font-size:13px;">Itumbiara/GO — Grupo Movv</p>
          </td></tr>
          <tr><td style="padding:36px 40px;">${conteudo}</td></tr>
          <tr><td style="background:#f8f8f8;padding:20px 40px;border-top:1px solid #eee;">
            <p style="margin:0;color:#999;font-size:12px;text-align:center;">
              Email enviado automaticamente pelo sistema Movv Parceiros.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

function botao(texto, url) {
  return `<a href="${url}" style="display:inline-block;margin-top:20px;padding:14px 32px;
    background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">
    ${texto}</a>`;
}

async function enviarCredenciais({ nome, email, codigoAcesso, whatsapp }) {
  const html = template(`
    <h2 style="color:#1a1a2e;">Bem-vindo à equipe Movv! 👋</h2>
    <p style="color:#555;">Olá, <strong>${nome}</strong>! Seu acesso foi criado:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:12px;background:#f0f0f8;border-bottom:1px solid #ddd;color:#666;">📧 E-mail</td>
          <td style="padding:12px;background:#f0f0f8;border-bottom:1px solid #ddd;font-weight:600;">${email}</td></tr>
      <tr><td style="padding:12px;background:#f8f8ff;border-bottom:1px solid #ddd;color:#666;">🔑 Código</td>
          <td style="padding:12px;background:#f8f8ff;border-bottom:1px solid #ddd;font-weight:700;font-size:20px;letter-spacing:2px;">${codigoAcesso}</td></tr>
      ${whatsapp ? `<tr><td style="padding:12px;background:#f0f0f8;color:#666;">📱 WhatsApp</td>
          <td style="padding:12px;background:#f0f0f8;font-weight:600;">${whatsapp}</td></tr>` : ''}
    </table>
    <p style="color:#e74c3c;font-size:13px;">⚠️ Altere sua senha no primeiro acesso.</p>
    ${botao('Acessar o Portal', PORTAL_URL)}
  `);
  return enviar({ to: email, subject: '🚗 Movv Parceiros — Suas credenciais de acesso', html });
}

async function enviarRecuperacaoSenha({ nome, email, token }) {
  const link = `${PORTAL_URL}/reset-password?token=${token}`;
  const html = template(`
    <h2 style="color:#1a1a2e;">Redefinição de Senha 🔐</h2>
    <p style="color:#555;">Olá, <strong>${nome}</strong>! Clique abaixo para criar uma nova senha:</p>
    ${botao('Redefinir Minha Senha', link)}
    <p sty