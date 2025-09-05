// ====================================================================
// GERADOR DE CONFIGURAÇÃO ODOO - JavaScript Refatorado
// ====================================================================

/**
 * @typedef {Object} OdooConfig - Configuração completa do projeto Odoo
 * @property {string} projectName - Nome do projeto (usado para containers)
 * @property {string} odooVersion - Versão do Odoo (ex: 17.0)
 * @property {number} httpPort - Porta HTTP principal do Odoo
 * @property {number} chatPort - Porta para longpolling/chat
 * @property {string} domain - Domínio personalizado (opcional)
 * @property {string} dbName - Nome da database PostgreSQL
 * @property {string} dbUser - Usuário do PostgreSQL
 * @property {string} dbPassword - Senha do PostgreSQL
 * @property {string} adminPassword - Senha master do Odoo
 * @property {boolean} enablePostgresPort - Expor porta 5432 do PostgreSQL
 * @property {number} workers - Número de workers/processos
 * @property {number} cronThreads - Threads para jobs automáticos
 * @property {number} memoryLimit - Limite de memória em GB
 * @property {string} logLevel - Nível de logging (error/warn/info/debug)
 * @property {boolean} enableRedis - Habilitar Redis para cache
 * @property {boolean} enableNginx - Habilitar Nginx como proxy reverso
 */

// ====================================================================
// UTILITÁRIOS E VALIDAÇÕES
// ====================================================================

/**
 * Gera senha segura usando crypto API ou fallback
 * @param {number} length - Comprimento da senha (padrão: 24)
 * @returns {string} Senha gerada com alta entropia
 */
function generateSecurePassword(length = 24) {
    // Charset com letras, números e símbolos seguros para senhas
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    
    // Tenta usar crypto API do browser (mais seguro)
    if (window.crypto && window.crypto.getRandomValues) {
        const array = new Uint8Array(length);
        window.crypto.getRandomValues(array);
        return Array.from(array, byte => charset[byte % charset.length]).join('');
    }
    
    // Fallback para browsers antigos (menos seguro, mas funcional)
    console.warn('Crypto API não disponível, usando Math.random() como fallback');
    let result = '';
    for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
}

/**
 * Validação robusta do formulário com verificações específicas
 * @param {OdooConfig} config - Configuração a ser validada
 * @returns {string[]} Array de erros encontrados (vazio se válido)
 */
function validateForm(config) {
    const errors = [];
    
    // === VALIDAÇÕES CRÍTICAS (campos obrigatórios) ===
    // Validar se campos essenciais não estão vazios antes de validar formato
    if (!config.projectName || config.projectName.trim() === '') {
        errors.push('Nome do projeto é obrigatório');
        return errors; // Para aqui se campo crítico está vazio
    }
    
    if (!config.dbPassword || config.dbPassword.trim() === '') {
        errors.push('Senha do banco é obrigatória');
        return errors;
    }
    
    if (!config.adminPassword || config.adminPassword.trim() === '') {
        errors.push('Senha master é obrigatória');
        return errors;
    }
    
    // === VALIDAÇÕES DE FORMATO ===
    // Nome do projeto: apenas letras minúsculas, números e hífens
    // Não pode começar ou terminar com hífen (padrão Docker)
    if (!config.projectName.match(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/) && config.projectName.length > 1) {
        errors.push('Nome do projeto deve conter apenas letras minúsculas, números e hífens (não pode começar ou terminar com hífen)');
    }
    
    // Verificar se não usa palavras reservadas do Docker/sistema
    const reservedWords = ['docker', 'compose', 'postgres', 'redis', 'nginx', 'localhost', 'api', 'www'];
    if (reservedWords.includes(config.projectName.toLowerCase())) {
        errors.push(`"${config.projectName}" é uma palavra reservada. Escolha outro nome.`);
    }
    
    // === VALIDAÇÕES DE REDE ===
    // Portas devem estar na faixa não-privilegiada (>1024) e válida
    if (config.httpPort < 1024 || config.httpPort > 65535) {
        errors.push('Porta HTTP deve estar entre 1024 e 65535');
    }
    
    if (config.chatPort < 1024 || config.chatPort > 65535) {
        errors.push('Porta Chat deve estar entre 1024 e 65535');
    }
    
    // Portas não podem ser iguais (conflito)
    if (config.httpPort === config.chatPort) {
        errors.push('Portas HTTP e Chat não podem ser iguais');
    }
    
    // Verificar se não estão usando portas comuns do sistema
    const commonPorts = [3306, 5432, 6379, 22, 80, 443, 21, 25, 53, 110, 143, 993, 995];
    if (commonPorts.includes(config.httpPort)) {
        errors.push(`Porta ${config.httpPort} é comumente usada por outros serviços. Escolha outra porta.`);
    }
    if (commonPorts.includes(config.chatPort)) {
        errors.push(`Porta ${config.chatPort} é comumente usada por outros serviços. Escolha outra porta.`);
    }
    
    // === VALIDAÇÕES DE DOMÍNIO ===
    // Domínio é opcional, mas se fornecido deve ter formato válido
    if (config.domain && config.domain.trim() !== '') {
        // Regex mais rigoroso para domínios: pelo menos um ponto, sem caracteres especiais
        if (!config.domain.match(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/)) {
            errors.push('Formato de domínio inválido (ex: meusite.com.br)');
        }
        
        // Verificar se não está usando localhost ou IPs
        if (config.domain.toLowerCase().includes('localhost') || config.domain.match(/^\d+\.\d+\.\d+\.\d+$/)) {
            errors.push('Use um domínio real ou deixe em branco para desenvolvimento local');
        }
    }
    
    // === VALIDAÇÕES DE SEGURANÇA ===
    // Senhas devem ter comprimento mínimo e complexidade adequada
    if (config.dbPassword.length < 12) {
        errors.push('Senha do banco deve ter pelo menos 12 caracteres');
    }
    
    if (config.adminPassword.length < 12) {
        errors.push('Senha master deve ter pelo menos 12 caracteres');
    }
    
    // Verificar se senhas não são muito simples (sem espaços em branco, não só números)
    if (config.dbPassword.includes(' ') || config.adminPassword.includes(' ')) {
        errors.push('Senhas não podem conter espaços em branco');
    }
    
    if (config.dbPassword.match(/^\d+$/) || config.adminPassword.match(/^\d+$/)) {
        errors.push('Senhas não podem ser apenas números');
    }
    
    // === VALIDAÇÕES DE RECURSOS ===
    // Workers: verificar se configuração faz sentido
    if (config.workers > 0 && config.workers < 2) {
        errors.push('Se usar workers, configure pelo menos 2. Use 0 apenas para desenvolvimento.');
    }
    
    return errors;
}

