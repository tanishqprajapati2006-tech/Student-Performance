require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("WARNING: SUPABASE_URL or SUPABASE_ANON_KEY not set in .env");
}

// Lightweight Supabase REST client using built-in fetch (Node 18+)
const supabase = {
    _headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    },

    from(table) {
        return new QueryBuilder(SUPABASE_URL, this._headers, table);
    },

    auth: {
        async signUp({ email, password }) {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) return { data: null, error: data };
            return { data: { user: data.user, session: data.session }, error: null };
        },

        async signInWithPassword({ email, password }) {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) return { data: null, error: data };
            return { data: { user: data.user, session: { access_token: data.access_token } }, error: null };
        },

        async getUser(token) {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) return { data: { user: null }, error: data };
            return { data: { user: data }, error: null };
        }
    }
};

class QueryBuilder {
    constructor(url, headers, table) {
        this._url = url;
        this._headers = { ...headers };
        this._table = table;
        this._filters = [];
        this._selectCols = '*';
        this._limit = null;
        this._order = null;
        this._single = false;
        this._method = 'GET';
        this._body = null;
    }

    select(cols = '*') { this._selectCols = cols; return this; }
    eq(col, val) { this._filters.push(`${col}=eq.${val}`); return this; }
    order(col, { ascending = true } = {}) { this._order = `${col}.${ascending ? 'asc' : 'desc'}`; return this; }
    limit(n) { this._limit = n; return this; }
    single() { this._single = true; return this; }

    insert(data) {
        this._method = 'POST';
        this._body = Array.isArray(data) ? data : [data];
        return this;
    }

    update(data) {
        this._method = 'PATCH';
        this._body = data;
        return this;
    }

    upsert(data) {
        this._method = 'POST';
        this._headers['Prefer'] = 'resolution=merge-duplicates,return=representation';
        this._body = Array.isArray(data) ? data : [data];
        return this;
    }

    async then(resolve, reject) {
        try {
            let url = `${this._url}/rest/v1/${this._table}?select=${this._selectCols}`;
            this._filters.forEach(f => url += `&${f}`);
            if (this._order) url += `&order=${this._order}`;
            if (this._limit) url += `&limit=${this._limit}`;

            const opts = { method: this._method, headers: this._headers };
            if (this._body) opts.body = JSON.stringify(this._body);

            const res = await fetch(url, opts);
            const text = await res.text();
            const data = text ? JSON.parse(text) : null;

            if (!res.ok) return resolve({ data: null, error: data });

            if (this._single) {
                const arr = Array.isArray(data) ? data : [data];
                return resolve({ data: arr[0] || null, error: null });
            }
            return resolve({ data: data || [], error: null });
        } catch (err) {
            resolve({ data: null, error: { message: err.message } });
        }
    }
}

module.exports = supabase;
