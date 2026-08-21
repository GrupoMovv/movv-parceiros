const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

const allowedOrigins = [
  'https://portal.grupomovv.com.br',
  'https://movv-parceiros.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permite requisições sem origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Não permitido por CORS: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Responde preflight OPTIONS em todas as rotas
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/partners', require('./routes/partners'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/commissions', require('./routes/commissions'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/products', require('./routes/products'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/employees',  require('./routes/employees'));
app.use('/api/interest',              require('./routes/interest'));
app.use('/api/internal-collaborators', require('./routes/internalCollaborators'));
app.use('/api/indicators',             require('./routes/indicators'));
app.use('/api/direta',                 require('./routes/direta'));
app.use('/api/contabilidades-precos',  require('./routes/contabilidadesPrecos'));
app.use('/api/sindicato',              require('./routes/sindicato'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

module.exports = app;