/**
 * Exibe toast de notificação com diferentes tipos
 * @param {string} message - Mensagem a ser exibida
 * @param {string} type - Tipo do toast (success, error, warning)
 */
function showToast(message, type = 'success') {
    // Remove toast anterior se existir (evita múltiplos toasts)
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    // Criar elemento do toast com estilo inline para independência
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Aplicar estilos CSS inline para não depender de arquivo externo
    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: '1000',
        padding: '12px 20px',
        borderRadius: '8px',
        color: 'white',
        fontWeight: '500',
        fontSize: '14px',
        // Cores baseadas no tipo de notificação
        background: type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#27ae60',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        transform: 'translateX(100%)', // Começa fora da tela
        transition: 'transform 0.3s ease',
        maxWidth: '300px'
    });
    
    document.body.appendChild(toast);
    
    // Animação de entrada (slide da direita)
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Remoção automática após 4 segundos com animação de saída
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 4000);
}

/**
 * Copia texto para área de transferência com fallback para browsers antigos
 * @param {string} text - Texto a ser copiado
 * @returns {Promise<boolean>} true se sucesso, false se erro
 */
async function copyToClipboard(text) {
    try {
        // Método moderno (Clipboard API)
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        
        // Fallback method para browsers antigos
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    } catch (err) {
        console.error('Falha ao copiar:', err);
        return false;
    }
}

/**
 * Alterna visibilidade de campos de senha
 * @param {string} fieldId - ID do campo de senha
 */
function togglePasswordVisibility(fieldId) {
    const field = document.getElementById(fieldId);
    const toggleBtn = document.querySelector(`[data-field="${fieldId}"]`);
    
    if (!field || !toggleBtn) {
        console.error('Campo ou botão não encontrado:', fieldId);
        return;
    }
    
    // Alternar entre password e text para mostrar/ocultar
    if (field.type === 'password') {
        field.type = 'text';
        toggleBtn.innerHTML = '🙈 Ocultar';
    } else {
        field.type = 'password';
        toggleBtn.innerHTML = '👁️ Mostrar';
    }
}

// ====================================================================
// GERADORES DE ARQUIVOS DE CONFIGURAÇÃO
// ====================================================================

/**
 * Gera arquivo docker-compose.yml completo
 * @param {OdooConfig} config - Configuração do projeto
 * @returns {string} Conteúdo do arquivo docker-compose.yml
 */
function generateDockerCompose(config) {
    return `version: '3.8'

# Configuração Docker Compose para ${config.projectName}
# Gerado automaticamente pelo Gerador de Configuração Odoo

services:
  # ===================================================================
  # POSTGRESQL - Banco de dados principal
  # ===================================================================
  db:
    image: postgres:15-alpine
    container_name: ${config.projectName}_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: \${POSTGRES_DB}
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data/pgdata
${config.enablePostgresPort ? '    ports:\n      - "5432:5432"  # Porta exposta apenas para desenvolvimento' : '    # Porta não exposta por segurança'}
    networks:
      - ${config.projectName}_network
    # Health check para garantir que banco está pronto antes de iniciar Odoo
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER} -d \${POSTGRES_DB}"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  # ===================================================================
  # ODOO - Aplicação principal
  # ===================================================================
  odoo:
    image: odoo:\${ODOO_VERSION}
    container_name: ${config.projectName}_odoo
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy  # Aguarda banco ficar saudável
    environment:
      HOST: db
      USER: \${POSTGRES_USER}
      PASSWORD: \${POSTGRES_PASSWORD}
      ODOO_RC: /etc/odoo/odoo.conf
    ports:
      - "${config.httpPort}:8069"   # Porta principal HTTP
      - "${config.chatPort}:8072"   # Porta para longpolling/chat
    volumes:
      - odoo_data:/var/lib/odoo      # Dados persistentes do Odoo
      - ./config:/etc/odoo           # Arquivos de configuração
      - ./logs:/var/log/odoo         # Logs do sistema
	  - ./addons:/mnt/extra-addons 	 # Pasta para módulos extra
    networks:
      - ${config.projectName}_network
    # Limites de recursos para evitar consumo excessivo
    deploy:
      resources:
        limits:
          memory: ${config.memoryLimit}G
        reservations:
          memory: ${Math.max(1, config.memoryLimit - 1)}G
${config.enableRedis ? `
  # ===================================================================
  # REDIS - Cache e sessões (melhora significativamente a performance)
  # ===================================================================
  redis:
    image: redis:7-alpine
    container_name: ${config.projectName}_redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - ${config.projectName}_network
    # Configuração otimizada para cache
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
` : ''}${config.enableNginx ? `
  # ===================================================================
  # NGINX - Proxy reverso para produção (SSL, compressão, cache)
  # ===================================================================
  nginx:
    image: nginx:alpine
    container_name: ${config.projectName}_nginx
    restart: unless-stopped
    ports:
      - "80:80"    # HTTP
      - "443:443"  # HTTPS (configure SSL separadamente)
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro  # Configuração personalizada
      - ./nginx/ssl:/etc/ssl/certs:ro                # Certificados SSL
    depends_on:
      - odoo
    networks:
      - ${config.projectName}_network
` : ''}
# ===================================================================
# VOLUMES - Dados persistentes
# ===================================================================
volumes:
  postgres_data:
    driver: local  # Dados do PostgreSQL
  odoo_data:
    driver: local  # Dados do Odoo (filestore, etc)${config.enableRedis ? '\n  redis_data:\n    driver: local  # Cache do Redis' : ''}

# ===================================================================
# NETWORK - Rede isolada para comunicação entre containers
# ===================================================================
networks:
  ${config.projectName}_network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16  # Subnet dedicada para evitar conflitos`;
}

