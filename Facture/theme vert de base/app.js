const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), euro = n => new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(n), today = () => new Date().toISOString().slice(0, 10), fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('fr-BE');
let clients = [];
let company = { name: '', address: '', vat: '', iban: '', email: '' };
const catalog = [['Entretien de chaudière', 1, 145], ['Main-d’œuvre (heure)', 1, 55], ['Déplacement', 1, 35], ['Réparation de fuite', 1, 85], ['Robinet mitigeur', 1, 95]];
let docs = [];
let account = null;
let db = null;
let busy = false;
let authMode = 'login';
let sessionGeneration = 0;
let draft = null, step = 1, filter = 'all', returnToWizard = false;
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
function totals(d) { let net = 0, tax = 0; d.lines.forEach(l => { const v = round(l.qty * l.price); net += v; tax += round(v * l.tax / 100) }); return { net: round(net), tax: round(tax), total: round(net + tax) } }
const client = d => d.customer || clients.find(c => c.id === d.client) || { name: 'Client', address: '' };
function toast(t) { $('#toast').textContent = t; $('#toast').style.display = 'block'; clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => $('#toast').style.display = 'none', 4200) }
function go(r) { if (location.hash === '#' + r) render(); else location.hash = r }
function intro(title, sub, action = '') { return `<div class="intro"><div><div class="eyebrow">Votre atelier, bien organisé</div><h1>${title}</h1><p>${sub}</p></div>${action}</div>` }
function rows(list) { return list.length ? list.map(d => `<div class="doc-row"><div><strong>${esc(client(d).name)}</strong><small>${esc(d.id)} · ${fmt(d.date)}</small><small>${esc(d.job)}</small></div><div class="doc-status"><span class="badge ${d.type === 'devis' ? 'quote' : d.paid ? 'paid' : 'pending'}">${d.type === 'devis' ? 'Devis à confirmer' : d.paid ? 'Payée' : 'À payer'}</span></div><div class="amount">${euro(totals(d).total)}</div><button onclick="go('view/${d.id}')">Voir <span aria-hidden="true">↗</span></button></div>`).join('') : '<div class="empty">Aucun document ici pour le moment.</div>' }
function home() { const unpaid = docs.filter(d => d.type === 'facture' && !d.paid), paid = docs.filter(d => d.type === 'facture' && d.paid); return `${intro('Bonjour, bienvenue chez vous.', 'Qu’est-ce qu’on fait aujourd’hui ?', `<span class="date">${new Date().toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}</span>`)}<div class="actions"><button class="action-card main" onclick="start('facture')"><span class="action-icon" aria-hidden="true">+</span><span><strong>Nouvelle facture</strong><small>Les travaux sont terminés ?</small></span><span class="arrow" aria-hidden="true">→</span></button><button class="action-card" onclick="start('devis')"><span class="action-icon" aria-hidden="true">▤</span><span><strong>Nouveau devis</strong><small>Préparez votre prochain chantier.</small></span><span class="arrow" aria-hidden="true">→</span></button></div>${draft ? '<div class="notice">Vous avez un document en cours. <button class="link" onclick="go(\'wizard\')">Reprendre mon brouillon</button></div>' : ''}<div class="stats"><div class="stat"><span>Il reste à recevoir</span><strong>${euro(unpaid.reduce((s, d) => s + totals(d).total, 0))}</strong><small>${unpaid.length} facture(s) à payer</small></div><div class="stat"><span>Déjà encaissé</span><strong>${euro(paid.reduce((s, d) => s + totals(d).total, 0))}</strong><small>Sur vos factures</small></div><div class="stat"><span>Devis en attente</span><strong>${docs.filter(d => d.type === 'devis').length}</strong><small>À confirmer avec vos clients</small></div></div><div class="section-head"><h2>Vos derniers documents</h2><a class="link" href="#docs">Voir tous les documents →</a></div><div class="panel">${rows(docs.slice(0, 3))}</div><div class="bottom-note"><b>ⓘ</b><span>Vos documents sont enregistrés dans votre compte. Vérifiez les mentions et les taux de TVA avant une utilisation professionnelle.</span></div>` }
function start(type) { if (draft) { go('wizard'); toast('Votre brouillon est toujours là. Terminez-le ou utilisez « Abandonner ce brouillon ».'); return } draft = { type, client: null, date: today(), due: today(), job: '', lines: [] }; step = 1; go('wizard') }
function wizard() { if (!draft) return home(); return `${intro(draft.type === 'devis' ? 'Préparer mon devis' : 'Créer ma facture', 'Prenons les choses dans l’ordre.')}<div class="steps">${['Le client', 'Les travaux', 'Vérifier'].map((s, i) => `<div class="step ${step === i + 1 ? 'active' : ''}" ${step === i + 1 ? 'aria-current="step"' : ''}><b>${i + 1}</b>${s}</div>`).join('')}</div><div class="panel">${step === 1 ? `<h2>Pour quel client ?</h2><div class="client-grid">${clients.map(c => `<button class="client-card ${draft.client === c.id ? 'selected' : ''}" aria-pressed="${draft.client === c.id}" onclick="draft.client='${c.id}';render()"><strong>${esc(c.name)}</strong><small>${esc(c.address).replace(/\n/g, '<br>')}</small></button>`).join('')}</div><button class="link" style="margin-top:20px" onclick="returnToWizard=true;go('newclient')">+ Ajouter un nouveau client</button><div class="form-footer"><a href="#home" class="link">Retour à l’accueil</a><button class="primary" onclick="next()">Continuer vers les travaux →</button></div>` : step === 2 ? `<h2>Quels travaux avez-vous réalisés ?</h2><label class="field">Nom du chantier ou des travaux<input id="job" value="${esc(draft.job)}" placeholder="Ex. Entretien de chaudière" oninput="draft.job=this.value"></label><label class="field">Adresse du chantier (si différente)<input value="${esc(draft.site || '')}" placeholder="Facultatif" oninput="draft.site=this.value"></label><p class="muted">Ajoutez une prestation, puis adaptez la quantité et le prix.</p><div class="catalog">${catalog.map((c, i) => `<button onclick="addLine(${i})">+ ${c[0]}</button>`).join('')}<button onclick="addLine(-1)">+ Autre prestation</button></div>${draft.lines.map((l, i) => `<div class="line-item"><label>Prestation<input aria-label="Prestation ${i + 1}" value="${esc(l.name)}" oninput="updateLine(${i},'name',this.value)"></label><label>Quantité<input aria-label="Quantité ${i + 1}" type="number" min="0.01" step="0.01" value="${l.qty}" oninput="updateLine(${i},'qty',this.value)"></label><label>Prix HTVA (€)<input aria-label="Prix ${i + 1}" type="number" min="0" step="0.01" value="${l.price}" oninput="updateLine(${i},'price',this.value)"></label><label>TVA<select aria-label="TVA ${i + 1}" onchange="updateLine(${i},'tax',this.value)">${[0, 6, 12, 21].map(t => `<option ${t === l.tax ? 'selected' : ''} value="${t}">${t} %</option>`).join('')}</select></label><button aria-label="Retirer la prestation ${i + 1}" onclick="draft.lines.splice(${i},1);render()">Retirer</button></div>`).join('') || '<div class="empty">Choisissez une prestation ci-dessus pour commencer.</div>'}<div id="totals">${totalBlock(draft)}</div><div class="notice">Les taux proposés sont indicatifs. Le taux applicable et les mentions nécessaires doivent être validés avant toute utilisation réelle.</div><div class="form-grid"><label class="field">Date du document<input type="date" value="${draft.date}" onchange="draft.date=this.value"></label><label class="field">${draft.type === 'devis' ? 'Devis valable jusqu’au' : 'À payer pour le'}<input type="date" value="${draft.due}" onchange="draft.due=this.value"></label></div><div class="form-footer"><button onclick="step=1;render()">← Le client</button><button class="primary" onclick="next()">Vérifier mon document →</button></div>` : `<h2>Tout est correct ?</h2><p>Relisez votre document avant de l’enregistrer.</p>${documentHTML({ ...draft, id: 'Numéro attribué à l’enregistrement' })}<div class="form-footer"><button onclick="step=2;render()">← Modifier les travaux</button><button class="primary" onclick="saveDraft()">Enregistrer ${draft.type === 'devis' ? 'mon devis' : 'ma facture'}</button></div>`}<p id="error" class="error" role="alert"></p></div><button class="link muted" style="margin-top:20px" onclick="if(confirm('Abandonner ce brouillon et revenir à l’accueil ?')){draft=null;go('home')}">Abandonner ce brouillon</button>` }
function totalBlock(d) { const t = totals(d); return `<div class="total"><div><span>Total hors TVA</span><span>${euro(t.net)}</span></div><div><span>TVA</span><span>${euro(t.tax)}</span></div><div class="grand"><span>Total à payer</span><span>${euro(t.total)}</span></div></div>` }
function addLine(i) { const c = i < 0 ? ['', 1, 0] : catalog[i]; draft.lines.push({ name: c[0], qty: c[1], price: c[2], tax: 21 }); render() }
function updateLine(i, k, v) { draft.lines[i][k] = k === 'name' ? v : (v === '' ? NaN : Number(v)); $('#totals').innerHTML = totalBlock(draft) }
function next() { let msg = ''; if (step === 1 && !draft.client) msg = 'Choisissez un client pour continuer.'; if (step === 2) { if (!draft.job.trim()) msg = 'Indiquez le nom des travaux.'; else if (!draft.lines.length || draft.lines.some(l => !l.name.trim() || !Number.isFinite(l.qty) || l.qty <= 0 || !Number.isFinite(l.price) || l.price < 0)) msg = 'Ajoutez au moins une prestation avec un nom, une quantité positive et un prix valide.'; else if (!draft.date || !draft.due || draft.due < draft.date) msg = 'Choisissez des dates valides : la date limite doit être égale ou postérieure à la date du document.' } if (msg) { $('#error').textContent = msg; return } step++; render(); window.scrollTo(0, 0) }
function newId(type) { const p = type === 'devis' ? 'D' : 'F', year = new Date().getFullYear(); let n = 1; while (docs.some(d => d.id === `${p}-${year}-${String(n).padStart(3, '0')}`)) n++; return `${p}-${year}-${String(n).padStart(3, '0')}` }
async function saveDraft() { if (!draft || busy) return; if (!company.name.trim() || !company.address.trim()) { toast('Complétez les coordonnées de votre entreprise avant d’enregistrer.'); return } busy = true; try { const d = await persistDocument({ ...structuredClone(draft), id: newId(draft.type), paid: false, issuer: structuredClone(company), customer: structuredClone(client(draft)) }); docs.unshift(d); draft = null; go('view/' + d.id); toast('Document enregistré.') } catch (error) { showError(error) } finally { busy = false } }
function documentHTML(d) { const c = d.customer || client(d), biz = d.issuer || company; return `<article class="document"><div class="document-top"><div><strong>${esc(biz.name)}</strong><p class="muted">${esc(biz.address)}<br>${esc(biz.vat)}</p></div><div><h2>${d.type === 'devis' ? 'DEVIS' : 'FACTURE'}</h2><strong>${esc(d.id)}</strong><p>Date : ${fmt(d.date)}<br>${d.type === 'devis' ? 'Valable jusqu’au' : 'Échéance'} : ${fmt(d.due)}</p></div></div><hr style="border:0;border-top:1px solid var(--line)"><p><small class="muted">CLIENT</small><br><strong>${esc(c.name)}</strong><br>${esc(c.address)}</p><h3>${esc(d.job)}</h3>${d.site ? `<p>Chantier : ${esc(d.site)}</p>` : ''}<table><thead><tr><th>Prestation</th><th>Qté</th><th>Prix HTVA</th><th>TVA</th><th>Total HTVA</th></tr></thead><tbody>${d.lines.map(l => `<tr><td>${esc(l.name)}</td><td>${l.qty}</td><td>${euro(l.price)}</td><td>${l.tax} %</td><td>${euro(round(l.qty * l.price))}</td></tr>`).join('')}</tbody></table>${totalBlock(d)}<p style="margin-top:25px">Compte bancaire : ${esc(biz.iban)}<br>Communication : ${esc(d.id)}</p><div class="demo-stamp">DOCUMENT À VÉRIFIER AVANT UTILISATION</div><p class="muted" style="font-size:.8rem;margin-top:15px">Mentions légales et traitement TVA à valider avant utilisation professionnelle. Aucun envoi Peppol.</p></article>` }
function view(id) { const d = docs.find(d => d.id === id); if (!d) return intro('Document introuvable', 'Retrouvez vos documents depuis le menu.'); return `<div class="no-print">${intro(d.type === 'devis' ? 'Votre devis' : 'Votre facture', `${esc(client(d).name)} · ${esc(d.id)}`)}<div class="filter-row"><button onclick="go('docs')">← Mes documents</button><button class="primary" onclick="window.print()">Imprimer / PDF</button>${d.type === 'devis' ? `<button onclick="convert('${d.id}')">Transformer en facture</button>` : `<button onclick="togglePaid('${d.id}')">${d.paid ? 'Annuler le paiement' : 'Marquer comme payée'}</button>`}</div><p class="muted">Pour télécharger un PDF, choisissez « Enregistrer au format PDF » dans la fenêtre d’impression.</p></div>${documentHTML(d)}` }
async function convert(id) { const d = docs.find(d => d.id === id); if (!d || busy) return; if (d.converted) { go('view/' + d.converted); return } busy = true; try { const n = await persistDocument({ ...structuredClone(d), id: newId('facture'), type: 'facture', paid: false, date: today(), due: today() }, d.dbId); n.convertedFrom = d.dbId; d.converted = n.id; docs.unshift(n); go('view/' + n.id); toast('Devis transformé en facture.') } catch (error) { showError(error); await loadData().catch(showError) } finally { busy = false } }
async function togglePaid(id) { const d = docs.find(d => d.id === id); if (!d || busy) return; busy = true; try { const paid = !d.paid; const { error } = await db.from('documents').update({ paid }).eq('id', d.dbId).eq('user_id', account.id); if (error) throw error; d.paid = paid; render(); toast(paid ? 'Paiement noté.' : 'Paiement annulé.') } catch (error) { showError(error) } finally { busy = false } }
function clientsView() { return `${intro('Mes clients', 'Retrouvez leurs coordonnées en un coup d’œil.', '<button class="primary" onclick="returnToWizard=false;go(\'newclient\')">+ Ajouter un client</button>')}<div class="client-grid">${clients.map(c => `<div class="panel"><h2>${esc(c.name)}</h2><p class="muted">${esc(c.address).replace(/\n/g, '<br>')}<br>${esc(c.email)}</p><button onclick="startForClient('${c.id}')">Créer une facture</button></div>`).join('')}</div>` }
function startForClient(id) { if (draft) { go('wizard'); toast('Terminez ou abandonnez votre brouillon en cours.'); return } start('facture'); draft.client = id; render() }
function newClient() { return `${intro('Ajouter un client', 'Les informations utiles, tout simplement.')}<form class="panel" id="clientform"><label class="field">Nom du client<input name="name" autocomplete="name" required></label><label class="field">Adresse complète<textarea name="address" autocomplete="street-address" required></textarea></label><label class="field">Adresse e-mail (facultatif)<input name="email" type="email" autocomplete="email"></label><div class="form-footer"><button type="button" onclick="go(returnToWizard?'wizard':'clients')">← Retour</button><button class="primary" type="submit">Enregistrer le client</button></div></form>` }
function companyView() { return `${intro('Mon entreprise', 'Ces coordonnées apparaissent sur vos nouveaux documents.')}<form id="companyform" class="panel"><label class="field">Nom de l’entreprise<input name="name" required value="${esc(company.name)}"></label><label class="field">Adresse<textarea name="address" required>${esc(company.address)}</textarea></label><div class="form-grid"><label class="field">Numéro de TVA<input name="vat" value="${esc(company.vat)}"></label><label class="field">Compte bancaire IBAN<input name="iban" value="${esc(company.iban)}"></label></div><label class="field">Adresse e-mail<input name="email" type="email" value="${esc(company.email)}"></label><div class="notice">Les coordonnées sont enregistrées dans votre compte et copiées sur chaque nouveau document.</div><button class="primary">Enregistrer mes coordonnées</button></form>` }
function render() {
    if (!account) { $('#main').innerHTML = authHTML(); $('#logout').hidden = true; return }
    $('#logout').hidden = false;
    const route = location.hash.slice(1) || 'home'; document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === route || (route.startsWith('view') && a.dataset.nav === 'docs'))); let html; if (route === 'wizard') html = wizard(); else if (route === 'clients') html = clientsView(); else if (route === 'newclient') html = newClient(); else if (route === 'company') html = companyView(); else if (route.startsWith('view/')) html = view(route.slice(5)); else if (route === 'docs') html = `${intro('Devis et factures', 'Tous vos documents, au même endroit.')}<div class="filter-row">${[['all', 'Tous'], ['facture', 'Factures'], ['devis', 'Devis']].map(([v, l]) => `<button class="${filter === v ? 'active' : ''}" onclick="filter='${v}';render()">${l}</button>`).join('')}</div><div class="panel">${rows(docs.filter(d => filter === 'all' || d.type === filter))}</div>`; else if (route === 'payments') html = `${intro('Qui doit encore me payer ?', 'Ouvrez une facture pour noter son paiement.')}<div class="panel">${rows(docs.filter(d => d.type === 'facture' && !d.paid))}</div><div class="section-head" style="margin-top:30px"><h2>Factures payées</h2></div><div class="panel">${rows(docs.filter(d => d.type === 'facture' && d.paid))}</div>`; else html = home(); $('#main').innerHTML = html;
    if ($('#clientform')) $('#clientform').onsubmit = e => { e.preventDefault(); const f = new FormData(e.target), name = f.get('name').trim(), address = f.get('address').trim(); if (!name || !address) { toast('Complétez le nom et l’adresse du client.'); return } saveClient({ name, address, email: f.get('email').trim() }).then(c => { clients.push(c); if (returnToWizard && draft) { draft.client = c.id; go('wizard') } else go('clients'); toast('Client enregistré.') }).catch(showError) };
    if ($('#companyform')) $('#companyform').onsubmit = e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.target)); if (!values.name.trim() || !values.address.trim()) { toast('Complétez le nom et l’adresse.'); return } saveCompany(values).then(() => { company = values; toast('Coordonnées enregistrées.') }).catch(showError) };
}
window.addEventListener('hashchange', () => {
    render();
    $('#main').focus();
    window.scrollTo(0, 0);
});
$('#help').onclick = () => $('#helpdialog').showModal();
$('#logout').onclick = async () => {
    const { error } = await db.auth.signOut();
    if (error) showError(error);
};
$('#textsize').onclick = () => {
    const large = document.documentElement.dataset.large !== 'yes';
    document.documentElement.dataset.large = large ? 'yes' : 'no';
    document.documentElement.style.fontSize = large ? '22px' : '';
    $('#textsize').innerHTML = large ? 'A− <span>Texte standard</span>' : 'A+ <span>Agrandir le texte</span>';
};

