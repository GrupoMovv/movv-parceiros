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
app.use('/api/sindicato-empresas',     require('./routes/sindicatoEmpresas'));
app.use('/api/sindicato-beneficios',   require('./routes/sindicatoBeneficios'));
app.use('/api/sindicato-associados',   require('./routes/sindicatoAssociados'));
app.use('/api/sindicato-carteirinha',  require('./routes/sindicatoCarteirinha'));
app.use('/api/sindicato-contribuintes', require('./routes/sindicatoContribuintes'));
app.use('/api/sindicato-solicitacoes', require('./routes/sindicatoSolicitacoes'));
app.use('/api/sindicato-parceiros-solicitacoes', require('./routes/parceiroSolicitacoes'));
app.use('/api/sindicato-parceiro-interessados', require('./routes/sindicatoParceiroInteressados'));
app.use('/api/public/vender',          require('./routes/vender'));
app.use('/api/public/cadastro',        require('./routes/publicCadastro'));
app.use('/api/public/meu-cadastro',    require('./routes/publicMeuCadastro'));
app.use('/api/public/painel',          require('./routes/publicPainel'));
app.use('/api/parceiro/auth',          require('./routes/parceiroAuth'));
app.use('/api/parceiro/dashboard',     require('./routes/parceiroDashboard'));
app.use('/api/parceiro/perfil',        require('./routes/parceiroPerfil'));
app.use('/api/parceiro/produtos',      require('./routes/parceiroProdutos'));
app.use('/api/parceiro/promocoes',     require('./routes/parceiroPromocoes'));
app.use('/api/parceiro/interessados',  require('./routes/parceiroInteressados'));
app.use('/api/parceiro',               require('./routes/parceiroConta'));
app.use('/api/public/parceiro',        require('./routes/publicParceiroConta'));
app.use('/api/public',                 require('./routes/public'));
app.use('/',                           require('./routes/carteirinhaPublica'));
app.use('/',                           require('./routes/produtoPublico'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

module.exports = app;
