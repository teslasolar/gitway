/**
 * Data Transformation Utilities for Ignition Gateway Data
 * Handles conversion between Ignition formats and standard formats
 */

class DataTransformer {
    constructor(config = {}) {
        this.config = config;
        this.customTransformers = new Map();
    }

    // ============= Tag Data Transformations =============

    /**
     * Transform tag read results to simplified format
     */
    transformTagReadResults(results) {
        if (!results || !results.results) {
            return [];
        }

        return results.results.map(tag => ({
            path: tag.tagPath,
            value: tag.value,
            quality: this.translateQuality(tag.quality),
            timestamp: new Date(tag.timestamp).toISOString(),
            dataType: tag.dataType,
            metadata: {
                quality: tag.quality,
                qualityCode: tag.qualityCode
            }
        }));
    }

    /**
     * Transform tags for writing
     */
    transformTagWriteData(tags) {
        if (!Array.isArray(tags)) {
            tags = [tags];
        }

        return tags.map(tag => {
            if (typeof tag === 'object' && tag.tagPath) {
                return tag; // Already in correct format
            }

            // Handle simplified format
            if (typeof tag === 'object') {
                return {
                    tagPath: tag.path || tag.tag,
                    value: this.convertValue(tag.value, tag.dataType),
                    quality: tag.quality || 'Good'
                };
            }

            throw new Error('Invalid tag write format');
        });
    }

    /**
     * Convert value based on data type
     */
    convertValue(value, dataType) {
        if (value === null || value === undefined) {
            return null;
        }

        switch (dataType) {
            case 'Boolean':
                return Boolean(value);
            case 'Int1':
            case 'Int2':
            case 'Int4':
            case 'Int8':
                return parseInt(value);
            case 'Float4':
            case 'Float8':
                return parseFloat(value);
            case 'String':
                return String(value);
            case 'DateTime':
                return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
            case 'DataSet':
                return this.transformDataSet(value);
            case 'Document':
                return typeof value === 'string' ? JSON.parse(value) : value;
            default:
                return value;
        }
    }

    /**
     * Translate quality codes to readable format
     */
    translateQuality(qualityCode) {
        const qualities = {
            192: 'Good',
            0: 'Bad',
            64: 'Uncertain',
            24: 'Bad_Stale',
            28: 'Bad_NotConnected',
            404: 'Bad_Disabled',
            408: 'Bad_NotFound',
            516: 'Bad_Unauthorized',
            600: 'Bad_TrialExpired'
        };

        return qualities[qualityCode] || `Unknown (${qualityCode})`;
    }

    // ============= History Data Transformations =============

    /**
     * Transform history query results
     */
    transformHistoryResults(results, format = 'timeseries') {
        if (!results) return null;

        switch (format) {
            case 'timeseries':
                return this.toTimeSeries(results);
            case 'table':
                return this.toTable(results);
            case 'csv':
                return this.toCSV(results);
            case 'json':
                return this.toJSON(results);
            default:
                return results;
        }
    }

    /**
     * Convert to time series format
     */
    toTimeSeries(data) {
        const series = {};

        if (data.columnNames && data.data) {
            // Wide format
            const timeIndex = data.columnNames.indexOf('t_stamp');

            data.columnNames.forEach((column, index) => {
                if (column !== 't_stamp') {
                    series[column] = [];
                }
            });

            data.data.forEach(row => {
                const timestamp = row[timeIndex];
                data.columnNames.forEach((column, index) => {
                    if (column !== 't_stamp') {
                        series[column].push({
                            timestamp: new Date(timestamp).toISOString(),
                            value: row[index],
                            quality: row[index + '_quality'] || 'Good'
                        });
                    }
                });
            });
        }

        return series;
    }

    /**
     * Convert to table format
     */
    toTable(data) {
        if (!data.columnNames || !data.data) {
            return { headers: [], rows: [] };
        }

        return {
            headers: data.columnNames,
            rows: data.data.map(row => {
                const obj = {};
                data.columnNames.forEach((col, index) => {
                    obj[col] = row[index];
                });
                return obj;
            })
        };
    }