function authHTML() {
    const configured = window.APP_CONFIG?.supabaseUrl?.startsWith('https://')
        && window.APP_CONFIG?.supabaseKey && !window.APP_CONFIG.supabaseKey.startsWith('VOTRE_');
    if (!configured || !window.supabase?.createClient) {
        return intro('Configuration nécessaire', 'Renseignez l’URL et la clé publique dans config.js, puis rechargez la page.');
    }
    return `${intro(authMode === 'signup' ? 'Créer mon compte' : 'Me connecter', 'Retrouvez vos clients et documents sur vos appareils.')}
        <form id="authform" class="panel auth-panel">
            <label class="field">Adresse e-mail<input type="email" name="email" autocomplete="email" required></label>
            <label class="field">Mot de passe<input type="password" name="password" autocomplete="${authMode === 'signup' ? 'new-password' : 'current-password'}" minlength="6" required></label>
            <div class="form-footer">
                <button class="primary" type="submit">${authMode === 'signup' ? 'Créer mon compte' : 'Me connecter'}</button>
            </div>
            <button class="link" type="button" onclick="authMode='${authMode === 'signup' ? 'login' : 'signup'}';render()">${authMode === 'signup' ? 'J’ai déjà un compte' : 'Créer un compte'}</button>
            <p id="authmessage" role="status"></p>
        </form>`;
}

