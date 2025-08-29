# 📞 Sistema de Gerenciamento de Contatos

Uma API REST robusta para gerenciamento de contatos, desenvolvida com Node.js, TypeScript, Fastify e PostgreSQL. O sistema oferece funcionalidades completas de CRUD (Create, Read, Update, Delete) para contatos e seus telefones associados, incluindo busca avançada e integração com API de clima.

## 🏗️ Arquitetura e Decisões Técnicas

### Stack Principal

- **Node.js 20+** com TypeScript nativo (`--experimental-strip-types`)
- **Fastify** - Framework web de alta performance
- **PostgreSQL** - Banco de dados relacional
- **Drizzle ORM** - Type-safe SQL query builder
- **Zod** - Validação de schemas TypeScript-first
- **Vitest** - Framework de testes moderno

### Arquitetura Adotada

#### 1. **Arquitetura em Camadas (Layered Architecture)**

```
src/
├── app.ts              # Configuração principal do servidor
├── server.ts           # Entry point da aplicação
├── database/           # Camada de dados
│   ├── client.ts       # Cliente do banco de dados
│   ├── schema.ts       # Definição das tabelas
│   └── seed.ts         # População inicial do banco
├── routes/             # Camada de roteamento
│   └── contacts/       # Módulo de contatos
└── test/               # Testes automatizados
```

#### 2. **Domain-Driven Design (DDD) Simplificado**

- **Entidades**: `contatos` e `telefones` com relacionamento 1:N
- **Agregados**: Contato como agregado principal que gerencia seus telefones
- **Value Objects**: Endereço completo encapsulado no contato

#### 3. **Type-Safe Development**

- **Zod** para validação runtime e geração de tipos
- **Drizzle ORM** para queries type-safe
- **Fastify Type Provider** para tipagem end-to-end

### Padrões e Práticas Adotadas

#### 🔒 **Segurança**

- Validação rigorosa de entrada com Zod
- Sanitização automática de dados
- Tratamento seguro de UUIDs
- Soft delete para preservar integridade referencial

#### 📊 **Observabilidade**

- Logging estruturado com Pino
- Documentação automática da API com Swagger/OpenAPI
- Testes de cobertura com relatórios HTML

#### 🚀 **Performance**

- Fastify para alta performance
- Pooling de conexões do PostgreSQL
- Transações para operações atômicas
- Paginação eficiente com offset/limit

#### 🧪 **Qualidade de Código**

- Testes unitários e de integração
- Cobertura de código automatizada
- TypeScript strict mode
- Linting e formatação consistente

### Estrutura do Banco de Dados

```sql
-- Tabela principal de contatos
contatos (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  codigoZip TEXT NOT NULL,
  endereco TEXT NOT NULL,
  numero TEXT NOT NULL,
  bairro TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  complemento TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Tabela de telefones (relacionamento 1:N)
telefones (
  id UUID PRIMARY KEY,
  numero TEXT NOT NULL,
  contato_id UUID REFERENCES contatos(id) ON DELETE CASCADE
)
```

## 🚀 Como Rodar o Projeto Localmente

### Pré-requisitos

- **Node.js 20+** (recomendado usar via nvm)
- **Docker e Docker Compose**
- **Git**

### 1. Clone o Repositório

```bash
git clone https://github.com/rafamenegheti/backend-test.git
cd backend-test
```

### 2. Instale as Dependências

```bash
npm install
```

### 3. Configure as Variáveis de Ambiente

Renomeie o arquivo **.env.test** para somente **.env**:

**.env** (testes):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/desafio_test
NODE_ENV=test
```

### 4. Inicie o Banco de Dados

```bash
# Inicia PostgreSQL via Docker
docker-compose up -d

# Aguarde alguns segundos para o banco inicializar
# Se a imagem não subir de primeira, rode o comando novamente
```

### 5. Execute as Migrações

```bash
# Gera as migrações
npm run db:generate