/**
 * Gera arquivo .env com variáveis de ambiente
 * @param {OdooConfig} config - Configuração do projeto
 * @returns {string} Conteúdo do arquivo .env
 */
function generateEnvFile(config) {
    return `# ===================================================================
# VARIÁVEIS DE AMBIENTE - ${config.projectName}
# ===================================================================
# IMPORTANTE: Este arquivo contém informações sensíveis!
# - Adicione .env ao seu .gitignore
# - Nunca commite senhas no controle de versão
# - Use permissões restritivas (chmod 600 .env)

# ===================================================================
# CONFIGURAÇÕES DO BANCO DE DADOS
# ===================================================================
POSTGRES_DB=${config.dbName}
POSTGRES_USER=${config.dbUser}
POSTGRES_PASSWORD=${config.dbPassword}

# ===================================================================
# CONFIGURAÇÕES DO ODOO
# ===================================================================
ODOO_VERSION=${config.odooVersion}
ODOO_ADMIN_PASSWORD=${config.adminPassword}

# ===================================================================
# CONFIGURAÇÕES DE REDE
# ===================================================================
HTTP_PORT=${config.httpPort}
CHAT_PORT=${config.chatPort}
DOMAIN=${config.domain || 'localhost'}

# ===================================================================
# CONFIGURAÇÕES DE PERFORMANCE
# ===================================================================
WORKERS=${config.workers}
MEMORY_LIMIT=${config.memoryLimit}
LOG_LEVEL=${config.logLevel}

# ===================================================================
# FEATURES HABILITADAS
# ===================================================================
ENABLE_REDIS=${config.enableRedis}
ENABLE_NGINX=${config.enableNginx}

# ===================================================================
# NOTAS DE SEGURANÇA
# ===================================================================
# 1. Senhas geradas automaticamente com 24 caracteres seguros
# 2. Mude as senhas periodicamente em produção
# 3. Use vault/secrets em ambientes críticos
# 4. Monitore logs de acesso regularmente`;
}

/**
 * Gera arquivo de configuração odoo.conf
 * @param {OdooConfig} config - Configuração do projeto
 * @returns {string} Conteúdo do arquivo odoo.conf
 */
function generateOdooConf(config) {
    return `# ===================================================================
# CONFIGURAÇÃO ODOO - ${config.projectName}
# ===================================================================
# Arquivo de configuração principal do Odoo
# Documentação: https://www.odoo.com/documentation/

[options]
# ===================================================================
# CONFIGURAÇÕES DO BANCO DE DADOS
# ===================================================================
db_host = db
db_port = 5432
db_user = ${config.dbUser}
db_password = ${config.dbPassword}
db_name = ${config.dbName}

# ===================================================================
# CONFIGURAÇÕES DO SERVIDOR WEB
# ===================================================================
http_port = 8069
longpolling_port = 8072
workers = ${config.workers}
max_cron_threads = ${config.cronThreads}

# ===================================================================
# SEGURANÇA E CONTROLE DE ACESSO
# ===================================================================
admin_passwd = ${config.adminPassword}
list_db = False                    # Oculta lista de BDs por segurança
db_filter = ^${config.dbName}$     # Permite acesso apenas ao BD configurado

# ===================================================================
# LIMITES DE PERFORMANCE E RECURSOS
# ===================================================================
limit_memory_hard = ${config.memoryLimit * 1024 * 1024 * 1024}      # Limite máximo de memória
limit_memory_soft = ${Math.floor(config.memoryLimit * 0.8) * 1024 * 1024 * 1024}  # Limite suave (80% do máximo)
limit_request = 8192               # Número máximo de requests por worker
limit_time_cpu = 600               # Timeout CPU (10 minutos)
limit_time_real = 1200             # Timeout real (20 minutos)

# ===================================================================
# CONFIGURAÇÕES DE LOG
# ===================================================================
logfile = /var/log/odoo/odoo.log
log_level = ${config.logLevel}
logrotate = True                   # Rotação automática de logs
log_handler = :INFO,werkzeug:WARNING,odoo.service.server:INFO
log_db = False                     # Não loggar no banco (performance)
log_db_level = warning

# ===================================================================
# ADDONS E MÓDULOS
# ===================================================================
addons_path = /mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons

# ===================================================================
# CONFIGURAÇÕES DE EMAIL
# ===================================================================
email_from = admin@${config.domain || 'localhost'}
smtp_server = localhost
smtp_port = 25
smtp_ssl = False
smtp_user = False
smtp_password = False
# NOTA: Configure SMTP real para produção

# ===================================================================
# CONFIGURAÇÕES DE SESSÃO E CACHE
# ===================================================================${config.enableRedis ? `
# Cache Redis (melhora significativamente a performance)
enable_redis = True
redis_host = redis
redis_port = 6379
redis_dbindex = 1
redis_pass = False` : `
# Redis desabilitado - usando cache em memória local`}

# ===================================================================
# CONFIGURAÇÕES EXTRAS PARA PRODUÇÃO
# ===================================================================
# proxy_mode = True                # Descomente se usar Nginx/Apache
# xmlrpc_interface = 127.0.0.1     # Restringir interface XML-RPC
# netrpc_interface = 127.0.0.1     # Restringir interface NetRPC`;
}

/**
 * Gera script de setup/instalação
 * @param {OdooConfig} config - Configuração do projeto
 * @returns {string} Conteúdo do script setup.sh
 */