function showError(error) {
    console.error(error);
    toast('Enregistrement impossible : ' + (error?.message || 'vérifiez votre connexion et réessayez.'));
}

async function saveClient({ name, address, email }) {
    const { data, error } = await db.from('clients')
        .insert({ user_id: account.id, name, address, email: email || null })
        .select('id,name,address,email').single();
    if (error) throw error;
    return data;
}

async function saveCompany(values) {
    const { error } = await db.from('companies').upsert({
        user_id: account.id,
        name: values.name.trim(), address: values.address.trim(),
        vat: values.vat?.trim() || null, iban: values.iban?.trim() || null,
        email: values.email?.trim() || null, updated_at: new Date().toISOString()
    });
    if (error) throw error;
}

function readDocument(row, lines) {
    return {
        id: row.number, dbId: row.id, type: row.type, client: row.client_id,
        date: row.issue_date, due: row.due_date, job: row.job, site: row.site,
        paid: row.paid, convertedFrom: row.converted_from,
        issuer: row.issuer_snapshot, customer: row.customer_snapshot,
        lines: lines.filter(line => line.document_id === row.id)
            .sort((a, b) => a.position - b.position)
            .map(line => ({ name: line.name, qty: Number(line.quantity),
                price: Number(line.unit_price), tax: Number(line.vat_rate) }))
    };
}

