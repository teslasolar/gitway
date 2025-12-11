/**
 * Authentication Handler for Ignition Gateway
 * Supports multiple authentication methods
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class AuthenticationHandler {
    constructor(config = {}) {
        this.config = config;
        this.tokens = new Map();
        this.sessionStore = new Map();
        this.refreshTokens = new Map();
    }

    /**
     * Initialize authentication based on configuration
     */
    async initialize(api) {
        this.api = api;
        const authType = this.config.authentication?.type || 'basic';

        switch (authType) {
            case 'basic':
                return this.setupBasicAuth();
            case 'bearer':
                return this.setupBearerAuth();
            case 'oauth2':
                return this.setupOAuth2();
            case 'certificate':
                return this.setupCertificateAuth();
            case 'api-key':
                return this.setupApiKeyAuth();
            default:
                throw new Error(`Unsupported authentication type: ${authType}`);
        }
    }

    /**
     * Setup Basic Authentication
     */
    setupBasicAuth() {
        const { username, password } = this.config.authentication;

        if (!username || !password) {
            throw new Error('Username and password required for basic authentication');
        }

        this.authHeaders = {
            'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
        };

        return this.authHeaders;
    }

    /**
     * Setup Bearer Token Authentication
     */
    async setupBearerAuth() {
        const { tokenEndpoint, clientId, clientSecret, scope } = this.config.authentication;

        // Get initial token
        const token = await this.requestToken(tokenEndpoint, {
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            scope: scope || 'api'
        });

        this.currentToken = token;
        this.setupTokenRefresh(token);

        this.authHeaders = {
            'Authorization': `Bearer ${token.access_token}`
        };

        return this.authHeaders;
    }

    /**
     * Setup OAuth2 Authentication
     */
    async setupOAuth2() {
        const {
            authorizationUrl,
            tokenUrl,
            clientId,
            clientSecret,
            redirectUri,
            scope
        } = this.config.authentication.oauth2 || {};

        // Generate state for CSRF protection
        const state = this.generateState();

        // Build authorization URL
        const authUrl = new URL(authorizationUrl);
        authUrl.searchParams.append('client_id', clientId);
        authUrl.searchParams.append('redirect_uri', redirectUri);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('scope', scope || 'api');
        authUrl.searchParams.append('state', state);

        console.log('Please authorize the application by visiting:', authUrl.toString());

        // In a real implementation, you would handle the OAuth callback
        // For now, we'll use a placeholder
        return {
            authorizationUrl: authUrl.toString(),
            state,
            pending: true
        };
    }

    /**
     * Handle OAuth2 callback
     */
    async handleOAuth2Callback(code, state) {
        const { tokenUrl, clientId, clientSecret, redirectUri } = this.config.authentication.oauth2;

        // Verify state
        if (!this.verifyState(state)) {
            throw new Error('Invalid state parameter');
        }

        // Exchange code for token
        const token = await this.requestToken(tokenUrl, {
            grant_type: 'authorization_code',
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri
        });

        this.currentToken = token;
        this.setupTokenRefresh(token);

        this.authHeaders = {
            'Authorization': `Bearer ${token.access_token}`
        };

        return token;
    }

    /**
     * Setup Certificate Authentication
     */
    setupCertificateAuth() {
        const { certPath, keyPath, caPath } = this.config.authentication.certificate || {};

        if (!certPath || !keyPath) {
            throw new Error('Certificate and key paths required for certificate authentication');
        }

        const options = {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath)
        };

        if (caPath) {
            options.ca = fs.readFileSync(caPath);
        }

        return options;
    }

    /**
     * Setup API Key Authentication
     */
    setupApiKeyAuth() {
        const { apiKey, headerName = 'X-API-Key' } = this.config.authentication;

        if (!apiKey) {
            throw new Error('API key required for API key authentication');
        }

        this.authHeaders = {
            [headerName]: apiKey
        };

        return this.authHeaders;
    }

    /**
     * Request token from endpoint
     */
    async requestToken(endpoint, params) {
        const https = require('https');

        return new Promise((resolve, reject) => {
            const data = new URLSearchParams(params).toString();
            const url = new URL(endpoint);

            const options = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': data.length
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const token = JSON.parse(responseData);
                        resolve(token);
                    } catch (error) {
                        reject(new Error(`Failed to parse token response: ${responseData}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    /**
     * Setup automatic token refresh
     */
    setupTokenRefresh(token) {
        if (!token.expires_in) return;

        // Refresh token 5 minutes before expiry
        const refreshTime = (token.expires_in - 300) * 1000;

        setTimeout(async () => {
            try {
                await this.refreshToken();
            } catch (error) {
                console.error('Failed to refresh token:', error);
            }
        }, refreshTime);
    }

    /**
     * Refresh access token
     */
    async refreshToken() {
        const { tokenEndpoint, clientId, clientSecret } = this.config.authentication;

        if (!this.currentToken?.refresh_token) {
            // Use client credentials flow if no refresh token
            const token = await this.requestToken(tokenEndpoint, {
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret
            });

            this.currentToken = token;
            this.authHeaders['Authorization'] = `Bearer ${token.access_token}`;
            this.setupTokenRefresh(token);

            return token;
        }

        // Use refresh token
        const token = await this.requestToken(tokenEndpoint, {
            grant_type: 'refresh_token',
            refresh_token: this.currentToken.refresh_token,
            client_id: clientId,
            client_secret: clientSecret
        });

        this.currentToken = token;
        this.authHeaders['Authorization'] = `Bearer ${token.access_token}`;
        this.setupTokenRefresh(token);

        return token;
    }

    /**
     * Generate state for CSRF protection
     */
    generateState() {
        const state = crypto.randomBytes(32).toString('hex');
        this.sessionStore.set(state, {
            timestamp: Date.now(),
            used: false
        });
        return state;
    }

    /**
     * Verify state parameter
     */
    verifyState(state) {
        const session = this.sessionStore.get(state);
        if (!session || session.used) {
            return false;
        }

        // State expires after 10 minutes
        if (Date.now() - session.timestamp > 600000) {
            this.sessionStore.delete(state);
            return false;
        }

        session.used = true;
        return true;
    }

    /**
     * Get current authentication headers
     */
    getHeaders() {
        return this.authHeaders || {};
    }

    /**
     * Create session for user
     */
    createSession(userId, metadata = {}) {
        const sessionId = crypto.randomBytes(32).toString('hex');
        const session = {
            id: sessionId,
            userId,
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            metadata
        };

        this.sessionStore.set(sessionId, session);
        return sessionId;
    }

    /**
     * Validate session
     */
    validateSession(sessionId) {
        const session = this.sessionStore.get(sessionId);
        if (!session) {
            return null;
        }

        // Check session expiry (24 hours)
        if (Date.now() - session.createdAt > 86400000) {
            this.sessionStore.delete(sessionId);
            return null;
        }

        // Update last accessed time
        session.lastAccessed = Date.now();
        return session;
    }

    /**
     * Destroy session
     */
    destroySession(sessionId) {
        return this.sessionStore.delete(sessionId);
    }

    /**
     * Add custom authentication method
     */
    addCustomAuth(name, handler) {
        this.customAuthHandlers = this.customAuthHandlers || {};
        this.customAuthHandlers[name] = handler;
    }

    /**
     * Execute custom authentication
     */
    async executeCustomAuth(name, params) {
        if (!this.customAuthHandlers?.[name]) {
            throw new Error(`Custom auth handler not found: ${name}`);
        }

        return this.customAuthHandlers[name](params);
    }

    /**
     * Store credentials securely
     */
    storeCredentials(credentials) {
        const encrypted = this.encrypt(JSON.stringify(credentials));
        const credPath = path.join(process.cwd(), '.credentials');
        fs.writeFileSync(credPath, encrypted, 'utf8');
    }

    /**
     * Load stored credentials
     */
    loadCredentials() {
        const credPath = path.join(process.cwd(), '.credentials');
        if (!fs.existsSync(credPath)) {
            return null;
        }

        const encrypted = fs.readFileSync(credPath, 'utf8');
        return JSON.parse(this.decrypt(encrypted));
    }

    /**
     * Simple encryption for stored credentials
     */
    encrypt(text) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(
            process.env.ENCRYPTION_KEY || 'default-key',
            'salt',
            32
        );
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return iv.toString('hex') + ':' + encrypted;
    }

    /**
     * Decrypt stored credentials
     */
    decrypt(text) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(
            process.env.ENCRYPTION_KEY || 'default-key',
            'salt',
            32
        );

        const parts = text.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];

        const decipher = crypto.createDecipheriv(algorithm, key, iv);

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}

module.exports = AuthenticationHandler;