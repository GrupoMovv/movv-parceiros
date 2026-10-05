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
    });
  })
  .catch((err) => {
    console.error('Falha ao conectar ao banco de dados:', err.message);
    process.exit(1);
  });