async function loadData() {
    const userId = account.id;
    const [clientResult, companyResult, documentResult, lineResult] = await Promise.all([
        db.from('clients').select('id,name,address,email').eq('user_id', userId).order('created_at'),
        db.from('companies').select('name,address,vat,iban,email').eq('user_id', userId).maybeSingle(),
        db.from('documents').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        db.from('document_lines').select('*').eq('user_id', userId).order('position')
    ]);
    for (const result of [clientResult, companyResult, documentResult, lineResult]) {
        if (result.error) throw result.error;
    }
    if (account?.id !== userId) return;
    clients = clientResult.data || [];
    company = companyResult.data || { name: '', address: '', vat: '', iban: '', email: '' };
    docs = (documentResult.data || []).map(row => readDocument(row, lineResult.data || []));
    for (const doc of docs) {
        const converted = docs.find(other => other.convertedFrom === doc.dbId);
        if (converted) doc.converted = converted.id;
    }
    render();
}

async function persistDocument(source, convertedFrom = null) {
    // Le numéro est encore produit côté navigateur. Pour des factures réelles,
    // utilisez une numérotation transactionnelle côté serveur.
    const payload = {
        user_id: account.id, client_id: source.client,
        number: source.id, type: source.type,
        issue_date: source.date, due_date: source.due,
        job: source.job, site: source.site || null, paid: source.paid,
        issuer_snapshot: source.issuer, customer_snapshot: source.customer,
        converted_from: convertedFrom
    };
    const { data: row, error } = await db.from('documents').insert(payload).select('id').single();
    if (error) throw error;
    const entries = source.lines.map((line, position) => ({
        user_id: account.id, document_id: row.id, position,
        name: line.name, quantity: line.qty, unit_price: line.price, vat_rate: line.tax
    }));
    const result = await db.from('document_lines').insert(entries);
    if (result.error) {
        const rollback = await db.from('documents').delete().eq('id', row.id).eq('user_id', account.id);
        if (rollback.error) console.error('Nettoyage du document incomplet', rollback.error);
        throw result.error;
    }
    return { ...source, dbId: row.id };
}