function generateSetupScript(config) {
    return `#!/bin/bash

# ===================================================================
# SCRIPT DE SETUP - ${config.projectName}
# ===================================================================
# Script automatizado para configurar ambiente Odoo
# Gerado pelo Gerador de Configuração Odoo

echo "🚀 Iniciando setup do projeto ${config.projectName}"
echo "=================================================="

# ===================================================================
# VERIFICAÇÕES PRELIMINARES
# ===================================================================
echo "🔍 Verificando dependências..."

# Verificar se Docker está instalado e rodando
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado. Instale o Docker primeiro:"
    echo "   📖 https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker não está rodando. Inicie o Docker primeiro."
    exit 1
fi

# Verificar se Docker Compose está disponível
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose não está instalado. Instale o Docker Compose:"
    echo "   📖 https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker e Docker Compose estão disponíveis!"

# ===================================================================
# CRIAÇÃO DA ESTRUTURA DE DIRETÓRIOS
# ===================================================================
echo "📁 Criando estrutura de pastas..."

# Criar diretórios necessários
mkdir -p config logs addons${config.enableNginx ? ' nginx nginx/ssl' : ''}

# ===================================================================
# CONFIGURAÇÃO DE PERMISSÕES
# ===================================================================
echo "🔐 Configurando permissões..."

# Permissões seguras para arquivos sensíveis
chmod 755 logs                     # Diretório de logs
chmod 600 .env                     # Arquivo de ambiente (apenas proprietário)
chmod 644 config/odoo.conf         # Configuração do Odoo (leitura geral)
chmod +x setup.sh                  # Script executável

# Criar diretório para backups (boa prática)
mkdir -p backups
chmod 755 backups

# ===================================================================
# VERIFICAÇÕES DE SEGURANÇA
# ===================================================================
echo "🔒 Verificando configurações de segurança..."

# Verificar se .env não está no git
if git rev-parse --git-dir > /dev/null 2>&1; then
    if git check-ignore .env > /dev/null 2>&1; then
        echo "✅ Arquivo .env está no .gitignore"
    else
        echo "⚠️  ATENÇÃO: Adicione '.env' ao seu .gitignore!"
    fi
fi

# ===================================================================
# INICIALIZAÇÃO DOS CONTAINERS
# ===================================================================
echo "🐳 Iniciando containers Docker..."

# Usar docker-compose ou docker compose (versões mais novas)
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

echo "📦 Baixando imagens Docker..."
$COMPOSE_CMD pull

echo "🚀 Iniciando serviços..."
$COMPOSE_CMD up -d

# ===================================================================
# VERIFICAÇÃO DO STATUS
# ===================================================================
echo "⏳ Aguardando serviços ficarem prontos..."
sleep 10

echo "📊 Status dos containers:"
$COMPOSE_CMD ps

# ===================================================================
# INFORMAÇÕES FINAIS
# ===================================================================
echo ""
echo "🎉 Setup concluído com sucesso!"
echo "=================================================="
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. Aguarde alguns minutos para o Odoo inicializar completamente"
echo "2. Acesse: http://localhost:${config.httpPort}"
echo "3. Configure sua primeira empresa no Odoo"
echo ""
echo "🔧 COMANDOS ÚTEIS:"
echo "• Ver logs:        $COMPOSE_CMD logs -f odoo"
echo "• Parar:           $COMPOSE_CMD down"
echo "• Reiniciar:       $COMPOSE_CMD restart odoo"
echo "• Status:          $COMPOSE_CMD ps"
echo "• Backup BD:       $COMPOSE_CMD exec db pg_dump -U ${config.dbUser} ${config.dbName} > backups/backup_\$(date +%Y%m%d_%H%M%S).sql"
echo ""
echo "🔐 SEGURANÇA:"
echo "• Senhas estão no arquivo .env"
echo "• Configure SSL para produção"
echo "• Faça backups regulares"
echo "• Monitore logs regularmente"
echo ""
echo "📖 DOCUMENTAÇÃO:"
echo "• Odoo: https://www.odoo.com/documentation"
echo "• Docker: https://docs.docker.com"`;
}

/**
 * Gera arquivo .gitignore para o projeto
 * @returns {string} Conteúdo do arquivo .gitignore
 */
function generateGitignore() {
    return `# ===================================================================
# GITIGNORE - Projeto Odoo
# ===================================================================

# ===================================================================
# ARQUIVOS SENSÍVEIS (NUNCA COMMITAR)
# ===================================================================
.env                    # Variáveis de ambiente com senhas
*.log                   # Arquivos de log
*.key                   # Chaves privadas
*.pem                   # Certificados

# ===================================================================
# DADOS PERSISTENTES
# ===================================================================
logs/                   # Logs do Odoo
backups/                # Backups do banco de dados
data/                   # Dados temporários

# ===================================================================
# CERTIFICADOS SSL
# ===================================================================
nginx/ssl/*.key         # Chaves privadas SSL
nginx/ssl/*.crt         # Certificados SSL
nginx/ssl/*.pem         # Certificados PEM

# ===================================================================
# ARQUIVOS DO SISTEMA OPERACIONAL
# ===================================================================
.DS_Store               # macOS
Thumbs.db               # Windows
desktop.ini             # Windows

# ===================================================================
# ARQUIVOS DE IDEs
# ===================================================================
.vscode/                # Visual Studio Code
.idea/                  # IntelliJ/PyCharm
*.swp                   # Vim
*.swo                   # Vim
*~                      # Backup files

# ===================================================================
# ARQUIVOS TEMPORÁRIOS
# ===================================================================
*.tmp                   # Arquivos temporários
*.temp                  # Arquivos temporários
.cache/                 # Cache de aplicações

# ===================================================================
# NOTAS
# ===================================================================
# Este .gitignore protege informações sensíveis
# Sempre revise antes de commitar arquivos`;
}

/**
 * Gera configuração do Nginx (se habilitado)
 * @param {OdooConfig} config - Configuração do projeto
 * @returns {string} Conteúdo do arquivo nginx.conf
 */
