/*
 * EXTRATOR DOLCE GUSTO → planilha Laço & Aroma
 *
 * Como usar:
 *  No iPhone: app → "Dolce Gusto: Atualizar agora" → no site, Compartilhar → atalho "Atualizar Laço & Aroma".
 *  No notebook:
 *  1. No app, toque em "Dolce Gusto: Atualizar agora" (abre a página de sabores já com o endereço e a senha).
 *  2. Aperte F12, clique na aba "Console", cole TODO este código e aperte Enter.
 *     (Na primeira vez o Chrome pode pedir para digitar "allow pasting" antes de colar.)
 *  3. Na primeira vez, informe o endereço do catálogo (api_publica_url) e a senha do extrator
 *     (planilha → Catálogo das clientes → "Dolce Gusto: extrator e senha"). Eles ficam guardados neste navegador.
 *  4. Aguarde o painel dizer "Pronto". Produtos, preços e fotos vão direto para a planilha.
 *     Se o envio direto for bloqueado, ele baixa um arquivo "dolcegusto-....json": coloque na pasta Importar.
 */
(async () => {
  const ORIGEM = location.origin;
  if (!/dolce-?gusto/i.test(location.hostname)) { alert('Abra o site da Nescafé Dolce Gusto e rode o extrator de novo.'); return; }

  // ---------- painel de progresso ----------
  const painel = document.createElement('div');
  painel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:380px;max-height:60vh;overflow:auto;background:#FEF9F5;' +
    'border:2px solid #56613F;border-radius:14px;padding:12px 14px;font:13px/1.4 Arial,sans-serif;color:#2F3527;box-shadow:0 8px 24px rgba(0,0,0,.25)';
  painel.innerHTML = '<b style="color:#56613F;font-size:15px">Laço &amp; Aroma · extrator Dolce Gusto</b>';
  document.body.appendChild(painel);
  const log = t => { const d = document.createElement('div'); d.textContent = t; painel.appendChild(d); painel.scrollTop = 1e9; console.log('[extrator]', t); };

  // ---------- configuração guardada neste navegador ----------
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem('la_extrator') || '{}'); } catch (e) { cfg = {}; }
  // o botão "Atualizar agora" do app abre o site com o endereço e a senha no final do link (#laco=...)
  try {
    const m = location.hash.match(/laco=([^&]+)/);
    if (m) {
      const c = JSON.parse(decodeURIComponent(m[1]));
      if (c.api && c.token) { cfg = c; localStorage.setItem('la_extrator', JSON.stringify(cfg)); history.replaceState(null, '', location.pathname + location.search); }
    }
  } catch (e) { }
  if (!cfg.api || !cfg.token) {
    try {
      cfg.api = (prompt('Endereço do catálogo (api_publica_url, termina em /exec):', cfg.api || '') || '').trim();
      cfg.token = (prompt('Senha do extrator (dg_token):', cfg.token || '') || '').trim();
      if (cfg.api && cfg.token) localStorage.setItem('la_extrator', JSON.stringify(cfg));
    } catch (e) { }
  }
  if (!cfg.api || !cfg.token) { log('Abra o site da Dolce Gusto pelo botão "Atualizar agora" do app e rode de novo.'); return; }

  const numero = v => {
    if (typeof v === 'number') return v;
    let s = String(v || '').replace(/[^\d.,]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    return Number(s) || 0;
  };
  const texto = html => { const d = document.createElement('div'); d.innerHTML = html || ''; return (d.textContent || '').replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, 1800); };


  // ---------- 1ª forma: páginas de listagem da loja (todos os produtos numa página só) ----------
  const LISTAS = [
    { caminho: '/sabores', categoria: 'Cápsulas' },
    { caminho: '/maquinas-cafe', categoria: 'Máquinas' },
    { caminho: '/acessorios', categoria: 'Acessórios' }
  ];
  const absoluto = u => { try { return new URL(u, ORIGEM).href; } catch (e) { return ''; } };
  function lerCartao(el, categoriaPadrao) {
    const link = el.querySelector('a.product-item-link') || el.querySelector('.product-item-name a') || el.querySelector('a.product-item-photo') || el.querySelector('a[href]');
    const nome = ((el.querySelector('.product-item-link') || el.querySelector('.product-item-name') || link || {}).textContent || '').replace(/\s+/g, ' ').trim();
    if (!nome) return null;
    const url = link ? absoluto(link.getAttribute('href')) : '';
    const txt = (el.textContent || '').replace(/\s+/g, ' ');
    // preços: atributos do Magento (data-price-amount) ou, na falta, os "R$" do texto
    const attr = tipo => { const x = el.querySelector('[data-price-type="' + tipo + '"]'); return x ? numero(x.getAttribute('data-price-amount') || x.textContent) : 0; };
    let preco = attr('finalPrice'), de = attr('oldPrice');
    if (!preco) {
      const vals = (txt.match(/R\$\s*[\d.]+,\d{2}/g) || []).map(numero).filter(v => v > 0);
      if (vals.length >= 2 && vals[0] > vals[1]) { de = vals[0]; preco = vals[1]; } else if (vals.length) preco = vals[0];
    }
    const skuEl = el.querySelector('[data-product-sku]'), idEl = el.querySelector('[data-product-id]');
    const codigo = (skuEl && skuEl.getAttribute('data-product-sku')) || (idEl && 'DG' + idEl.getAttribute('data-product-id')) ||
      (url ? url.replace(/[?#].*$/, '').replace(/\/$/, '').split('/').pop().replace(/\.html?$/, '') : '');
    const img = el.querySelector('img.product-image-photo') || el.querySelector('img');
    let imagemSite = img ? (img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('src') || '') : '';
    if (/placeholder|data:image/.test(imagemSite)) imagemSite = '';
    const pontos = (txt.match(/(\d[\d.]*)\s*pontos/i) || [])[1];
    return {
      codigo: String(codigo).trim(), nome, preco, de: de > preco ? de : 0,
      categoria: /^combo/i.test(nome) ? 'Combos' : categoriaPadrao, url,
      disponivel: !/sem estoque|out of stock|esgotado/i.test(txt), descricao: '',
      imagemSite: absoluto(imagemSite), pontosClub: pontos ? Number(String(pontos).replace(/\./g, '')) : 0
    };
  }
  async function viaListas() {
    const lista = [], vistos = new Set();
    for (const L of LISTAS) {
      let url = ORIGEM + L.caminho + '?product_list_limit=1000', paginas = 0;
      while (url && paginas++ < 20) {
        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) { if (paginas === 1) log(L.caminho + ': página não encontrada (' + r.status + '), pulando.'); break; }
        const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
        let cartoes = [...doc.querySelectorAll('li.product-item, .product-item-info, .products-grid .item.product')];
        cartoes = cartoes.filter(c => !cartoes.some(o => o !== c && o.contains(c)));   // evita contar o mesmo produto duas vezes
        let novos = 0;
        cartoes.forEach(c => {
          const p = lerCartao(c, L.categoria);
          if (!p || !p.codigo || !(p.preco > 0) || vistos.has(p.codigo)) return;
          vistos.add(p.codigo); lista.push(p); novos++;
        });
        log(L.caminho + ': ' + novos + ' produtos' + (paginas > 1 ? ' (página ' + paginas + ')' : ''));
        const prox = doc.querySelector('.pages-item-next a, a.next');
        url = novos && prox ? absoluto(prox.getAttribute('href')) : '';
      }
    }
    return lista;
  }

  // ---------- 2ª forma: interface de dados da loja (GraphQL) ----------
  async function viaGraphQL() {
    const consulta = n => `{ products(filter: { price: { from: "0" } }, pageSize: 100, currentPage: ${n}) {
      total_count page_info { total_pages }
      items { __typename sku name url_key url_suffix canonical_url stock_status
        image { url } small_image { url } categories { name } description { html }
        price_range { minimum_price { regular_price { value } final_price { value } } } } } }`;
    const lista = [];
    for (let n = 1; n <= 60; n++) {
      const r = await fetch('/graphql', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: consulta(n) }) });
      if (!r.ok) throw new Error('GraphQL respondeu ' + r.status);
      const j = await r.json();
      if (!j.data || !j.data.products) throw new Error((j.errors && j.errors[0] && j.errors[0].message) || 'sem dados');
      const P = j.data.products;
      P.items.forEach(it => {
        const mp = (it.price_range || {}).minimum_price || {};
        const final = numero((mp.final_price || {}).value), cheio = numero((mp.regular_price || {}).value);
        const cats = (it.categories || []).map(c => c.name).filter(Boolean);
        lista.push({
          codigo: it.sku, nome: it.name, preco: final, de: cheio > final ? cheio : 0, categoria: cats[cats.length - 1] || '',
          url: ORIGEM + '/' + (it.canonical_url || (it.url_key + (it.url_suffix != null ? it.url_suffix : '.html'))).replace(/^\//, ''),
          disponivel: it.stock_status !== 'OUT_OF_STOCK', descricao: texto(it.description && it.description.html),
          imagemSite: ((it.image || it.small_image) || {}).url || ''
        });
      });
      log('Lendo produtos: ' + lista.length + ' de ' + P.total_count);
      if (n >= ((P.page_info || {}).total_pages || 1)) break;
    }
    return lista;
  }

  // ---------- 3ª forma: mapa do site + páginas de produto ----------
  async function viaPaginas() {
    const urls = new Set();
    const lerMapa = async u => {
      const r = await fetch(u, { credentials: 'include' });
      if (!r.ok) return;
      const x = new DOMParser().parseFromString(await r.text(), 'text/xml');
      const locs = [...x.getElementsByTagName('loc')].map(l => l.textContent.trim());
      if (x.getElementsByTagName('sitemap').length) { for (const l of locs) await lerMapa(l); }
      else locs.forEach(l => { if (l.indexOf(ORIGEM) === 0) urls.add(l); });
    };
    let mapas = ['/sitemap.xml', '/pub/media/sitemap.xml', '/media/sitemap.xml'];
    try {
      const rb = await (await fetch('/robots.txt')).text();
      const extras = (rb.match(/^sitemap:\s*(\S+)/gim) || []).map(l => l.split(/:\s*/).slice(1).join(':').trim());
      mapas = extras.concat(mapas);
    } catch (e) { }
    for (const m of mapas) { try { await lerMapa(m); } catch (e) { } if (urls.size) break; }
    if (!urls.size) throw new Error('não encontrei o mapa do site');
    log('Mapa do site: ' + urls.size + ' páginas. Procurando os produtos…');
    const lista = [], fila = [...urls].slice(0, 2500);
    let feitas = 0;
    const umaPagina = async u => {
      try {
        const html = await (await fetch(u, { credentials: 'include' })).text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        let prod = null, trilha = null;
        doc.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
          let j; try { j = JSON.parse(s.textContent); } catch (e) { return; }
          [].concat(j['@graph'] || j).forEach(o => {
            const t = [].concat(o['@type'] || []);
            if (t.includes('Product')) prod = o;
            if (t.includes('BreadcrumbList')) trilha = o;
          });
        });
        if (!prod) return;
        const of = [].concat(prod.offers || [])[0] || {};
        const preco = numero(of.price || of.lowPrice || (doc.querySelector('[data-price-type="finalPrice"]') || {}).getAttribute?.('data-price-amount'));
        const velho = doc.querySelector('[data-price-type="oldPrice"]');
        const de = numero(velho ? velho.getAttribute('data-price-amount') || velho.textContent : 0);
        const itens = trilha ? [].concat(trilha.itemListElement || []) : [];
        lista.push({
          codigo: String(prod.sku || prod.productID || (prod.gtin13 || '') || u.split('/').pop().replace(/\.html?$/, '')),
          nome: prod.name, preco, de: de > preco ? de : 0,
          categoria: itens.length > 1 ? ((itens[itens.length - 2].item || {}).name || itens[itens.length - 2].name || '') : '',
          url: u, disponivel: !/OutOfStock|SoldOut/i.test(String(of.availability || '')), descricao: texto(prod.description),
          imagemSite: [].concat(prod.image || [])[0] ? String([].concat(prod.image)[0].url || [].concat(prod.image)[0]) : ''
        });
      } catch (e) { }
      feitas++;
      if (feitas % 25 === 0) log('Páginas lidas: ' + feitas + ' de ' + fila.length + ' · produtos: ' + lista.length);
    };
    for (let i = 0; i < fila.length; i += 4) await Promise.all(fila.slice(i, i + 4).map(umaPagina));
    return lista;
  }

  // ---------- fotos: lidas pelo próprio site e reduzidas (500 px) ----------
  async function foto(url) {
    if (!url) return '';
    try {
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) return '';
      const bmp = await createImageBitmap(await r.blob());
      const f = Math.min(1, 500 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f);
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(bmp, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.82);
    } catch (e) { return ''; }
  }

  async function enviar(corpo) {
    const r = await fetch(cfg.api, { method: 'POST', body: JSON.stringify(Object.assign({ api: 'importar_dg', token: cfg.token }, corpo)) });
    return JSON.parse(await r.text());
  }
  function baixar(obj) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' }));
    a.download = 'dolcegusto-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- execução ----------
  let produtos = [];
  try { produtos = await viaListas(); } catch (e) { log('Listagens: ' + e.message); }
  if (produtos.length < 5) {
    log('Poucos produtos nas listagens. Tentando a interface de dados da loja…');
    try { const g = await viaGraphQL(); if (g.length > produtos.length) produtos = g; } catch (e) { log('Interface de dados indisponível (' + e.message + ').'); }
  }
  if (produtos.length < 5) {
    try { const p = await viaPaginas(); if (p.length > produtos.length) produtos = p; } catch (e) { log('Mapa do site: ' + e.message); }
  }
  produtos = produtos.filter(p => p.codigo && p.nome && p.preco > 0);
  if (!produtos.length) { log('Nenhum produto encontrado. Tente pelo notebook (Chrome) e, se continuar, mande um print deste painel.'); return; }
  log(produtos.length + ' produtos com preço. Enviando para a planilha…');

  let resp = null;
  try { resp = await enviar({ produtos }); } catch (e) { resp = null; }
  if (!resp) {
    if (/iPhone|iPad|Android/i.test(navigator.userAgent)) { log('O site bloqueou o envio pelo celular. Rode pelo notebook: botão "Atualizar agora" do app no Chrome.'); return; }
    log('O site bloqueou o envio direto. Preparando o arquivo com as fotos (pode levar alguns minutos)…');
    const fotos = {};
    let n = 0;
    for (const p of produtos) { const f = await foto(p.imagemSite); if (f) fotos[p.codigo] = f; if (++n % 20 === 0) log('Fotos: ' + n + ' de ' + produtos.length); }
    baixar({ origem: 'dolce-gusto', gerado: new Date().toISOString(), produtos, fotos });
    log('Pronto: arquivo baixado. Coloque-o na pasta Importar do Drive (a planilha lê em até 15 minutos).');
    return;
  }
  if (!resp.ok) {
    log('Erro da planilha: ' + resp.erro);
    if (/senha/i.test(resp.erro || '')) { cfg.token = ''; localStorage.setItem('la_extrator', JSON.stringify(cfg)); log('Rode de novo para informar a senha correta.'); }
    return;
  }
  log('Planilha: ' + resp.novos + ' novos, ' + resp.atualizados + ' atualizados' + (resp.saiu ? ', ' + resp.saiu + ' saíram do site' : '') + '.');

  // fotos só dos produtos que ainda não têm (em lotes)
  const faltam = produtos.filter(p => (resp.semFoto || []).includes(String(p.codigo)));
  if (faltam.length) log('Enviando ' + faltam.length + ' fotos…');
  let enviadas = 0;
  for (let i = 0; i < faltam.length; i += 10) {
    const fotos = {};
    for (const p of faltam.slice(i, i + 10)) { const f = await foto(p.imagemSite); if (f) fotos[p.codigo] = f; }
    if (!Object.keys(fotos).length) continue;
    try { const r = await enviar({ produtos: [], fotos }); if (r.ok) enviadas += r.fotos; } catch (e) { }
    log('Fotos enviadas: ' + enviadas + ' de ' + faltam.length);
  }
  log('Pronto! O catálogo é atualizado na próxima publicação automática (até 15 minutos).');
})();