async function initialize() {
    if (!window.supabase?.createClient || !window.APP_CONFIG?.supabaseUrl?.startsWith('https://')
        || !window.APP_CONFIG?.supabaseKey || window.APP_CONFIG.supabaseKey.startsWith('VOTRE_')) {
        render();
        return;
    }
    db = window.supabase.createClient(window.APP_CONFIG.supabaseUrl, window.APP_CONFIG.supabaseKey);
    db.auth.onAuthStateChange((_event, session) => {
        const nextId = session?.user?.id || null;
        if (nextId === account?.id) return;
        const generation = ++sessionGeneration;
        account = session?.user || null;
        clients = []; docs = [];
        company = { name: '', address: '', vat: '', iban: '', email: '' };
        draft = null;
        render();
        if (account) loadData().catch(error => {
            if (generation === sessionGeneration) showError(error);
        });
    });
    const { data, error } = await db.auth.getSession();
    if (error) showError(error);
    if (data?.session?.user && !account) {
        account = data.session.user;
        await loadData().catch(showError);
    }
    render();
}

document.addEventListener('submit', async event => {
    if (event.target.id !== 'authform') return;
    event.preventDefault();
    const form = event.target;
    const message = form.querySelector('#authmessage');
    const submit = form.querySelector('[type="submit"]');
    const values = new FormData(form);
    submit.disabled = true;
    message.textContent = 'Veuillez patienter…';
    try {
        const credentials = { email: String(values.get('email')).trim(),
            password: String(values.get('password')) };
        const result = authMode === 'signup'
            ? await db.auth.signUp({ ...credentials, options: {
                emailRedirectTo: location.origin + location.pathname
            } })
            : await db.auth.signInWithPassword(credentials);
        if (result.error) throw result.error;
        if (authMode === 'signup' && !result.data.session) {
            message.textContent = 'Vérifiez votre boîte e-mail pour confirmer votre compte.';
        } else {
            message.textContent = 'Connexion réussie.';
        }
    } catch (error) {
        message.textContent = error.message || 'Connexion impossible.';
    } finally {
        submit.disabled = false;
    }
});

initialize();
