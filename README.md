# Movv Parceiros — Grupo Movv · Itumbiara/GO

Portal web completo de gestão de parceiros e comissões do Grupo Movv.

---

## Stack

| Camada     | Tecnologia                          |
|------------|-------------------------------------|
| Frontend   | React 18 + Vite + Tailwind CSS      |
| Backend    | Node.js + Express                   |
| Banco      | PostgreSQL 15+                      |
| Auth       | JWT (jsonwebtoken + bcryptjs)        |
| WhatsApp   | Z-API                               |
| Deploy     | Render (backend + frontend + DB)    |

---

## Rodando localmente

### Pré-requisitos
- Node.js 18+
- PostgreSQL 15+ rodando localmente
- npm ou yarn

### 1. Banco de dados

```bash
createdb movv_parceiros
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# edite .env com suas credenciais
npm install
npm run migrate    # executa 001_initial.sql
npm run seed       # insere dados de teste
npm run dev        # inicia em http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# edite VITE_API_URL se necessário
npm install
npm run dev        # inicia em http://localhost:5173
```

---

## Credenciais de teste (após seed)

| Perfil       | Código         | Senha    |
|--------------|----------------|----------|
| Admin        | ADMIN-001      | admin123 |
| Contabilidade| CONT-IT-001    | cont123  |
| Funcionário  | FUNC-IT-CS-001 | func123  |

---

## Deploy no Render

### Banco de dados (PostgreSQL)

1. Dashboard → **New → PostgreSQL**
2. Nome: `movv-parceiros-db`
3. Copie a **Internal Database URL**

### Backend (Web Service)

1. **New → Web Service** → conectar repositório
2. Configurações:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `node src/server.js`
3. Variáveis de ambiente:

```
DATABASE_URL         = <Internal Database URL do passo anterior>
JWT_SECRET           = <string longa e aleatória>
JWT_EXPIRES_IN       = 7d
NODE_ENV             = production
FRONTEND_URL         = <URL do frontend no Render>
ZAPI_INSTANCE_ID     = <sua instância Z-API>
ZAPI_TOKEN           = <seu token Z-API>
ZAPI_CLIENT_TOKEN    = <seu client token Z-API>
```

4. Após o primeiro deploy, execute no **Shell** do serviço:
```bash
node migrations/run.js
node seeds/seed.js
```

### Frontend (Static Site)

1. **New → Static Site** → mesmo repositório
2. Configurações:
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
3. Variável de ambiente:
```
VITE_API_URL = https://<seu-backend>.onrender.com/api
```

---

## Regras de negócio

| Situação                   | Regra                                                     |
|----------------------------|-----------------------------------------------------------|
| Produto padrão             | 1% do valor operado: 60% func. / 40% contabilidade        |
| Certificado digital        | 1% do valor operado: 100% para a contabilidade            |
| BPO R$1.399/mês — 1º mês  | 50% ao parceiro (R$699,50)                                |
| BPO R$1.399/mês — 2º mês+ | 5% recorrente (R$69,95/mês)                               |
| Protocolo de indicação     | MOV-ANO-SEQUENCIA, validade 30 dias                       |
| WhatsApp automático        | Enviado ao cliente via Z-API ao gerar protocolo           |
| Pagamento PIX              | Todo dia 5 do mês, comissões com status "approved"        |

## Códigos dos parceiros

| Tipo          | Formato         | Exemplo         |
|---------------|-----------------|-----------------|
| Contabilidade | CONT-IT-NNN     | CONT-IT-001     |
| Funcionário   | FUNC-IT-CS-NNN  | FUNC-IT-CS-001  |

---

## Estrutura do projeto

```
movv-parceiros/
├── backend/
│   ├── migrations/        # SQL schema
│   ├── seeds/             # Dados de teste
│   └── src/
│       ├── config/        # Conexão banco
│       ├── controllers/   # Lógica de negócio
│       ├── middleware/     # Auth JWT
│       ├── routes/        # Endpoints REST
│       └── services/      # Comissões, protocolo, Z-API
└── frontend/
    └── src/
        ├── components/    # Layout, Modal, Badge
        ├── contexts/      # AuthContext
        ├── pages/         # Login, Dashboard, Extrato, Indicar
        │   └── admin/     # Painel admin completo
        └── services/      # Axios
```

---

## API — Endpoints principais

| Método | Endpoint                      | Descrição                     | Auth     |
|--------|-------------------------------|-------------------------------|----------|
| POST   | /api/auth/login               | Login                         | Público  |
| GET    | /api/auth/me                  | Dados do usuário logado        | JWT      |
| GET    | /api/partners/stats           | Stats do parceiro logado       | JWT      |
| GET    | /api/partners                 | Listar parceiros               | Admin    |
| POST   | /api/partners                 | Criar parceiro                 | Admin    |
| GET    | /api/referrals                | Listar indicações              | JWT      |
| POST   | /api/referrals                | Criar indicação + WhatsApp     | JWT      |
| PUT    | /api/referrals/:id/confirm    | Confirmar venda + calcular     | Admin    |
| GET    | /api/commissions/statement    | Extrato do parceiro            | JWT      |
| PUT    | /api/commissions/approve      | Aprovar comissões              | Admin    |
| GET    | /api/payments/pending         | Parceiros com saldo a pagar    | Admin    |
| POST   | /api/payments                 | Registrar pagamento PIX        | Admin    |
| GET    | /api/products                 | Listar produtos                | JWT      |

---

Grupo Movv — Itumbiara/GO © 2024