function generateNginxConf(config) {
    return `# ===================================================================
# CONFIGURAÇÃO NGINX - ${config.projectName}
# ===================================================================
# Proxy reverso otimizado para Odoo
# Melhora performance, segurança e facilita configuração SSL

events {
    worker_connections 1024;        # Conexões simultâneas por worker
    use epoll;                     # Método eficiente para Linux
}

http {
    # ===============================================================
    # CONFIGURAÇÕES BÁSICAS
    # ===============================================================
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Formato de logs personalizado
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;

    # Otimizações de performance
    sendfile on;                   # Transferência eficiente de arquivos
    tcp_nopush on;                 # Otimiza envio de headers
    tcp_nodelay on;                # Reduz latência
    keepalive_timeout 65;          # Mantém conexões abertas
    types_hash_max_size 2048;      # Cache de tipos MIME
    client_max_body_size 128M;     # Limite para uploads (arquivos Odoo)

    # ===============================================================
    # COMPRESSÃO GZIP (melhora velocidade)
    # ===============================================================
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;          # Só comprime arquivos > 1KB
    gzip_proxied any;
    gzip_comp_level 6;             # Nível de compressão balanceado
    gzip_types 
        text/plain 
        text/css 
        text/xml 
        text/javascript 
        application/javascript 
        application/xml+rss 
        application/json;

    # ===============================================================
    # UPSTREAM - Definição dos backends
    # ===============================================================
    upstream odoo {
        server odoo:8069;           # Container principal do Odoo
    }

    upstream odoochat {
        server odoo:8072;           # Container para longpolling/chat
    }

    # ===============================================================
    # SERVIDOR HTTP (porta 80)
    # ===============================================================
    server {
        listen 80;
        server_name ${config.domain || 'localhost'};

        # Para HTTPS em produção, descomente a linha abaixo:
        # return 301 https://$server_name$request_uri;

        # Configurações de proxy para comunicação com Odoo
        proxy_read_timeout 720s;    # Timeout de leitura (12 min)
        proxy_connect_timeout 720s; # Timeout de conexão
        proxy_send_timeout 720s;    # Timeout de envio
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto http;

        # ========================================================
        # ROTA PARA LONGPOLLING (chat, notificações em tempo real)
        # ========================================================
        location /longpolling {
            proxy_pass http://odoochat;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_http_version 1.1;
            proxy_buffering off;
        }

        # ========================================================
        # ARQUIVOS ESTÁTICOS (CSS, JS, imagens)
        # ========================================================
        location ~* /web/static/ {
            proxy_pass http://odoo;
            proxy_cache_valid 200 60m;    # Cache por 1 hora
            proxy_buffering on;
            expires 864000;               # Expires em 10 dias
            add_header Cache-Control "public, immutable";
        }

        # ========================================================
        # TODAS AS OUTRAS ROTAS (interface principal)
        # ========================================================
        location / {
            proxy_pass http://odoo;
            proxy_redirect off;
        }

        # ========================================================
        # SEGURANÇA BÁSICA
        # ========================================================
        # Ocultar versão do Nginx
        server_tokens off;
        
        # Headers de segurança
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }

    # ===============================================================
    # SERVIDOR HTTPS (porta 443) - DESCOMENTE PARA SSL
    # ===============================================================
    # server {
    #     listen 443 ssl http2;
    #     server_name ${config.domain || 'localhost'};
    #     
    #     # Certificados SSL (configure seus certificados)
    #     ssl_certificate /etc/ssl/certs/your-cert.crt;
    #     ssl_certificate_key /etc/ssl/certs/your-cert.key;
    #     
    #     # Configurações SSL modernas
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #     ssl_ciphers HIGH:!aNULL:!MD5;
    #     ssl_prefer_server_ciphers on;
    #     
    #     # Configurações de proxy (mesmas do HTTP)
    #     proxy_read_timeout 720s;
    #     proxy_connect_timeout 720s;
    #     proxy_send_timeout 720s;
    #     proxy_set_header Host $http_host;
    #     proxy_set_header X-Real-IP $remote_addr;
    #     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #     proxy_set_header X-Forwarded-Proto https;
    #     
    #     location /longpolling {
    #         proxy_pass http://odoochat;
    #     }
    #     
    #     location / {
    #         proxy_pass http://odoo;
    #         proxy_redirect off;
    #     }
    # }
}`;
}

// ====================================================================
// CLASSE PRINCIPAL DO WIZARD DE CONFIGURAÇÃO
// ====================================================================

/**
 * Classe que gerencia todo o wizard de configuração do Odoo
 * Controla navegação entre passos, validação, geração de arquivos
 */
class OdooConfigurationWizard {
    constructor() {
        // === ESTADO DO WIZARD ===
        this.currentStep = 1;      // Passo atual (1-4)
        this.totalSteps = 4;       // Total de passos após remover addons
        this.config = {};          // Configuração coletada
        
        // Inicializar wizard
        this.init();
    }
    
    /**
     * Inicialização do wizard - gera senhas e configura eventos
     */
    init() {
        console.log('Inicializando Gerador de Configuração Odoo...');
        
        // Gerar senhas seguras iniciais
        this.generatePasswords();
        
        // Configurar todos os event listeners
        this.setupEventListeners();
        
        // Atualizar barra de progresso inicial
        this.updateProgress();
        
        console.log('Wizard inicializado com sucesso!');
    }
    
    /**
     * Gera senhas seguras automaticamente para banco e admin
     */
    generatePasswords() {
        console.log('Gerando senhas seguras...');
        
        // Gerar senhas com 24 caracteres de alta entropia
        this.config.dbPassword = generateSecurePassword(24);
        this.config.adminPassword = generateSecurePassword(24);
        
        // Atualizar campos na interface
        this.updateField('dbPassword', this.config.dbPassword);
        this.updateField('adminPassword', this.config.adminPassword);
        
        console.log('Senhas geradas e aplicadas aos campos');
    }
    
