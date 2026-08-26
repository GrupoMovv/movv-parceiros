const router = require('express').Router();
const fs = require('fs');
const path = require('path');

const CATALOGO_PDF_PATH = path.join(__dirname, '../../uploads/beneficios/catalogo-beneficios-seci.pdf');

// Rota pública (sem autenticação) — link enviado pelo Renan via WhatsApp.
router.get('/beneficios/catalogo.pdf', (req, res) => {
  if (!fs.existsSync(CATALOGO_PDF_PATH)) {
    return res.status(404).json({ error: 'Catálogo de benefícios não encontrado' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="catalogo-beneficios-seci.pdf"');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(CATALOGO_PDF_PATH);
});

module.exports = router;