    /**
     * Convert to CSV format
     */
    toCSV(data) {
        if (!data.columnNames || !data.data) {
            return '';
        }

        const headers = data.columnNames.join(',');
        const rows = data.data.map(row =>
            row.map(value => {
                // Escape values containing commas or quotes
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        );

        return [headers, ...rows].join('\n');
    }

    /**
     * Convert to JSON format
     */
    toJSON(data) {
        const table = this.toTable(data);
        return JSON.stringify(table.rows, null, 2);
    }

    // ============= Alarm Data Transformations =============

    /**
     * Transform alarm data
     */
    transformAlarmData(alarms) {
        if (!alarms || !Array.isArray(alarms.alarms)) {
            return [];
        }

        return alarms.alarms.map(alarm => ({
            id: alarm.id,
            displayPath: alarm.displayPath,
            source: alarm.source,
            priority: this.translatePriority(alarm.priority),
            state: this.translateAlarmState(alarm.state),
            active: alarm.isActive,
            acknowledged: alarm.isAcked,
            shelved: alarm.isShelved,
            timestamp: {
                active: alarm.activeTime ? new Date(alarm.activeTime).toISOString() : null,
                clear: alarm.clearTime ? new Date(alarm.clearTime).toISOString() : null,
                ack: alarm.ackTime ? new Date(alarm.ackTime).toISOString() : null
            },
            notes: alarm.notes,
            label: alarm.label,
            eventData: alarm.eventData
        }));
    }

    /**
     * Translate alarm priority
     */
    translatePriority(priority) {
        const priorities = {
            0: 'Diagnostic',
            1: 'Low',
            2: 'Medium',
            3: 'High',
            4: 'Critical'
        };

        return priorities[priority] || `Priority ${priority}`;
    }

    /**
     * Translate alarm state
     */
    translateAlarmState(state) {
        const states = {
            0: 'ClearUnacked',
            1: 'ClearAcked',
            2: 'ActiveUnacked',
            3: 'ActiveAcked'
        };

        return states[state] || `State ${state}`;
    }

    // ============= DataSet Transformations =============

    /**
     * Transform Ignition DataSet
     */
    transformDataSet(dataset) {
        if (!dataset || !dataset.columns) {
            return null;
        }

        return {
            columns: dataset.columns.map(col => ({
                name: col.name,
                type: col.type
            })),
            rows: dataset.rows || [],
            rowCount: dataset.rowCount || dataset.rows?.length || 0
        };
    }

    /**
     * Create DataSet from array
     */
    createDataSet(data, columns = null) {
        if (!Array.isArray(data) || data.length === 0) {
            return { columns: [], rows: [] };
        }

        // Auto-detect columns if not provided
        if (!columns) {
            columns = Object.keys(data[0]).map(key => ({
                name: key,
                type: this.detectDataType(data[0][key])
            }));
        }

        const rows = data.map(item =>
            columns.map(col => item[col.name])
        );

        return {
            columns,
            rows,
            rowCount: rows.length
        };
    }

    /**
     * Detect data type from value
     */
    detectDataType(value) {
        if (value === null || value === undefined) {
            return 'String';
        }
        if (typeof value === 'boolean') {
            return 'Boolean';
        }
        if (typeof value === 'number') {
            return Number.isInteger(value) ? 'Int4' : 'Float8';
        }
        if (value instanceof Date) {
            return 'DateTime';
        }
        if (typeof value === 'object') {
            return 'Document';
        }
        return 'String';
    }

    // ============= Perspective Data Transformations =============

    /**
     * Transform data for Perspective components
     */
    transformForPerspective(data, componentType) {
        switch (componentType) {
            case 'table':
                return this.toPerspectiveTable(data);
            case 'chart':
                return this.toPerspectiveChart(data);
            case 'dropdown':
                return this.toPerspectiveDropdown(data);
            case 'tree':
                return this.toPerspectiveTree(data);
            default:
                return data;
        }
    }

    /**
     * Transform to Perspective table format
     */
    toPerspectiveTable(data) {
        if (Array.isArray(data)) {
            return {
                data: data,
                columns: Object.keys(data[0] || {}).map(key => ({
                    field: key,
                    header: key.charAt(0).toUpperCase() + key.slice(1),
                    sortable: true,
                    resizable: true
                }))
            };
        }
        return data;
    }

    /**
     * Transform to Perspective chart format
     */
    toPerspectiveChart(data, type = 'timeseries') {
        if (type === 'timeseries') {
            return {
                series: Object.keys(data).map(key => ({
                    name: key,
                    data: data[key]
                }))
            };
        }
        return data;
    }

    /**
     * Transform to Perspective dropdown format
     */
    toPerspectiveDropdown(data) {
        if (Array.isArray(data)) {
            return data.map(item => ({
                value: item.value || item,
                label: item.label || item.toString()
            }));
        }
        return data;
    }

    /**
     * Transform to Perspective tree format
     */
    toPerspectiveTree(data) {
        // Implement tree transformation logic
        return data;
    }

    // ============= Batch Transformations =============

    /**
     * Apply transformations in batch
     */
    batchTransform(data, transformations) {
        let result = data;

        for (const transformation of transformations) {
            const { type, options } = transformation;
            result = this.applyTransformation(result, type, options);
        }

        return result;
    }

    /**
     * Apply single transformation
     */
    applyTransformation(data, type, options = {}) {
        switch (type) {
            case 'filter':
                return this.filterData(data, options);
            case 'aggregate':
                return this.aggregateData(data, options);
            case 'pivot':
                return this.pivotData(data, options);
            case 'sort':
                return this.sortData(data, options);
            case 'custom':
                return this.applyCustomTransformer(data, options);
            default:
                return data;
        }
    }

    /**
     * Filter data based on conditions
     */
    filterData(data, options) {
        const { field, operator, value } = options;

        if (!Array.isArray(data)) {
            return data;
        }

        return data.filter(item => {
            const fieldValue = item[field];

            switch (operator) {
                case 'equals':
                    return fieldValue === value;
                case 'not_equals':
                    return fieldValue !== value;
                case 'greater_than':
                    return fieldValue > value;
                case 'less_than':
                    return fieldValue < value;
                case 'contains':
                    return String(fieldValue).includes(value);
                case 'in':
                    return Array.isArray(value) && value.includes(fieldValue);
                default:
                    return true;
            }
        });
    }

    /**
     * Aggregate data
     */
    aggregateData(data, options) {
        const { groupBy, aggregations } = options;

        if (!Array.isArray(data) || !groupBy) {
            return data;
        }

        const groups = {};

        data.forEach(item => {
            const key = item[groupBy];
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
        });

        return Object.keys(groups).map(key => {
            const group = groups[key];
            const result = { [groupBy]: key };

            aggregations.forEach(agg => {
                const values = group.map(item => item[agg.field]);
                result[agg.name] = this.calculate(values, agg.type);
            });

            return result;
        });
    }

    /**
     * Calculate aggregation
     */
    calculate(values, type) {
        const numbers = values.filter(v => typeof v === 'number');

        switch (type) {
            case 'sum':
                return numbers.reduce((a, b) => a + b, 0);
            case 'avg':
            case 'average':
                return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
            case 'min':
                return Math.min(...numbers);
            case 'max':
                return Math.max(...numbers);
            case 'count':
                return values.length;
            default:
                return null;
        }
    }

    /**
     * Pivot data
     */
    pivotData(data, options) {
        // Implement pivot logic
        return data;
    }

    /**
     * Sort data
     */
    sortData(data, options) {
        const { field, order = 'asc' } = options;

        if (!Array.isArray(data)) {
            return data;
        }

        return data.sort((a, b) => {
            const aVal = a[field];
            const bVal = b[field];

            if (aVal < bVal) return order === 'asc' ? -1 : 1;
            if (aVal > bVal) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    /**
     * Register custom transformer
     */
    registerTransformer(name, transformer) {
        this.customTransformers.set(name, transformer);
    }

    /**
     * Apply custom transformer
     */
    applyCustomTransformer(data, options) {
        const { name, params } = options;
        const transformer = this.customTransformers.get(name);

        if (!transformer) {
            throw new Error(`Custom transformer not found: ${name}`);
        }

        return transformer(data, params);
    }
}

module.exports = DataTransformer;