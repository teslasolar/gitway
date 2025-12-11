/**
 * API Endpoint Templates for Ignition Gateway
 * Flexible, reusable templates for common operations
 */

const apiTemplates = {
    // ============= Tag Templates =============
    tags: {
        read: {
            single: {
                endpoint: '/system/webdev/tags/read',
                method: 'POST',
                body: (tagPath, provider = 'default') => ({
                    tagPaths: [tagPath],
                    provider
                })
            },
            multiple: {
                endpoint: '/system/webdev/tags/read',
                method: 'POST',
                body: (tagPaths, provider = 'default') => ({
                    tagPaths,
                    provider
                })
            },
            folder: {
                endpoint: '/system/webdev/tags/browse',
                method: 'POST',
                body: (folderPath, recursive = false, provider = 'default') => ({
                    path: folderPath,
                    recursive,
                    provider
                })
            }
        },
        write: {
            single: {
                endpoint: '/system/webdev/tags/write',
                method: 'POST',
                body: (tagPath, value, quality = 'Good', provider = 'default') => ({
                    tagWrites: [{
                        tagPath,
                        value,
                        quality
                    }],
                    provider
                })
            },
            multiple: {
                endpoint: '/system/webdev/tags/write',
                method: 'POST',
                body: (tagWrites, provider = 'default') => ({
                    tagWrites,
                    provider
                })
            },
            atomic: {
                endpoint: '/system/webdev/tags/atomic-write',
                method: 'POST',
                body: (tagWrites, provider = 'default') => ({
                    tagWrites,
                    provider,
                    atomic: true
                })
            }
        },
        config: {
            read: {
                endpoint: '/system/webdev/tags/config/read',
                method: 'POST',
                body: (tagPath, provider = 'default') => ({
                    tagPath,
                    provider
                })
            },
            write: {
                endpoint: '/system/webdev/tags/config/write',
                method: 'POST',
                body: (tagPath, config, provider = 'default') => ({
                    tagPath,
                    config,
                    provider
                })
            }
        }
    },

    // ============= History Templates =============
    history: {
        query: {
            raw: {
                endpoint: '/system/webdev/history/query',
                method: 'POST',
                body: (tagPaths, startDate, endDate, options = {}) => ({
                    tagPaths: Array.isArray(tagPaths) ? tagPaths : [tagPaths],
                    startDate,
                    endDate,
                    returnSize: options.returnSize || 10000,
                    returnFormat: options.returnFormat || 'Wide',
                    columnNames: options.columnNames || 'TagPath'
                })
            },
            aggregated: {
                endpoint: '/system/webdev/history/query',
                method: 'POST',
                body: (tagPaths, startDate, endDate, interval, aggregation = 'Average') => ({
                    tagPaths: Array.isArray(tagPaths) ? tagPaths : [tagPaths],
                    startDate,
                    endDate,
                    aggregationMode: aggregation,
                    returnSize: 0,
                    intervalMinutes: interval
                })
            },
            realtime: {
                endpoint: '/system/webdev/history/realtime',
                method: 'POST',
                body: (tagPaths, pollRate = 1000) => ({
                    tagPaths: Array.isArray(tagPaths) ? tagPaths : [tagPaths],
                    pollRate,
                    maxValues: 100
                })
            }
        },
        insert: {
            endpoint: '/system/webdev/history/insert',
            method: 'POST',
            body: (tagPath, values, timestamps, qualities = null) => ({
                tagPath,
                values,
                timestamps,
                qualities: qualities || new Array(values.length).fill(192)
            })
        }
    },

    // ============= Alarm Templates =============
    alarms: {
        query: {
            active: {
                endpoint: '/system/webdev/alarms/query',
                method: 'POST',
                body: (filters = {}) => ({
                    state: ['ActiveUnacked', 'ActiveAcked'],
                    priority: filters.priority || [1, 2, 3, 4, 5],
                    displayPath: filters.displayPath || '*',
                    source: filters.source || '*',
                    includeData: true
                })
            },
            historical: {
                endpoint: '/system/webdev/alarms/history',
                method: 'POST',
                body: (startDate, endDate, filters = {}) => ({
                    startDate,
                    endDate,
                    state: filters.state || ['ClearAcked', 'ClearUnacked', 'ActiveAcked', 'ActiveUnacked'],
                    priority: filters.priority || [1, 2, 3, 4, 5],
                    displayPath: filters.displayPath || '*',
                    includeData: true
                })
            },
            journal: {
                endpoint: '/system/webdev/alarms/journal',
                method: 'POST',
                body: (startDate, endDate, journalName = 'default') => ({
                    startDate,
                    endDate,
                    journalName
                })
            }
        },
        acknowledge: {
            single: {
                endpoint: '/system/webdev/alarms/ack',
                method: 'POST',
                body: (alarmId, notes = '') => ({
                    alarmIds: [alarmId],
                    notes
                })
            },
            multiple: {
                endpoint: '/system/webdev/alarms/ack',
                method: 'POST',
                body: (alarmIds, notes = '') => ({
                    alarmIds,
                    notes
                })
            }
        },
        shelve: {
            endpoint: '/system/webdev/alarms/shelve',
            method: 'POST',
            body: (alarmIds, duration = 3600) => ({
                alarmIds: Array.isArray(alarmIds) ? alarmIds : [alarmIds],
                duration
            })
        }
    },

    // ============= Database Templates =============
    database: {
        query: {
            select: {
                endpoint: '/system/webdev/database/query',
                method: 'POST',
                body: (query, database = 'default', params = []) => ({
                    query,
                    database,
                    params,
                    tx: null
                })
            },
            update: {
                endpoint: '/system/webdev/database/update',
                method: 'POST',
                body: (query, database = 'default', params = [], tx = null) => ({
                    query,
                    database,
                    params,
                    tx
                })
            },
            stored_procedure: {
                endpoint: '/system/webdev/database/call',
                method: 'POST',
                body: (procedure, database = 'default', params = {}) => ({
                    procedure,
                    database,
                    params
                })
            }
        },
        named_query: {
            execute: {
                endpoint: '/system/webdev/named-query/execute',
                method: 'POST',
                body: (path, parameters = {}, project = null) => ({
                    path,
                    parameters,
                    project
                })
            },
            list: {
                endpoint: '/system/webdev/named-query/list',
                method: 'GET'
            }
        },
        transaction: {
            begin: {
                endpoint: '/system/webdev/database/transaction/begin',
                method: 'POST',
                body: (database = 'default', isolationLevel = 'READ_COMMITTED') => ({
                    database,
                    isolationLevel
                })
            },
            commit: {
                endpoint: '/system/webdev/database/transaction/commit',
                method: 'POST',
                body: (txId) => ({ txId })
            },
            rollback: {
                endpoint: '/system/webdev/database/transaction/rollback',
                method: 'POST',
                body: (txId) => ({ txId })
            }
        }
    },

    // ============= Perspective Templates =============
    perspective: {
        session: {
            list: {
                endpoint: '/system/perspective/sessions',
                method: 'GET'
            },
            info: {
                endpoint: '/system/perspective/session/{sessionId}',
                method: 'GET'
            },
            close: {
                endpoint: '/system/perspective/session/{sessionId}/close',
                method: 'POST'
            }
        },
        message: {
            send: {
                endpoint: '/system/perspective/message',
                method: 'POST',
                body: (sessionId, messageType, payload = {}, scope = 'session') => ({
                    sessionId,
                    messageType,
                    payload,
                    scope
                })
            },
            broadcast: {
                endpoint: '/system/perspective/broadcast',
                method: 'POST',
                body: (messageType, payload = {}, project = null) => ({
                    messageType,
                    payload,
                    project
                })
            }
        },
        dock: {
            open: {
                endpoint: '/system/perspective/dock/open',
                method: 'POST',
                body: (sessionId, dockId, params = {}) => ({
                    sessionId,
                    dockId,
                    params
                })
            },
            close: {
                endpoint: '/system/perspective/dock/close',
                method: 'POST',
                body: (sessionId, dockId) => ({
                    sessionId,
                    dockId
                })
            }
        }
    },

    // ============= Reports Templates =============
    reports: {
        execute: {
            endpoint: '/system/report/execute',
            method: 'POST',
            body: (reportPath, parameters = {}, fileType = 'pdf') => ({
                path: reportPath,
                parameters,
                fileType,
                action: 'download'
            })
        },
        schedule: {
            endpoint: '/system/report/schedule',
            method: 'POST',
            body: (reportPath, schedule, parameters = {}, destinations = []) => ({
                path: reportPath,
                schedule,
                parameters,
                destinations
            })
        },
        list: {
            endpoint: '/system/report/list',
            method: 'GET'
        }
    },

    // ============= System Templates =============
    system: {
        status: {
            gateway: {
                endpoint: '/system/status',
                method: 'GET'
            },
            performance: {
                endpoint: '/system/performance',
                method: 'GET'
            },
            modules: {
                endpoint: '/system/modules',
                method: 'GET'
            },
            licenses: {
                endpoint: '/system/licenses',
                method: 'GET'
            }
        },
        projects: {
            list: {
                endpoint: '/system/projects',
                method: 'GET'
            },
            info: {
                endpoint: '/system/project/{projectName}/info',
                method: 'GET'
            },
            resources: {
                endpoint: '/system/project/{projectName}/resources',
                method: 'GET'
            }
        },
        scripts: {
            execute: {
                endpoint: '/system/script/execute',
                method: 'POST',
                body: (code, scope = 'gateway') => ({
                    code,
                    scope
                })
            },
            library: {
                endpoint: '/system/script/library/{path}',
                method: 'GET'
            }
        },
        audit: {
            query: {
                endpoint: '/system/audit/query',
                method: 'POST',
                body: (startDate, endDate, filters = {}) => ({
                    startDate,
                    endDate,
                    actor: filters.actor || '*',
                    action: filters.action || '*',
                    target: filters.target || '*'
                })
            }
        }
    },

    // ============= OPC UA Templates =============
    opcua: {
        browse: {
            endpoint: '/system/opcua/browse',
            method: 'POST',
            body: (serverName, nodeId = null) => ({
                serverName,
                nodeId: nodeId || 'ns=0;i=84' // Root folder
            })
        },
        read: {
            endpoint: '/system/opcua/read',
            method: 'POST',
            body: (serverName, nodeIds) => ({
                serverName,
                nodeIds: Array.isArray(nodeIds) ? nodeIds : [nodeIds]
            })
        },
        write: {
            endpoint: '/system/opcua/write',
            method: 'POST',
            body: (serverName, writes) => ({
                serverName,
                writes: Array.isArray(writes) ? writes : [writes]
            })
        },
        subscribe: {
            endpoint: '/system/opcua/subscribe',
            method: 'POST',
            body: (serverName, nodeIds, publishingInterval = 1000) => ({
                serverName,
                nodeIds: Array.isArray(nodeIds) ? nodeIds : [nodeIds],
                publishingInterval
            })
        }
    }
};

/**
 * Template execution helper
 */
class TemplateExecutor {
    constructor(apiClient) {
        this.api = apiClient;
    }

    /**
     * Execute a template with parameters
     */
    async execute(templatePath, ...params) {
        const template = this.getTemplate(templatePath);
        if (!template) {
            throw new Error(`Template not found: ${templatePath}`);
        }

        const { endpoint, method, body } = template;
        const requestBody = typeof body === 'function' ? body(...params) : body;

        return this.api.request(method, endpoint, {
            body: requestBody
        });
    }

    /**
     * Get template by path (e.g., 'tags.read.single')
     */
    getTemplate(path) {
        const parts = path.split('.');
        let current = apiTemplates;

        for (const part of parts) {
            if (!current[part]) {
                return null;
            }
            current = current[part];
        }

        return current;
    }

    /**
     * Create custom template
     */
    createTemplate(name, template) {
        const parts = name.split('.');
        let current = apiTemplates;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        current[parts[parts.length - 1]] = template;
    }
}

module.exports = { apiTemplates, TemplateExecutor };