export function deepClone(val) {
    if (Array.isArray(val)) {
        return val.map(v => deepClone(v));
    }
    if (val && typeof val === 'object') {
        const obj = {};
        Object.keys(val).forEach(k => {
            obj[k] = deepClone(val[k]);
        });
        return obj;
    }
    return val;
}