# Aplica as migrações
npm run db:migrate
```

É importante iniciar uma nova instância da imagem, pois pode ocorrer erros na hora de rodar as migrations caso o banco de dados ja exista antes

### 6. (Opcional) Popule o Banco com Dados de Teste

```bash
npm run db:seed
```

### 7. Inicie o Servidor de Desenvolvimento

```bash
npm run dev
```

A API estará disponível em: `http://localhost:3333`

### Banco de Dados

```bash
# Interface visual do banco (Drizzle Studio)
npm run db:studio
```

## 📚 Documentação da API

### Swagger UI

Acesse a documentação em: `http://localhost:3333/docs`

Voce pode mudar a UI para o Scalar se preferir, é só comentar as linhas 40, 41 e 42 do arquivo src/app e descomentar as linhas 44, 45 e 46.

### Endpoints Principais

#### Contatos

- `POST /contacts` - Criar novo contato
- `GET /contacts` - Listar contatos (com busca e paginação)
- `GET /contacts/:id` - Buscar contato específico (com dados de clima)
- `PUT /contacts/:id` - Atualizar contato
- `DELETE /contacts/:id` - Remover contato (soft delete)

### Exemplos de Uso

### Arquivo de Requisições HTTP

O projeto inclui um arquivo `requisicoes.http` com exemplos completos de todas as operações da API, incluindo casos de teste para validações e tratamento de erros.

## 🧪 Testes

### Executar Todos os Testes

```bash
# Testes de integração com cobertura
npm test

# Testes unitários
npm run test:unit
```

### Estrutura de Testes

- **Testes de Integração**: `/src/test/routes/` - Testam endpoints completos
- **Testes Unitários**: `/src/test/unit/` - Testam funções isoladas
- **Testes de Schema**: `/src/test/database/` - Validam estrutura do banco
- **Mocks e Utilidades**: `/src/test/utils.ts` - Helpers para testes

## 🛠️ Ferramentas de Desenvolvimento

### Monitoramento e Debug

- **Logs estruturados**: Pino com formatação colorida
- **Health check**: Endpoint implícito do Fastify
- **Métricas**: Via logs de request/response

### Docker Support

O projeto inclui `docker-compose.yml` para facilitar o desenvolvimento local. Para uso em produção, pode ser facilmente dockerizado:

## 📝 Funcionalidades Implementadas

### ✅ Funcionalidades Principais

- [x] CRUD completo de contatos
- [x] Relacionamento 1:N com telefones
- [x] Busca textual em todos os campos
- [x] Paginação eficiente
- [x] Soft delete para contatos
- [x] Validação robusta de dados
- [x] Tratamento de erros padronizado
- [x] Documentação automática da API
- [x] Integração com API de clima

### ✅ Qualidade e Testes

- [x] Testes de integração completos
- [x] Testes unitários
- [x] CI/CD ready
- [x] Logs estruturados
- [x] Type safety end-to-end

### ✅ Developer Experience

- [x] Hot reload em desenvolvimento
- [x] Arquivo de requisições HTTP para testes manuais
- [x] Setup automatizado com Docker
- [x] Documentação Swagger
- [x] Scripts npm organizados

## 📊 Decisões de Design

### Por que Fastify?

- **Type Safety**: Suporte nativo a TypeScript
- **Plugin System**: Arquitetura modular
- **JSON Schema**: Validação de entrada automática

### Por que Drizzle ORM?

- **Type Safety**: Queries totalmente tipadas
- **Performance**: Zero overhead runtime
- **Migrations**: Sistema robusto de versionamento
- **Developer Experience**: Auto-complete e validação

### Por que Zod?

- **Type Inference**: Tipos TypeScript automáticos
- **Runtime Validation**: Validação em tempo de execução
- **Error Messages**: Mensagens de erro claras
- **Ecosystem**: Integração perfeita com Fastify

### Arquitetura de Testes

- **Vitest**: Performance superior ao Jest
- **Test Database**: Banco separado para testes
- **Transaction Rollback**: Testes isolados
- **Coverage**: Relatórios detalhados

---

**Desenvolvido com ❤️ por Rafael**
