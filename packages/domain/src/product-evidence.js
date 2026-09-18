export function evidenceNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
    if (typeof value !== 'string') return null;
    const raw = value.trim().replace(/^R\s*/i, '').replace(/\s/g, '');
    if (!/^\d[\d.,]*$/.test(raw)) return null;
    const separator = Math.max(raw.lastIndexOf(','), raw.lastIndexOf('.'));
    const decimal = separator >= 0 && raw.length - separator - 1 <= 2;
    const normal = decimal ? raw.slice(0, separator).replace(/[.,]/g, '') + '.' + raw.slice(separator + 1) : raw.replace(/[.,]/g, '');
    const result = Number(normal);
    return Number.isFinite(result) && result >= 0 ? result : null;
}
export function productEvidence(answers = {}, questions = []) {
    const key = (s)=>s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const get = (source, names)=>{
        const direct = Object.entries(source).find(([k])=>names.includes(key(k)));
        if (direct) return direct[1];
        const question = questions.find(q => q && typeof q.id === 'string' && typeof q.label === 'string' && names.includes(key(q.label)) && Object.hasOwn(source, q.id));
        return question ? source[question.id] : undefined;
    };
    const brands = [
        'brand',
        'selectbrand',
        'brandselection'
    ];
    const products = [
        'product',
        'productname'
    ];
    const sizes = [
        'selectproducttype',
        'productsize',
        'packsize'
    ];
    const purchase = [
        'purchaseprice',
        'costprice',
        'buyingprice',
        'buyprice',
        'purchasepricer',
        'costpricer', 'purchasepricezar', 'costpricezar', 'purchasepriceperunit', 'buyingpricer'
    ];
    const selling = [
        'sellingprice',
        'sellprice',
        'retailprice',
        'sellingpricer', 'sellingpricezar', 'sellingpriceperunit', 'retailpricer'
    ];
    const volumes = [
        'volume',
        'dailyvolume',
        'dailysalesvolume'
    ];
    if (Array.isArray(answers.brandProducts) && answers.brandProducts.length) return answers.brandProducts.filter((p)=>p && typeof p === 'object').map((p)=>({
            brand: String(get(p, brands) ?? ''),
            product: String(get(p, products) ?? ''),
            purchasePrice: evidenceNumber(get(p, purchase)),
            sellingPrice: evidenceNumber(get(p, selling)),
            dailySalesVolume: evidenceNumber(get(p, volumes))
        }));
    const values = (names)=>{
        const v = get(answers, names);
        return Array.isArray(v) ? v : v === undefined ? [] : [
            v
        ];
    };
    const b = values(brands), p = values(products), z = values(sizes), buy = values(purchase), sell = values(selling), v = values(volumes);
    return Array.from({
        length: Math.max(b.length, p.length, z.length)
    }, (_, i)=>({
            brand: String(b[i] ?? ''),
            product: [
                p[i],
                z[i]
            ].filter(Boolean).join(' '),
            purchasePrice: evidenceNumber(buy[i]),
            sellingPrice: evidenceNumber(sell[i]),
            dailySalesVolume: evidenceNumber(v[i])
        }));
}
