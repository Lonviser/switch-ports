import { imageKey, repositoryKey, compareProjects } from './catalog-utils.js';
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = url => { try { const u = new URL(url); return ['https:', 'http:'].includes(u.protocol) ? escape(u.href) : '#'; } catch { return '#'; } };
const external = (url, label, cls = 'secondary-button') => `<a class="${cls}" href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
const labels = { 'Emulators': 'Эмуляторы', 'Android 32bit': 'Android · 32 bit', 'Android 64bit': 'Android · 64 bit', 'Arcade': 'Аркадные автоматы', 'Nintendo Gameboy': 'Game Boy', 'Nintendo Gameboy Color': 'Game Boy Color', 'Nintendo Gameboy Advance': 'Game Boy Advance', 'Nintendo GameCube': 'GameCube', 'Sega Genesis': 'SEGA Mega Drive', 'Nintendo 64': 'Nintendo 64', 'PC': 'PC', 'Sony Playstation': 'PlayStation', 'Sony Playstation 2': 'PlayStation 2', 'Super Nintendo Entertainment System': 'Super Nintendo', 'Microsoft Xbox': 'Xbox', 'Microsoft Xbox 360': 'Xbox 360', 'Nintendo Wii U': 'Wii U' };
const covers = [
  [/^half[ -]life$/i, 'half-life'], [/^sonic adventure 2$/i, 'sonic'], [/^torchlight$/i, 'torchlight'], [/^ultra street fighter iv$/i, 'street-fighter'], [/^space hulk$/i, 'space-hulk'], [/^flatout 2$/i, 'flatout'], [/^space channel 5: part 2$/i, 'space-channel'], [/^quake$/i, 'quake'], [/^quake ii$/i, 'quake2'], [/^doom$/i, 'doom'], [/^duke nukem 3d$/i, 'duke'], [/^return to castle wolfenstein$/i, 'wolfenstein'], [/^star wars.*jedi.*outcast/i, 'jedi'], [/^baldur.*gate.*dark alliance$/i, 'dark-alliance'], [/^max payne$/i, 'max-payne'], [/^rollercoaster tycoon 2$/i, 'rct2'], [/^stone story rpg$/i, 'stone-story'], [/^undertale yellow$/i, null]
];
const palettes = [['#d9dfc5','#475938'],['#d9cebf','#6c533e'],['#d1dce3','#415c6e'],['#e3d3cd','#80564c'],['#dad4e5','#655078'],['#c8ddce','#3b6350'],['#e4dbb9','#716235']];
const params = new URLSearchParams(location.search);
let favorites;
try { favorites = new Set(JSON.parse(localStorage.getItem('switch-ports:favorites') || '[]')); } catch { favorites = new Set(); }
const state = { q: params.get('q') || '', category: params.get('platform') || '', view: ['all','recent','favorites'].includes(params.get('view')) ? params.get('view') : 'all', kind: ['all','port','emulator'].includes(params.get('type')) ? params.get('type') : 'all', firmware: params.get('fw') === '21', sort: ['popular','updated','oldest','title'].includes(params.get('sort')) ? params.get('sort') : 'popular', limit: 18 };
let catalog = null, enrichment = {images:{},repositories:{}}, filtered = [], trigger = null, toastTimer;
const PAGE_SIZE = 18;
const normalize = text => text.toLocaleLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]/gu,'');
const isRecent = entry => {
  if (!entry.updatedAt) return false;
  const age = Date.now() - new Date(entry.updatedAt + 'T00:00:00Z').getTime();
  return age >= 0 && age < 7 * 86400000;
};
const formatDate = value => value ? new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'short', year:'numeric', timeZone:'Europe/Minsk' }).format(new Date(value)) : 'Дата не указана';
const author = entry => { const u = new URL(entry.url); return u.hostname === 'github.com' || u.hostname === 'gitlab.com' ? u.pathname.split('/')[1] : u.hostname; };
const platform = entry => entry.kind === 'emulator' ? entry.system : labels[entry.category] || entry.category;
const firmwareLabel = entry => ({ yes:'Подтверждена источником', no:'В источнике: нет', unknown:'Нет данных' }[entry.firmware]);
const statusInfo = entry => entry.status === 'archived' ? ['archived','Архивный проект'] : entry.status === 'inactive' ? ['inactive','Нет активности¹'] : isRecent(entry) ? ['recent','Обновлён недавно'] : ['listed','В каталоге'];
function art(entry) {
  const image = enrichment.images[entry.id] || enrichment.images[imageKey(entry.title)];
  if (image?.path) return `<img src="${safeUrl(new URL(image.path,location.href))}" alt="" loading="lazy" decoding="async" class="game-art">`;
  const cover = covers.find(([pattern]) => pattern.test(entry.title))?.[1];
  if (cover) return `<img src="./assets/${cover}.jpg" alt="" loading="lazy" decoding="async">`;
  const index = [...entry.id].reduce((a,b) => a + b.charCodeAt(0),0) % palettes.length;
  return `<div class="cover-placeholder" style="--cover-bg:${palettes[index][0]};--cover-ink:${palettes[index][1]}"><small>${entry.kind === 'emulator' ? 'EMULATION / NINTENDO SWITCH' : 'HOMEBREW / NINTENDO SWITCH'}</small><strong>${escape(entry.title)}</strong></div>`;
}
function card(entry) {
  const [status, statusLabel] = statusInfo(entry), saved = favorites.has(entry.id);
  return `<article class="card">
    <button class="card-cover" data-detail="${entry.id}" aria-label="Подробнее: ${escape(entry.title)}">${art(entry)}<span class="cover-platform">${escape(platform(entry))}</span></button>
    <button class="favorite-button ${saved ? 'saved' : ''}" data-favorite="${entry.id}" aria-pressed="${saved}" aria-label="${saved ? 'Убрать из избранного' : 'В избранное'}: ${escape(entry.title)}">${saved ? '♥' : '♡'}</button>
    <div class="card-body"><button class="card-title" data-detail="${entry.id}" title="${escape(entry.title)}">${escape(entry.title)}</button>
    <p class="card-author"><span>${escape(author(entry))}</span><b class="stars" title="${entry.stars === null ? 'Нет данных о звёздах GitHub' : 'Звёзды репозитория на GitHub'}">★ ${entry.stars === null ? '—' : entry.stars.toLocaleString('ru-RU')}</b></p>
    <div class="card-meta"><span class="version" title="Версия в источнике: ${escape(entry.version)}">${escape(entry.version || 'Без версии')}</span><time ${entry.updatedAt ? `datetime="${entry.updatedAt}"` : ''}>${entry.updatedAt ? formatDate(entry.updatedAt) : entry.dateLabel === 'nightly' ? 'Nightly-сборки' : 'Нет даты'}</time></div>
    <div class="card-bottom"><span class="status ${status}">${statusLabel}</span><button class="project-button" data-detail="${entry.id}">Подробнее <span>↗</span></button></div></div></article>`;
}
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3000); }
function syncFavorites() { $('#favorite-count').textContent = favorites.size; $('#sidebar-favorite-count').textContent = favorites.size; }
function writeUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set('q',state.q); if (state.category) p.set('platform',state.category); if (state.view !== 'all') p.set('view',state.view); if (state.kind !== 'all') p.set('type',state.kind); if (state.firmware) p.set('fw','21'); if (state.sort !== 'popular') p.set('sort',state.sort);
  history.replaceState(null,'',`${location.pathname}${p.size ? '?' + p : ''}${location.hash}`);
}
function render() {
  if (!catalog) return;
  const q = normalize(state.q);
  filtered = catalog.entries.filter(e => (!q || normalize(`${e.title} ${author(e)} ${e.category} ${labels[e.category] || ''} ${e.system}`).includes(q)) && (!state.category || e.category === state.category) && (state.kind === 'all' || e.kind === state.kind) && (!state.firmware || e.firmware === 'yes') && (state.view === 'all' || (state.view === 'favorites' ? favorites.has(e.id) : isRecent(e))));
  filtered.sort((a,b) => compareProjects(a,b,state.sort));
  const shown = filtered.slice(0,state.limit);
  $('#cards').innerHTML = shown.map(card).join('');
  $('#cards').setAttribute('aria-busy','false');
  $('#empty-state').hidden = filtered.length !== 0;
  $('#empty-description').textContent = state.view === 'favorites' ? 'Сохраняйте проекты кнопкой ♡ на карточке. Избранное хранится в этом браузере.' : 'Попробуйте другое название или измените фильтры.';
  $('#results-count').textContent = `Найдено проектов: ${filtered.length}`;
  $('#shown-count').textContent = filtered.length ? `Показано ${shown.length} из ${filtered.length} проектов` : '';
  $('#load-more').hidden = state.limit >= filtered.length;
  $('#reset').hidden = !state.q && !state.category && state.view === 'all' && state.kind === 'all' && !state.firmware;
  $('#firmware-filter').setAttribute('aria-pressed',state.firmware);
  $('#search').value = state.q; $('#sort').value = state.sort;
  $('#popularity-note').hidden=state.sort!=='popular';
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active',b.dataset.view === state.view); b.setAttribute('aria-pressed',b.dataset.view === state.view); });
  document.querySelectorAll('[data-kind]').forEach(b => { b.classList.toggle('active',b.dataset.kind === state.kind); b.setAttribute('aria-pressed',b.dataset.kind === state.kind); });
  document.querySelectorAll('[data-platform]').forEach(b => { b.classList.toggle('active',b.dataset.platform === state.category); b.setAttribute('aria-pressed',b.dataset.platform === state.category); });
  syncFavorites(); writeUrl();
}
function reset() { Object.assign(state,{q:'',category:'',view:'all',kind:'all',firmware:false,sort:'popular',limit:PAGE_SIZE}); render(); }
function showDialog(content) { trigger = document.activeElement; $('#dialog-content').innerHTML = content; $('#detail-dialog').showModal(); $('#detail-dialog').scrollTop = 0; }
function showDetails(id) {
  const e = catalog.entries.find(e => e.id === id); if (!e) return;
  const [status,label] = statusInfo(e);
  showDialog(`<div class="dialog-cover">${art(e)}</div><div class="dialog-category">${escape(platform(e))} → NINTENDO SWITCH</div><h2 id="dialog-title" class="dialog-title">${escape(e.title)}</h2><p class="dialog-description">${e.kind === 'emulator' ? 'Эмулятор' : 'Порт игры'} от ${escape(author(e))}. Данные и версия приведены по каталогу SwitchPorts. Инструкции по установке и доступные сборки — на странице автора.</p><dl class="detail-grid"><div><dt>ВЕРСИЯ В КАТАЛОГЕ</dt><dd>${escape(e.version || 'Не указана')}</dd></div><div><dt>ДАТА ИЗ ИСТОЧНИКА</dt><dd>${e.updatedAt ? formatDate(e.updatedAt) : escape(e.dateLabel || 'Не указана')}</dd></div><div><dt>СОВМЕСТИМОСТЬ С FW 21+</dt><dd>${firmwareLabel(e)}</dd></div><div><dt>СТАТУС</dt><dd class="status ${status}">${label}</dd></div></dl><div class="dialog-actions">${external(e.url,'Страница проекта','primary-button')}${e.discussion ? external(e.discussion,'Обсуждение') : ''}${e.firmwareUrl ? external(e.firmwareUrl,'Сборка FW 21+') : ''}</div><p class="dialog-note">Для запуска может потребоваться консоль с поддержкой homebrew и файлы вашей копии игры. Наличие в каталоге не гарантирует совместимость с вашей системой. ${e.status === 'inactive' ? '¹ Источник помечает этот проект как неактивный; статус перенесён без независимой проверки.' : ''} Проверено по источнику: ${formatDate(catalog.checkedAt)}.</p>`);
  const image=enrichment.images[e.id] || enrichment.images[imageKey(e.title)];
  if(image) $('#dialog-content .dialog-cover').insertAdjacentHTML('afterend',`<p class="dialog-image-credit">Изображение: ${external(image.sourceUrl,escape(image.source),'')}</p>`);
  $('#dialog-content .detail-grid').insertAdjacentHTML('beforeend',`<div><dt>ПОПУЛЯРНОСТЬ НА GITHUB</dt><dd>★ ${e.stars===null ? 'Нет данных' : e.stars.toLocaleString('ru-RU')+' звёзд'}</dd></div>`);
}
function showInfo() {
  if (!catalog) return;
  const checked = new Intl.DateTimeFormat('ru-RU',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Minsk'}).format(new Date(catalog.checkedAt));
  showDialog(`<div class="dialog-category">ОТКРЫТАЯ БИБЛИОТЕКА HOMEBREW</div><h2 id="dialog-title" class="dialog-title">Как работает каталог</h2><p class="dialog-description">Каждое утро, около <b>07:17 по Минску</b>, GitHub Actions забирает актуальный список robzilla10001/SwitchPorts, проверяет данные и публикует новую версию сайта. Запуск может задержаться на стороне GitHub.</p><p class="dialog-description">Последняя успешная проверка: <b>${checked} (Минск)</b>. В каталоге ${catalog.entries.length} проектов. При ошибке обновления сохраняется предыдущая опубликованная версия.</p><p class="dialog-description">Версии, даты, статус архива и совместимость с FW 21+ взяты из источника. «Обновлён недавно» означает дату за последние 7 дней. Дата синхронизации сайта и дата обновления игры — разные значения. Перед установкой проверьте страницу автора: в ней может быть более свежая сборка.</p><p class="dialog-description">Порты одного названия от разных авторов отображаются отдельно. Избранное сохраняется только в вашем браузере. Обложки иллюстрируют оригинальные игры, внешний вид порта может отличаться.</p><div class="dialog-actions">${external(catalog.source,'Открыть источник','primary-button')}${external('https://github.com/Lonviser/switch-ports/actions','Проверить обновления')}</div><p class="dialog-note">Независимый проект сообщества, не связанный с Nintendo. Мы ссылаемся на страницы разработчиков; необходимые игровые файлы приобретаются отдельно.</p>`);
  $('#dialog-content .dialog-note').insertAdjacentHTML('beforebegin','<p class="dialog-description">По умолчанию проекты отсортированы по числу звёзд их репозиториев на GitHub. Эти данные обновляются ежедневно. Для проектов без доступной статистики показывается «—»; они располагаются после проектов с известным числом звёзд. Обложки и иконки получены со страниц разработчиков, из Wikipedia и Steam.</p>');
}
document.addEventListener('click', event => {
  const favorite = event.target.closest('[data-favorite]');
  if (favorite) { const id = favorite.dataset.favorite; favorites.has(id) ? favorites.delete(id) : favorites.add(id); try { localStorage.setItem('switch-ports:favorites',JSON.stringify([...favorites])); } catch { toast('Хранилище недоступно: избранное сохранится до закрытия страницы.'); } render(); const replacement = document.querySelector(`[data-favorite="${id}"]`); replacement?.focus({preventScroll:true}); return; }
  const detail = event.target.closest('[data-detail]'); if (detail) showDetails(detail.dataset.detail);
  const view = event.target.closest('[data-view]'); if (view) { state.view = view.dataset.view; state.limit = PAGE_SIZE; render(); }
  const kind = event.target.closest('[data-kind]'); if (kind) { state.kind = kind.dataset.kind; state.limit = PAGE_SIZE; render(); }
  const cat = event.target.closest('[data-platform]'); if (cat) { state.category = cat.dataset.platform; state.limit = PAGE_SIZE; render(); }
});
$('#search').addEventListener('input',event => { state.q = event.target.value; state.limit = PAGE_SIZE; render(); });
$('#sort').addEventListener('change',event => { state.sort = event.target.value; render(); });
$('#firmware-filter').addEventListener('click',() => { state.firmware = !state.firmware; state.limit = PAGE_SIZE; render(); });
$('#reset').addEventListener('click',reset); $('#empty-reset').addEventListener('click',reset);
$('#load-more').addEventListener('click',() => { const firstNewId = filtered[state.limit]?.id; state.limit += PAGE_SIZE; render(); if(firstNewId) document.querySelector(`[data-detail="${firstNewId}"]`)?.focus({preventScroll:true}); });
$('#nav-favorites').addEventListener('click',() => { Object.assign(state,{view:'favorites',q:'',category:'',kind:'all',firmware:false,limit:PAGE_SIZE}); render(); $('#catalog').scrollIntoView({behavior:'smooth'}); });
$('#nav-updates').addEventListener('click',() => { Object.assign(state,{view:'recent',q:'',category:'',kind:'all',firmware:false,limit:PAGE_SIZE}); render(); $('#catalog').scrollIntoView({behavior:'smooth'}); });
$('#about-button').addEventListener('click',showInfo); $('#sync-info').addEventListener('click',showInfo);
$('.dialog-close').addEventListener('click',() => $('#detail-dialog').close());
$('#detail-dialog').addEventListener('click',event => { const r = $('#detail-dialog').getBoundingClientRect(); if (event.target === $('#detail-dialog') && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) $('#detail-dialog').close(); });
$('#detail-dialog').addEventListener('close',() => trigger?.isConnected && trigger.focus({preventScroll:true}));
document.addEventListener('keydown',event => { if(event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !$('#detail-dialog').open) { event.preventDefault(); $('#search').focus(); } });
window.addEventListener('storage',event => { if(event.key === 'switch-ports:favorites') { try { favorites = new Set(JSON.parse(event.newValue || '[]')); render(); } catch {} } });
syncFavorites();
try {
  const response = await fetch('./data/catalog.json', { cache:'no-cache', signal:AbortSignal.timeout(20000) });
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  catalog = await response.json();
  if(!Array.isArray(catalog.entries) || !catalog.entries.length) throw new Error('Empty catalogue');
  try {
    const extra=await fetch('./data/enrichment.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});
    if(extra.ok) enrichment=await extra.json();
  } catch { /* The main catalogue remains available if artwork metadata fails to load. */ }
  for(const entry of catalog.entries) entry.stars=enrichment.repositories[repositoryKey(entry.url)]?.stars ?? null;
  const categories = [...new Set(catalog.entries.map(e => e.category))];
  if (state.category && !categories.includes(state.category)) state.category = '';
  $('#platforms').innerHTML = `<button data-platform="" class="active"><span>Все платформы</span><span>${categories.length}</span></button>` + categories.map(c => `<button data-platform="${escape(c)}"><span>${escape(labels[c] || c)}</span><span>${catalog.entries.filter(e => e.category === c).length}</span></button>`).join('');
  $('#total-stat').textContent = catalog.entries.length; $('#all-count').textContent = catalog.entries.length;
  $('#platform-stat').textContent = categories.length; $('#week-stat').textContent = catalog.entries.filter(isRecent).length;
  const stale = Date.now() - new Date(catalog.checkedAt) > 36 * 3600000;
  $('#sync-label').textContent = stale ? 'Данные требуют обновления' : 'Каталог обновляется каждый день';
  $('#sync-date').textContent = `Проверено ${new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Minsk'}).format(new Date(catalog.checkedAt))} · Минск`;
  render();
} catch(error) {
  $('#cards').innerHTML = ''; $('#cards').setAttribute('aria-busy','false'); $('#empty-state').hidden = false;
  $('#empty-state h3').textContent = 'Не удалось загрузить каталог'; $('#empty-description').textContent = 'Проверьте подключение и повторите загрузку. Полный список также доступен в источнике на GitHub.';
  $('#empty-reset').textContent = 'Повторить загрузку ↻'; $('#empty-reset').addEventListener('click',() => location.reload());
  $('#results-count').textContent = 'Каталог временно недоступен'; $('#sync-label').textContent = 'Не удалось проверить данные';
  console.error('Catalogue loading failed:',error.message);
}