    /**
     * Atualiza valor de um campo na interface
     * @param {string} fieldId - ID do campo HTML
     * @param {string} value - Valor a ser definido
     */
    updateField(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = value;
        } else {
            console.warn(`Campo ${fieldId} não encontrado`);
        }
    }
    
    /**
     * Configura todos os event listeners do wizard
     */
    setupEventListeners() {
        // === BOTÕES DE NAVEGAÇÃO ===
        const nextBtn = document.getElementById('nextBtn');
        const prevBtn = document.getElementById('prevBtn');
        
        if (nextBtn) nextBtn.onclick = () => this.nextStep();
        if (prevBtn) prevBtn.onclick = () => this.previousStep();
        
        // === EVENT LISTENER GLOBAL PARA CLIQUES ===
        document.addEventListener('click', (e) => {
            // Toggle de visibilidade de senhas
            if (e.target.classList.contains('toggle-password')) {
                e.preventDefault();
                const fieldId = e.target.dataset.field;
                togglePasswordVisibility(fieldId);
                return;
            }
            
            // Botão de gerar senhas
            if (e.target.textContent.includes('Gerar Senha')) {
                e.preventDefault();
                this.generatePasswords();
                showToast('Novas senhas geradas com sucesso!', 'success');
                return;
            }
        });
        
        // === VALIDAÇÃO EM TEMPO REAL ===
        // Adicionar validação nos campos críticos
        const criticalFields = ['projectName', 'httpPort', 'chatPort', 'domain'];
        criticalFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', () => this.validateField(fieldId));
            }
        });
        
        console.log('Event listeners configurados');
    }
    
    /**
     * Valida um campo específico em tempo real
     * @param {string} fieldId - ID do campo a ser validado
     */
    validateField(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        const value = field.value.trim();
        let isValid = true;
        let message = '';
        
        // Validações específicas por campo
        switch (fieldId) {
            case 'projectName':
                if (value && !value.match(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)) {
                    isValid = false;
                    message = 'Nome deve conter apenas letras minúsculas, números e hífens';
                }
                break;
                
            case 'httpPort':
            case 'chatPort':
                const port = parseInt(value);
                if (value && (port < 1024 || port > 65535)) {
                    isValid = false;
                    message = 'Porta deve estar entre 1024 e 65535';
                }
                break;
                
            case 'domain':
                if (value && !value.match(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/)) {
                    isValid = false;
                    message = 'Formato de domínio inválido';
                }
                break;
        }
        
        // Aplicar feedback visual
        if (isValid) {
            field.style.borderColor = '#27ae60'; // Verde
        } else {
            field.style.borderColor = '#e74c3c'; // Vermelho
            if (message) showToast(message, 'warning');
        }
        
        // Resetar cor após alguns segundos
        setTimeout(() => {
            field.style.borderColor = '';
        }, 3000);
    }
    
    /**
     * Avança para o próximo passo do wizard
     */
    nextStep() {
        console.log(`Tentando avançar do passo ${this.currentStep}`);
        
        // Coletar dados do passo atual
        this.collectCurrentStepData();
        
        // Validar apenas se estamos nos passos críticos (1 e 2)
        if (this.currentStep <= 2) {
            const errors = validateForm(this.config);
            if (errors.length > 0) {
                console.log('Erros de validação encontrados:', errors);
                showToast(errors[0], 'error');
                return; // Para a execução se há erros
            }
        }
        
        // Avançar se possível
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.showStep(this.currentStep);
            this.updateProgress();
            
            // Se chegou no último passo, gerar preview
            if (this.currentStep === this.totalSteps) {
                this.generateReview();
                this.generateDockerCommandsPreview();
            }
        } else {
            // Último passo: gerar arquivos
            this.generateFiles();
        }
        
        console.log(`Agora no passo ${this.currentStep}`);
    }
    
    /**
     * Volta para o passo anterior
     */
    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
            this.updateProgress();
            console.log(`Voltou para o passo ${this.currentStep}`);
        }
    }
    
    /**
     * Coleta todos os dados dos formulários
     */
    collectCurrentStepData() {
        console.log('Coletando dados do formulário...');
        
        // === FUNÇÕES AUXILIARES ===
        const getValue = (id) => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };
        
        const getChecked = (id) => {
            const el = document.getElementById(id);
            return el ? el.checked : false;
        };
        
        const getNumber = (id) => {
            const value = getValue(id);
            return value ? parseInt(value, 10) : 0;
        };
        
        // === COLETAR TODAS AS CONFIGURAÇÕES ===
        Object.assign(this.config, {
            // Passo 1: Configurações básicas
            projectName: getValue('projectName'),
            odooVersion: getValue('odooVersion'),
            httpPort: getNumber('httpPort'),
            chatPort: getNumber('chatPort'), 
            domain: getValue('domain'),
            
            // Passo 2: Banco de dados
            dbName: getValue('dbName'),
            dbUser: getValue('dbUser'),
            dbPassword: getValue('dbPassword'),
            adminPassword: getValue('adminPassword'),
            enablePostgresPort: getChecked('enablePostgresPort'),
            
            // Passo 3: Performance
            workers: getNumber('workers'),
            cronThreads: getNumber('cronThreads'),
            memoryLimit: getNumber('memoryLimit'),
            logLevel: getValue('logLevel'),
            enableRedis: getChecked('enableRedis'),
            enableNginx: getChecked('enableNginx')
        });
        
        console.log('Dados coletados:', this.config);
    }
    
    /**
     * Mostra um passo específico e oculta os outros
     * @param {number} step - Número do passo a ser mostrado
     */
    showStep(step) {
        // Esconder todos os passos
        document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
        
        // Mostrar o passo atual
        const currentStepEl = document.getElementById('step' + step);
        if (currentStepEl) {
            currentStepEl.classList.add('active');
        } else {
            console.error(`Passo ${step} não encontrado`);
        }
        
        // Atualizar indicador do passo atual
        const currentStepSpan = document.getElementById('currentStep');
        if (currentStepSpan) currentStepSpan.textContent = step;
        
        // === CONTROLAR BOTÕES DE NAVEGAÇÃO ===
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        // Botão anterior: visível apenas se não for o primeiro passo
        if (prevBtn) prevBtn.style.display = step > 1 ? 'inline-flex' : 'none';
        
        // Botão próximo: mudar texto no último passo
        if (nextBtn) {
            nextBtn.textContent = step === this.totalSteps ? '🚀 Gerar Configurações' : 'Próximo ➡️';
        }
    }
    
    /**
     * Atualiza a barra de progresso visual
     */
    updateProgress() {
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            // Calcular porcentagem: 25%, 50%, 75%, 100%
            const progress = (this.currentStep / this.totalSteps) * 100;
            progressBar.style.width = progress + '%';
            
            console.log(`Progresso atualizado: ${progress}%`);
        }
    }
	
	/**
	 * Gera conteúdo README para pastas vazias explicando seu propósito
	 * @param {string} folderPath - Caminho da pasta
	 * @returns {string} Conteúdo do README
	 */
	generateFolderReadme(folderPath) {
		const readmeContent = {
			'logs/': `# Pasta de Logs

	Esta pasta armazenará os logs do Odoo automaticamente.

	## Arquivos que aparecerão aqui:
	- \`odoo.log\` - Log principal do Odoo
	- Logs rotacionados automaticamente

	## Monitoramento:
	\`\`\`bash
	# Ver logs em tempo real
	docker-compose logs -f odoo

	# Ver logs específicos
	tail -f logs/odoo.log
	\`\`\``,

			'addons/': `# Pasta de Addons Customizados

	Coloque seus módulos personalizados do Odoo nesta pasta.

	## Estrutura recomendada:
	\`\`\`
	addons/
	├── meu_modulo/
	│   ├── __manifest__.py
	│   ├── models/
	│   ├── views/
	│   └── data/
	└── outro_modulo/
	\`\`\`

	## Instalação de addons:
	1. Coloque o módulo nesta pasta
	2. Reinicie o Odoo: \`docker-compose restart odoo\`
	3. Atualize a lista de apps no Odoo
	4. Instale o módulo pela interface`,

			'nginx/ssl/': `# Certificados SSL

	Coloque seus certificados SSL nesta pasta para HTTPS.

	## Arquivos necessários:
	- \`your-domain.crt\` - Certificado SSL
	- \`your-domain.key\` - Chave privada

	## Configuração:
	1. Obtenha certificados (Let's Encrypt recomendado)
	2. Coloque os arquivos nesta pasta
	3. Descomente as seções HTTPS no nginx.conf
	4. Reinicie o Nginx: \`docker-compose restart nginx\``
		};
		
		return readmeContent[folderPath] || `# ${folderPath}

	Esta pasta é parte da estrutura do projeto Odoo.`;
	}
    
    /**
     * Gera o resumo da configuração para revisão
     */
    generateReview() {
        const reviewContent = document.getElementById('reviewContent');
        if (!reviewContent) return;
        
        console.log('Gerando resumo da configuração...');
        
        // Template do resumo com as configurações principais
        reviewContent.innerHTML = `
            <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
                <h3>📋 Resumo da Configuração</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
                    <div>
                        <strong>Projeto:</strong> ${this.config.projectName}<br>
                        <strong>Versão Odoo:</strong> ${this.config.odooVersion}<br>
                        <strong>Porta HTTP:</strong> ${this.config.httpPort}<br>
                        <strong>Porta Chat:</strong> ${this.config.chatPort}<br>
                        <strong>Domínio:</strong> ${this.config.domain || 'Localhost (desenvolvimento)'}
                    </div>
                    <div>
                        <strong>Workers:</strong> ${this.config.workers === 0 ? '0 (Desenvolvimento)' : this.config.workers + ' workers'}<br>
                        <strong>Memória:</strong> ${this.config.memoryLimit} GB<br>
                        <strong>Log Level:</strong> ${this.config.logLevel}<br>
                        <strong>Redis:</strong> ${this.config.enableRedis ? '✅ Habilitado' : '❌ Desabilitado'}<br>
                        <strong>Nginx:</strong> ${this.config.enableNginx ? '✅ Habilitado' : '❌ Desabilitado'}
                    </div>
                </div>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
                    <strong>Banco de Dados:</strong> ${this.config.dbName} (usuário: ${this.config.dbUser})<br>
                    <strong>Porta PostgreSQL:</strong> ${this.config.enablePostgresPort ? '✅ Exposta (5432)' : '🔒 Interna apenas'}<br>
                    <strong>Senhas:</strong> Geradas automaticamente (24 caracteres seguros)
                </div>
            </div>
        `;
    }
    
    /**
     * Gera preview dos comandos Docker que o usuário precisará executar
     */
    generateDockerCommandsPreview() {
        const commandsContainer = document.getElementById('dockerCommands');
        if (!commandsContainer) return;
        
        console.log('Gerando preview dos comandos Docker...');
        
        // Comandos customizados baseados na configuração
        const projectDir = this.config.projectName;
        const accessUrl = `http://${this.config.domain || 'localhost'}:${this.config.httpPort}`;
        
        commandsContainer.innerHTML = `
            <h3 style="color: #4a90e2; margin-bottom: 15px;">🐳 Comandos Docker para Executar</h3>
            <div style="font-family: monospace; font-size: 0.9rem;">
                <div style="margin-bottom: 10px;"># 1. Navegar para o diretório do projeto</div>
                <div style="color: #90cdf4; margin-bottom: 15px;">cd ${projectDir}</div>
                
                <div style="margin-bottom: 10px;"># 2. Dar permissão ao script (Linux/Mac)</div>
                <div style="color: #90cdf4; margin-bottom: 15px;">chmod +x setup.sh && ./setup.sh</div>
                
                <div style="margin-bottom: 10px;"># 3. OU iniciar manualmente</div>
                <div style="color: #90cdf4; margin-bottom: 15px;">docker-compose up -d</div>
                
                <div style="margin-bottom: 10px;"># 4. Verificar status dos containers</div>
                <div style="color: #90cdf4; margin-bottom: 15px;">docker-compose ps</div>
                
                <div style="margin-bottom: 10px;"># 5. Acessar o Odoo</div>
                <div style="color: #90cdf4; margin-bottom: 15px;"># URL: ${accessUrl}</div>
                
                <div style="margin-bottom: 10px;"># 6. Ver logs (se necessário)</div>
                <div style="color: #90cdf4; margin-bottom: 15px;">docker-compose logs -f odoo</div>
                
                <div style="margin-bottom: 10px;"># 7. Parar os containers</div>
                <div style="color: #90cdf4;">docker-compose down</div>
            </div>
        `;
    }
    
    /**
     * Gera todos os arquivos de configuração
     */
    generateFiles() {
        console.log('Gerando arquivos de configuração...');
        
        // === MAPA DE ARQUIVOS A SEREM GERADOS ===
        const files = new Map([
            ['docker-compose.yml', generateDockerCompose(this.config)],
            ['.env', generateEnvFile(this.config)],
            ['config/odoo.conf', generateOdooConf(this.config)],
            ['setup.sh', generateSetupScript(this.config)],
            ['.gitignore', generateGitignore()]
        ]);
        
        // Adicionar nginx.conf se habilitado
        if (this.config.enableNginx) {
            files.set('nginx/nginx.conf', generateNginxConf(this.config));
        }
        
        // Exibir arquivos na interface
        this.displayFiles(files);
        
        // Preparar dados para download ZIP
        this.prepareZipData(files);
        
        showToast('Configurações geradas com sucesso!', 'success');
        console.log('Arquivos gerados:', Array.from(files.keys()));
    }
    
    /**
     * Exibe os arquivos gerados na interface
     * @param {Map} files - Mapa de arquivos (nome => conteúdo)
     */
    displayFiles(files) {
        const container = document.getElementById('outputContainer');
        if (!container) return;
        
        let html = '';
        
        // Gerar HTML para cada arquivo
        files.forEach((content, filename) => {
            const escapedContent = this.escapeHtml(content);
            const escapedForJs = content.replace(/`/g, '\\`').replace(/\$/g, '\\$');
            
            html += `
                <div class="file-output">
                    <div class="file-header">📄 ${filename}</div>
                    <pre style="white-space: pre-wrap; margin: 0; max-height: 400px; overflow-y: auto;">${escapedContent}</pre>
                    <button class="copy-btn" onclick="wizard.copyFile('${filename}', \`${escapedForJs}\`)">
                        📋 Copiar ${filename}
                    </button>
                </div>
            `;
        });
        
        container.innerHTML = html;
        container.style.display = 'block';
        
        console.log('Arquivos exibidos na interface');
    }
    
    /**
     * Prepara dados para download como ZIP com estrutura de pastas organizada
     * @param {Map} files - Mapa de arquivos
     */
   prepareZipData(files) {
	// Criar estrutura hierárquica CONDICIONALMENTE
    this.zipStructure = {
        root: [
            'docker-compose.yml',
            '.env', 
            '.gitignore',
            'setup.sh'
        ],
        folders: {
            'config/': ['odoo.conf'],
            'logs/': [], // Sempre necessária (Docker criará logs)
            'addons/': [], // Sempre necessária (usuário adicionará módulos)
            // Nginx APENAS se habilitado
            ...(this.config.enableNginx ? {
                'nginx/': ['nginx.conf'],
                'nginx/ssl/': []
            } : {})
        }
    };
    
    // Armazenar arquivos para uso no download
    this.generatedFiles = files;
    
    // Habilitar botão de download
    const downloadBtn = document.getElementById('downloadZipBtn');
    if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.style.opacity = '1';
    }
    
    console.log('Estrutura ZIP preparada:', this.zipStructure);
}
    
    /**
     * Copia conteúdo de um arquivo para área de transferência
     * @param {string} filename - Nome do arquivo
     * @param {string} content - Conteúdo do arquivo
     */
    async copyFile(filename, content) {
        const success = await copyToClipboard(content);
        const message = success ? 
            `📋 ${filename} copiado para área de transferência!` : 
            `❌ Erro ao copiar ${filename}. Tente copiar manualmente.`;
        const type = success ? 'success' : 'error';
        
        showToast(message, type);
        console.log(`Tentativa de cópia do arquivo ${filename}:`, success ? 'sucesso' : 'falha');
    }
    
    /**
     * Faz download de todos os arquivos como ZIP com estrutura organizada
     */
    async downloadAsZip() {
		if (!this.generatedFiles) {
			showToast('❌ Nenhum arquivo foi gerado ainda!', 'error');
			return;
		}
		
		try {
			console.log('Iniciando criação do arquivo ZIP...');
			
			// Carregar JSZip dinamicamente
			const JSZip = window.JSZip || await this.loadJSZip();
			const zip = new JSZip();
			
			// Criar pasta raiz do projeto
			const projectFolder = zip.folder(this.config.projectName);
			
			// === ADICIONAR ARQUIVOS NA RAIZ ===
			this.zipStructure.root.forEach(filename => {
				if (this.generatedFiles.has(filename)) {
					projectFolder.file(filename, this.generatedFiles.get(filename));
					console.log(`Adicionado na raiz: ${filename}`);
				}
			});
			
			// === CRIAR ESTRUTURA DE PASTAS ===
			Object.entries(this.zipStructure.folders).forEach(([folderPath, files]) => {
				// Criar pasta (mesmo que vazia)
				const folder = projectFolder.folder(folderPath);
				
				// Adicionar arquivos na pasta
				files.forEach(filename => {
					const fullPath = folderPath + filename;
					if (this.generatedFiles.has(fullPath)) {
						folder.file(filename, this.generatedFiles.get(fullPath));
						console.log(`Adicionado em ${folderPath}: ${filename}`);
					}
				});
				
				// Para pastas vazias, adicionar arquivo README explicativo
				if (files.length === 0) {
					const readmeContent = this.generateFolderReadme(folderPath);
					folder.file('README.md', readmeContent);
					console.log(`README criado para pasta vazia: ${folderPath}`);
				}
			});
			
			// === GERAR E BAIXAR ZIP ===
			const zipBlob = await zip.generateAsync({type: 'blob'});
			
			// Criar link de download
			const url = URL.createObjectURL(zipBlob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${this.config.projectName}-odoo-config.zip`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			
			showToast('📦 Download do ZIP iniciado!', 'success');
			console.log('ZIP gerado com estrutura organizada');
			
		} catch (error) {
			console.error('Erro ao gerar ZIP:', error);
			showToast('❌ Erro ao gerar ZIP. Use os botões individuais.', 'error');
		}
	}
    
    /**
     * Carrega biblioteca JSZip dinamicamente
     */
    async loadJSZip() {
        return new Promise((resolve, reject) => {
            if (window.JSZip) {
                resolve(window.JSZip);
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => resolve(window.JSZip);
            script.onerror = () => reject(new Error('Falha ao carregar JSZip'));
            document.head.appendChild(script);
        });
    }
    
    /**
     * Escapa HTML para exibição segura
     * @param {string} unsafe - String não segura
     * @returns {string} String com HTML escapado
     */
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// ====================================================================
// INICIALIZAÇÃO GLOBAL
// ====================================================================

// Variável global para acesso pelos event handlers inline no HTML
let wizard;

// Inicializar quando DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, inicializando wizard...');
    wizard = new OdooConfigurationWizard();
    console.log('Gerador de Configuração Odoo pronto para uso!');
});