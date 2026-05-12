const app = require('./app');
const db = require('./config/database');

const PORT = process.env.PORT || 3001;

db.pool.connect()
  .then(() => {
    console.log('PostgreSQL conectado');
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log('Rotas registradas: auth, partners, referrals, commissions, payments, products, reports');
    });
  })
  .catch((err) => {
    console.error('Falha ao conectar ao banco de dados:', err.message);
    process.exit(1);
  });
