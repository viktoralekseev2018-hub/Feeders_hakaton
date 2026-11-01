const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const agentNames = {savinykh:'Виктор Савиных',dzhanibekov:'Владимир Джанибеков',ryazansky:'Сергей Рязанский',krikalev:'Сергей Крикалёв'};
const behaviors = {helpful:['Помощник','Выполняет просьбы и меняет окружение.'],patrol:['Патруль','Обходит пост и реагирует на обращения.'],guard:['Охрана','Следит за постом; создание предметов ограничено.'],passive:['Наблюдатель','Остаётся на месте и не изменяет мир.']};
const kinds = {door:'Дверь',crate:'Контейнер',plant:'Растение',beacon:'Маяк'};
const finite = value => Number.isFinite(value) ? value : null;
const metric = (value,suffix='') => finite(value) === null ? '—' : Math.round(value).toLocaleString('ru-RU') + suffix;

/** Room-scoped world controls. Identity, permissions and mutations are checked by the server. */
export class UniversePanel {
  constructor({network,ship,room,user,toast}) {
    Object.assign(this,{network,ship,room,user,toast});
    this.state=null;this.metrics=null;this.tab='objects';this.busy=false;this.roomKey='';this.requestGeneration=0;
    this.dialog=document.createElement('dialog');
    this.dialog.className='universe-dialog';this.dialog.id='universe-dialog';
    this.dialog.setAttribute('aria-labelledby','universe-title');
    document.body.append(this.dialog);
    this.dialog.addEventListener('close',()=>{clearInterval(this.pollTimer);this.pollTimer=null;});
    this.dialog.addEventListener('click',event=>{if(event.target===this.dialog){const b=this.dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)this.dialog.close();}});
    this.button=document.createElement('button');this.button.id='universe-button';this.button.className='secondary small universe-launch';this.button.type='button';this.button.hidden=true;this.button.onclick=()=>this.open();
    document.querySelector('.header-actions')?.prepend(this.button);
    this.unsubscribers=[network.on('universe.state',state=>this.setState(state)),network.on('telemetry.state',state=>this.setMetrics(state)),network.on('status',status=>{if(status!=='online'){this.metrics=null;this.renderMetrics();}})];
  }
  get isAdmin(){return Boolean(this.room()?.owner&&this.room().owner===this.user()?.id);}
  async onRoom(force=false){
    const key=this.room()?.code ? this.room().code+':'+this.room().generation : '';
    this.button.hidden=!key;this.button.textContent=this.isAdmin?'⚙ Администратор':'◇ Живой мир';
    this.button.setAttribute('aria-label',this.isAdmin?'Открыть панель администратора':'Открыть живой мир');
    this.button.title=this.isAdmin?'Вселенная, агенты и метрики клиентов':'Предметы и команды агентам';
    const changed=key!==this.roomKey;
    if(changed){this.requestGeneration++;this.roomKey=key;this.state=null;this.metrics=null;this.ship()?.setUniverse?.(null,this.user()?.id);if(this.dialog.open)this.dialog.close();}
    if(!key)return;
    if(!this.isAdmin){this.metrics=null;if(this.tab!=='objects')this.tab='objects';}
    let loaded=false;
    if((force||!this.state)&&this.network.ready){const generation=this.requestGeneration;try{const state=await this.network.request('universe.get');if(generation===this.requestGeneration)loaded=this.setState(state);}catch(error){if(this.dialog.open&&generation===this.requestGeneration)this.showStatus(error.message,true);}}
    if(this.dialog.open&&(loaded||changed||this.renderedAdmin!==this.isAdmin))this.render();
  }
  matchesRoom(payload){
    const room=this.room();
    return Boolean(room?.code&&this.roomKey===room.code+':'+room.generation&&payload?.room_code===room.code&&payload.generation===room.generation);
  }
  setState(state){
    if(!this.matchesRoom(state)||!state?.settings)return false;
    if(this.state&&state.version<this.state.version)return false;
    this.state=state;this.ship()?.setUniverse?.(state,this.user()?.id);
    if(this.dialog.open){this.renderSummary();if(this.tab==='objects')this.renderObjects();if(this.tab==='agents')this.renderAgents();}
    return true;
  }
  setMetrics(state){
    if(!this.isAdmin||!this.matchesRoom(state))return false;
    this.metrics=state;this.renderMetrics();return true;
  }
  async open(){
    if(!this.room()?.code){this.toast('Сначала создайте экспедицию или присоединитесь по коду.');return;}
    this.ship()?.controls?.unlock?.();
    this.render();if(!this.dialog.open)this.dialog.showModal();
    await this.onRoom();
    clearInterval(this.pollTimer);this.pollTimer=setInterval(()=>{if(this.dialog.open&&this.tab==='metrics')this.fetchMetrics();},3000);
    if(this.tab==='metrics')this.fetchMetrics();
  }
  close(){this.dialog.close();}
  render(){
    const admin=this.isAdmin;
    this.renderedAdmin=admin;
    this.dialog.innerHTML=`<div class="universe-top"><div><span class="eyebrow">HORIZON–7 / ${admin?'WORLD CONTROL':'LIVING WORLD'}</span><h2 id="universe-title">${admin?'Панель администратора':'Живой мир'}</h2><p>${admin?'Настройте вселенную вашей экспедиции. Изменения видны всему экипажу.':'Перемещайте предметы и поручайте наставникам менять окружение.'}</p></div><button type="button" class="icon-button universe-close" aria-label="Закрыть панель">×</button></div><div class="universe-summary" id="universe-summary"></div><nav class="universe-tabs" aria-label="Разделы управления">${[['objects','◇','Предметы'],...(admin?[['settings','☀','Вселенная'],['agents','♧','Агенты'],['metrics','⌁','Клиенты']]:[])].map(([id,icon,label])=>`<button type="button" data-universe-tab="${id}" aria-pressed="${this.tab===id}"><span aria-hidden="true">${icon}</span> ${label}</button>`).join('')}</nav><div class="universe-body" id="universe-body"></div><p class="universe-feedback" id="universe-feedback" role="status" aria-live="polite"></p><div class="universe-footer"><span><i class="dot"></i> ${admin?'Права владельца экспедиции':'Общее окружение экспедиции'}</span><span id="universe-version"></span></div>`;
    this.dialog.querySelector('.universe-close').onclick=()=>this.close();
    this.dialog.querySelectorAll('[data-universe-tab]').forEach(button=>button.onclick=()=>{this.tab=button.dataset.universeTab;this.render();if(this.tab==='metrics')this.fetchMetrics();});
    this.renderSummary();
    if(!this.state){this.body.innerHTML='<div class="universe-empty">Подключаемся к вселенной…</div>';return;}
    if(this.tab==='settings')this.renderSettings();else if(this.tab==='agents')this.renderAgents();else if(this.tab==='metrics')this.renderMetrics();else this.renderObjects(true);
  }
  get body(){return this.dialog.querySelector('#universe-body');}
  renderSummary(){
    const el=this.dialog.querySelector('#universe-summary');if(!el)return;
    const settings=this.state?.settings;
    el.innerHTML=[['Объекты',this.state?.objects?.length??'—'],['NPC',settings?.npc_count??'—'],['Наставники',this.state?.agents?.length??4],['Экспедиция',this.room()?.code??'—']].map(([name,value])=>`<div><span>${name}</span><strong>${escapeHTML(value)}</strong></div>`).join('');
    this.dialog.querySelector('#universe-version').textContent=this.state?'Состояние · '+this.state.version:'';
  }
  renderObjects(full=false){
    if(this.tab!=='objects'||!this.body||!this.state)return;
    if(full||!this.body.querySelector('#universe-object-list')){
      this.body.innerHTML=`<section class="universe-command"><div class="universe-section-heading"><h3>Попросите изменить мир</h3><span class="universe-chip">Команды без LLM</span></div><p>Агент создаёт окружение для всей команды. Его поведение задаёт администратор.</p><form id="universe-command-form"><label class="sr-only" for="universe-command-agent">Наставник</label><select id="universe-command-agent">${Object.entries(agentNames).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select><label class="sr-only" for="universe-command-text">Просьба к агенту</label><input id="universe-command-text" maxlength="300" placeholder="Например: добавь растения" required><button class="primary" type="submit">Выполнить ↗</button></form><div class="universe-examples">${['Добавь растения','Добавь ящики','Открой двери','Включи аварийное освещение'].map(text=>`<button type="button" data-world-example="${text}">${text}</button>`).join('')}</div></section><div class="universe-section-heading"><h3>Предметы на палубе</h3><span class="universe-muted">Подойдите ближе · E — взаимодействовать</span></div><p class="universe-note">Найдите предмет в 3D, перейдите в «Исследовать» и подойдите к нему. Контейнер можно взять и положить рядом с собой; дверь — открыть и закрыть.</p><div class="universe-object-list" id="universe-object-list"></div><p id="universe-event" class="universe-event"></p>`;
      this.body.querySelector('#universe-command-form').onsubmit=event=>{event.preventDefault();this.command();};
      this.body.querySelectorAll('[data-world-example]').forEach(button=>button.onclick=()=>{this.body.querySelector('#universe-command-text').value=button.dataset.worldExample;this.body.querySelector('#universe-command-text').focus();});
    }
    const me=this.user()?.id;
    this.body.querySelector('#universe-object-list').innerHTML=(this.state.objects||[]).map(object=>{
      const mine=object.held_by===me,held=Boolean(object.held_by),interactive=['door','crate'].includes(object.kind);
      const action=object.kind==='door'?'toggle':mine?'drop':'pickup';
      const label=object.kind==='door'?(object.open?'Закрыть':'Открыть'):mine?'Положить':'Взять';
      const status=held?(mine?'У вас в руках':'У другого участника'):object.kind==='door'?(object.open?'Открыта':'Закрыта'):'На палубе';
      return `<article class="universe-object"><div class="universe-object-icon" aria-hidden="true">${({door:'▥',crate:'▣',plant:'♧',beacon:'◉'})[object.kind]||'◇'}</div><div class="universe-object-copy"><strong>${escapeHTML(object.name||kinds[object.kind]||'Объект')}</strong><span>${escapeHTML(status)} · ${Number(object.x).toFixed(1)}, ${Number(object.z).toFixed(1)}</span></div><div class="universe-object-actions"><button type="button" class="secondary small" data-world-focus="${escapeHTML(object.id)}">Найти</button>${interactive?`<button type="button" class="secondary small" data-world-action="${action}" data-object-id="${escapeHTML(object.id)}" ${held&&!mine?'disabled':''}>${label}</button>`:''}${this.isAdmin?`<button type="button" class="universe-delete" data-world-remove="${escapeHTML(object.id)}" aria-label="Удалить ${escapeHTML(object.name||kinds[object.kind])}" ${held?'disabled':''}>×</button>`:''}</div></article>`;
    }).join('')||'<div class="universe-empty">Палуба свободна. Попросите наставника добавить объекты.</div>';
    this.body.querySelectorAll('[data-world-focus]').forEach(button=>button.onclick=()=>{this.close();this.ship()?.focusWorldObject?.(button.dataset.worldFocus);});
    this.body.querySelectorAll('[data-world-action]').forEach(button=>button.onclick=()=>this.interact({object_id:button.dataset.objectId,action:button.dataset.worldAction}));
    this.body.querySelectorAll('[data-world-remove]').forEach(button=>button.onclick=()=>this.mutate('universe.admin',{remove_id:button.dataset.worldRemove},'Объект удалён.'));
    this.body.querySelector('#universe-event').textContent=this.state.last_event?.text||'';
  }
  renderSettings(){
    if(!this.isAdmin||!this.state)return;
    const s=this.state.settings,expectedVersion=this.state.version;
    this.body.innerHTML=`<form id="universe-settings-form"><div class="universe-section-heading"><h3>Атмосфера и жизнь на борту</h3><span class="universe-chip">Общее состояние</span></div><div class="universe-settings-grid"><label>Цвет освещения<span class="universe-color"><input id="world-color" type="color" value="${escapeHTML(s.ambient_color)}"><span>${escapeHTML(s.ambient_color)}</span></span></label><label>Яркость <output id="world-light-value">${s.light_intensity}×</output><input id="world-light" type="range" min="0.2" max="2" step="0.1" value="${s.light_intensity}"><small>От приглушённого до рабочего света</small></label><label>Число простых NPC <output id="world-npc-value">${s.npc_count}</output><input id="world-npc" type="range" min="0" max="160" step="1" value="${s.npc_count}"><small>Жители палубы, отдельные от четырёх наставников</small></label><label>Скорость анимаций <output id="world-speed-value">${s.simulation_speed}×</output><input id="world-speed" type="range" min="0" max="2" step="0.1" value="${s.simulation_speed}"><small>0 — пауза · 1 — обычная скорость</small></label></div><button type="submit" class="primary">Применить настройки ↗</button></form><section class="universe-spawn"><div class="universe-section-heading"><h3>Добавить объект</h3><span class="universe-muted">На выбранной палубе</span></div><form id="universe-spawn-form"><label>Тип<select id="world-spawn-kind">${Object.entries(kinds).map(([kind,name])=>`<option value="${kind}">${name}</option>`).join('')}</select></label><label>Отсек<select id="world-spawn-room"><option value="bridge">Мостик</option><option value="cryo">Криоотсек</option><option value="reactor">Реактор</option><option value="bio">Оранжерея</option></select></label><button type="submit" class="secondary">＋ Добавить</button></form><p class="universe-note">Двери открываются, контейнеры переносятся, растения и маяки дополняют окружение.</p></section>`;
    for(const [id,suffix] of [['light','×'],['npc',''],['speed','×']])this.body.querySelector('#world-'+id).oninput=event=>this.body.querySelector('#world-'+id+'-value').textContent=event.target.value+suffix;
    this.body.querySelector('#world-color').oninput=event=>event.target.nextElementSibling.textContent=event.target.value;
    this.body.querySelector('#universe-settings-form').onsubmit=event=>{event.preventDefault();const val=id=>this.body.querySelector('#world-'+id).value;this.mutate('universe.admin',{expected_version:expectedVersion,settings:{ambient_color:val('color'),light_intensity:Number(val('light')),npc_count:Number(val('npc')),simulation_speed:Number(val('speed'))}},'Настройки вселенной сохранены.');};
    this.body.querySelector('#universe-spawn-form').onsubmit=event=>{event.preventDefault();const positions={bridge:[2,1],cryo:[-14,1],reactor:[14,1],bio:[1,-15]};const [x,z]=positions[this.body.querySelector('#world-spawn-room').value];this.mutate('universe.admin',{spawn:{kind:this.body.querySelector('#world-spawn-kind').value,x,y:0,z}},'Объект добавлен на палубу.');};
  }
  renderAgents(){
    if(!this.isAdmin||!this.state||this.tab!=='agents')return;
    this.body.innerHTML=`<div class="universe-section-heading"><h3>Поведение наставников</h3><span class="universe-chip">4 агента</span></div><p class="universe-note">Изменение применяется к персонажу в 3D и его возможности выполнять команды, меняющие окружение.</p><div class="universe-agents">${(this.state.agents||[]).map((agent,index)=>`<article class="universe-agent"><div class="universe-agent-heading"><span class="universe-avatar">0${index+1}</span><div><strong>${escapeHTML(agentNames[agent.id]||agent.id)}</strong><span>${escapeHTML(behaviors[agent.behavior]?.[1]||'')}</span></div></div><label class="sr-only" for="behavior-${escapeHTML(agent.id)}">Поведение ${escapeHTML(agentNames[agent.id])}</label><select id="behavior-${escapeHTML(agent.id)}" data-world-behavior="${escapeHTML(agent.id)}">${Object.entries(behaviors).map(([id,[name]])=>`<option value="${id}" ${agent.behavior===id?'selected':''}>${name}</option>`).join('')}</select></article>`).join('')}</div><div class="universe-note universe-callout">Массовые NPC не используют диалоги наставников. Они двигаются по палубе, замечают приближение и поворачиваются на разговор.</div>`;
    this.body.querySelectorAll('[data-world-behavior]').forEach(select=>select.onchange=()=>this.mutate('universe.admin',{agent:{id:select.dataset.worldBehavior,behavior:select.value}},'Поведение персонажа изменено.'));
  }
  async fetchMetrics(){
    if(!this.isAdmin||this.fetchingMetrics||!this.network.ready||!this.dialog.open)return;
    this.fetchingMetrics=true;const generation=this.requestGeneration;
    try{const state=await this.network.request('telemetry.get');if(generation===this.requestGeneration)this.setMetrics(state);}catch(error){if(generation===this.requestGeneration)this.showStatus(error.message,true);}finally{this.fetchingMetrics=false;}
  }
  renderMetrics(){
    if(this.tab!=='metrics'||!this.dialog.open||!this.body)return;
    const clients=this.metrics?.clients||[],active=clients.filter(c=>c.online),valid=active.filter(c=>!c.stale&&!c.hidden&&finite(c.fps)!==null);
    const avg=valid.length?Math.round(valid.reduce((n,c)=>n+c.fps,0)/valid.length):null;
    this.body.innerHTML=`<div class="universe-section-heading"><h3>Подключённые клиенты</h3><button type="button" id="world-metrics-refresh" class="secondary small">↻ Обновить</button></div><div class="universe-metric-cards"><div><span>На связи</span><strong>${active.length}</strong></div><div><span>Средний FPS активных</span><strong>${metric(avg)}</strong></div><div><span>Свежие замеры</span><strong>${valid.length} <small>/ ${active.length}</small></strong></div></div><p class="universe-note">FPS измеряется в каждом браузере, ping — время обмена с сервером. Скрытая вкладка и устаревшие данные помечены отдельно. Обновление каждые 3 секунды.</p><div class="universe-table-wrap"><table class="universe-table"><thead><tr><th>Участник</th><th>FPS</th><th>Ping</th><th>Кадр</th><th>Рендер</th><th>Детали</th></tr></thead><tbody>${clients.map(c=>`<tr class="${c.stale||!c.online?'universe-stale':''}"><td><strong>${escapeHTML(c.name)}</strong><span>${!c.online?'Не в сети':c.hidden?'Вкладка скрыта':c.stale?'Ожидаем свежий замер':'На связи'}${c.updated_at?' · '+escapeHTML(this.metricAge(c.updated_at)):''}</span></td><td class="${!c.stale&&c.online&&finite(c.fps)!==null&&c.fps<24?'universe-warning':''}">${metric(c.fps)}</td><td>${metric(c.ping_ms,' мс')}</td><td>${metric(c.frame_ms,' мс')}</td><td>${escapeHTML(c.renderer||'—')}</td><td><span>${metric(c.draw_calls)} вызовов</span><span>${metric(c.triangles)} треугольников</span></td></tr>`).join('')||`<tr><td colspan="6">${this.metrics?'Подключённых клиентов пока нет.':'Получаем замеры клиентов…'}</td></tr>`}</tbody></table></div>`;
    this.body.querySelector('#world-metrics-refresh').onclick=()=>this.fetchMetrics();
  }
  metricAge(value){const time=typeof value==='number'?(value<1e12?value*1000:value):Date.parse(value);if(!Number.isFinite(time))return '';return Math.max(0,Math.floor((Date.now()-time)/1000))+' с назад';}
  async command(){
    const input=this.body.querySelector('#universe-command-text'),agent=this.body.querySelector('#universe-command-agent');
    const text=input.value.trim();if(!text)return;
    const result=await this.mutate('universe.command',{agent_id:agent.value,text});
    if(result){input.value='';this.ship()?.reactToSpeech?.();}
  }
  async interact(payload){return this.mutate('universe.interact',payload);}
  async mutate(type,payload,success){
    if(this.busy||!this.state)return null;
    this.busy=true;this.dialog.setAttribute('aria-busy','true');
    const generation=this.requestGeneration;
    this.showStatus('Выполняем команду…');
    try{
      const result=await this.network.request(type,{expected_version:this.state.version,...payload});
      if(generation!==this.requestGeneration)return null;
      if(result?.settings){if(!this.matchesRoom(result))return null;this.setState(result);}
      if(payload.settings&&this.dialog.open&&this.tab==='settings')this.renderSettings();
      const message=result?.message||success||'Состояние мира обновлено.';
      this.showStatus(message);if(!this.dialog.open)this.toast(message);
      return result;
    }catch(error){
      if(generation!==this.requestGeneration)return null;
      const settingsConflict=Boolean(payload.settings&&error.code==='stale_version');
      let refreshed=false;
      // Refresh after a stale version or a rejected move; never replay a mutation.
      if(this.network.ready)try{const state=await this.network.request('universe.get');if(generation===this.requestGeneration)refreshed=this.setState(state);}catch{}
      if(generation!==this.requestGeneration)return null;
      if(settingsConflict&&refreshed&&this.dialog.open&&this.tab==='settings')this.renderSettings();
      const message=settingsConflict?(refreshed?'Мир изменился, пока вы редактировали настройки. Показаны актуальные значения — задайте ваши изменения ещё раз.':'Мир изменился. Не удалось загрузить новые значения; откройте панель заново перед повтором.'):error.message;
      this.showStatus(message,true);if(!this.dialog.open)this.toast(message);
      return null;
    }finally{this.busy=false;this.dialog.removeAttribute('aria-busy');}
  }
  showStatus(message,error=false){const el=this.dialog.querySelector('#universe-feedback');if(el){el.textContent=message;el.classList.toggle('error',error);}}
  dispose(){clearInterval(this.pollTimer);this.unsubscribers.forEach(unsubscribe=>unsubscribe());this.dialog.remove();this.button.remove();}
}
