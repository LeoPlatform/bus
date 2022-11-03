const logger = require('leo-logger')('leo-archive');

const lib = module.exports = {
    parseRegex: regex => {
        if (regex instanceof RegExp) {
            return regex;
        }
        let flags;
        if (regex[0] === "/") {
            const parts = regex.split("/").slice(1);
            flags = parts.pop();
            regex = parts.join("/");
        }
        return new RegExp(regex, flags);
    },
    removePath: (data, path, parentPath = "", returnRemovedData = false) => {
        const removedFields = {};
        const [, wildcardStart, wildcardEnd] = path.split(/^(.*?)\/\*(.*$)/) || [];
        if (wildcardStart != null) {
            const parts = wildcardStart.split("/").slice(1);
            const container = parts.reduce(followPath, data);
            const keys = Object.keys(container);
            if (!wildcardEnd) {
                keys = keys.reverse();
            }

            logger.debug("Wildcard path", wildcardStart, wildcardEnd);
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                logger.debug("Container key:", wildcardStart, key, !!wildcardEnd);

                if (wildcardEnd) {
                    const removed = lib.removePath(container[key], wildcardEnd, wildcardStart + "/" + key, returnRemovedData);
                    Object.assign(removedFields, removed);
                } else {
                    const fullPath = parentPath + wildcardStart + "/" + key;
                    if (container[key] != undefined) {
                        removedFields[fullPath] = returnRemovedData ? container[key] : null
                        // delete container[key];
                        container[key] = null;
                        logger.debug("Removed path", fullPath);
                    }
                }
            }
        }
        else {
            const parts = path.split("/").slice(1);
            const last = parts.pop();
            const container = parts.reduce(followPath, data);

            if (container[last] != undefined) {
                const fullPath = parentPath + path;
                removedFields[fullPath] = returnRemovedData ? container[last] : null
                // delete container[last];
                container[last] = null;
                logger.debug("Removed path", fullPath);
            }

        }

        return removedFields;
    },
    visit: function visit(data, keyFn, dataFn, path = "", opts = {}) {
        data = dataFn(data, path);
        let out;
        if (Array.isArray(data)) {
            out = [];
            for (var i = 0; i < data.length; i++) {
                out[i] = lib.visit(data[i], keyFn, dataFn, `${path}/${i}`, opts);
            }
        } else if (data != null && typeof data == "object") {
            out = {};
            Object.keys(data).forEach(key => {
                let newKey = keyFn(key, data, `${path}/${key}`);

                if (newKey != null) {
                    // Don't override existing data if it has values
                    if (newKey !== key && data[newKey] != null) {
                        newKey = key;
                    }

                    const newValue = lib.visit(data[key], keyFn, dataFn, `${path}/${key}`, opts);
                    if (newValue !== undefined) {
                        out[newKey] = newValue;
                    }
                }
            });
        }
        else {
            out = data;
        }
        return out;
    }
};

function followOrBuildPath(o, f) {
    return o[f] = o[f] || {};
}

function followPath(o, f) {
    return o[f] || {};
}