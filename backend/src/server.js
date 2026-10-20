const app = require('./app');
const db = require('./config/database');

const PORT = process.env.PORT || 3001;

db.pool.connect()
  .then(() => {
    console.log('PostgreSQL conectado');
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log('Rotas registradas: auth, partners, referrals, commissions, payments, products, reports');
      // Prazos do pedido pelo site (expira, cancela sem Pix, fecha entregue).
      // PEDIDOS_PRAZOS_TIMER=false desliga (aí só pela rota /api/interno).
      if (process.env.PEDIDOS_PRAZOS_TIMER !== 'false') require('./services/pedidoPrazos').iniciarTimer();
      // Loja do Clube: avisos de versão nova do termo e saída depois de 15 dias sem aceite.
      if (process.env.LOJA_CLUBE_TIMER !== 'false') require('./services/lojaClube').iniciarTimer();
      // Fecha Mês: convite (segunda) e lembrete do prazo (quinta) às lojas, 10:00.
      if (process.env.FECHA_MES_AVISOS_TIMER !== 'false') require('./services/fechaMesAvisos').iniciarTimer();
    });
  })
  .catch((err) => {
    console.error('Falha ao conectar ao banco de dados:', err.message);
    process.exit(1);
  });
