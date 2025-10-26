
// Walk Journal - Consolidated JS (Phases 1–3)

let db;
let currentWalk = null;
const request = indexedDB.open("WalkJournalDB", 9);

request.onupgradeneeded = e => {
  db = e.target.result;
  if(!db.objectStoreNames.contains("walks")){
    db.createObjectStore("walks", { keyPath: "id" });
  }
};

request.onsuccess = e => {
  db = e.target.result;
  init();
};

const DEFAULT_SECTION_TITLES = ["Ambient","Frozen","ISB","FOTM","Fridge","General"];
const DEFAULT_QUESTIONS = ["Findings","Reasoning","Solution"];
const TEMPLATE_SETS = {
  "Standard Walk": DEFAULT_SECTION_TITLES,
  "Quick Check": ["Ambient","General"]
};

function init(){
  const dateInput = document.getElementById('walkDate');
  dateInput.value = new Date().toISOString().slice(0,10);

  loadHistory();
  document.getElementById('walkForm').addEventListener('submit', saveWalk);
  document.getElementById('addSection').addEventListener('click', ()=>addSection());
  document.getElementById('viewHistoryBtn').addEventListener('click', ()=>document.getElementById('historyViewer').style.display='flex');
  document.getElementById('closeHistoryBtn').addEventListener('click', ()=>document.getElementById('historyViewer').style.display='none');
  document.getElementById('closeSectionViewer').addEventListener('click', ()=>document.getElementById('sectionViewer').style.display='none');
  document.getElementById('closeSummaryBtn').onclick = ()=>document.getElementById('summaryViewer').style.display='none';

  const searchInput = document.getElementById('historySearch');
  searchInput?.addEventListener('input', loadHistory);

  loadAutosave();
  populateTemplateSelect();
  populateDefaultSectionsInForm();
  document.getElementById('sectionsContainer').addEventListener('input', autosave);

  document.getElementById('copyEntryBtn')?.addEventListener('click', copyCurrentEntry);
  document.getElementById('restoreInput')?.addEventListener('change', e=>restoreBackup(e.target.files[0]));
}

function populateTemplateSelect(){
  const select = document.getElementById('templateSelect');
  if(!select) return;
  select.innerHTML='<option value="">Select Template</option>';
  Object.keys(TEMPLATE_SETS).forEach(name=>{
    const opt=document.createElement('option');
    opt.value=name;
    opt.textContent=name;
    select.appendChild(opt);
  });
  select.addEventListener('change', ()=>{
    const val = select.value;
    if(val && TEMPLATE_SETS[val]) populateSectionsFromTemplate(TEMPLATE_SETS[val]);
  });
}

function populateSectionsFromTemplate(sectionTitles){
  const container = document.getElementById('sectionsContainer');
  container.innerHTML='';
  sectionTitles.forEach(title=>{
    const sectionDiv = document.createElement('div');
    sectionDiv.className='section';
    const h3 = document.createElement('h3');
    h3.textContent=title;
    sectionDiv.appendChild(h3);
    DEFAULT_QUESTIONS.forEach(q=>{
      const ta=document.createElement('textarea');
      ta.placeholder=q;
      ta.rows=3;
      sectionDiv.appendChild(ta);
    });
    const addQBtn = document.createElement('button');
    addQBtn.type='button';
    addQBtn.textContent='Add Question';
    addQBtn.onclick=()=>{
      const newQ=document.createElement('textarea');
      newQ.placeholder='New question';
      newQ.rows=3;
      sectionDiv.insertBefore(newQ, addQBtn);
    };
    sectionDiv.appendChild(addQBtn);
    container.appendChild(sectionDiv);
  });
  autosave();
}

function populateDefaultSectionsInForm(){
  populateSectionsFromTemplate(DEFAULT_SECTION_TITLES);
}

function addSection(){
  const container=document.getElementById('sectionsContainer');
  const sectionDiv=document.createElement('div');
  sectionDiv.className='section';
  const h3=document.createElement('h3'); h3.textContent='New Section';
  sectionDiv.appendChild(h3);
  const ta=document.createElement('textarea'); ta.placeholder='New Question'; ta.rows=3;
  sectionDiv.appendChild(ta);
  container.appendChild(sectionDiv);
  autosave();
}

function autosave(){
  const sections=Array.from(document.querySelectorAll('.section')).map(section=>{
    const title=section.querySelector('h3').textContent;
    const answers=Array.from(section.querySelectorAll('textarea')).map(input=>({question: input.placeholder, answer: input.value}));
    return {title, answers};
  });
  const date=document.getElementById('walkDate').value || new Date().toISOString().slice(0,10);
  const tags=document.getElementById('tagsInput')?.value||'';
  localStorage.setItem('autosaveWalk', JSON.stringify({date, sections, tags}));
}

function loadAutosave(){
  const saved=localStorage.getItem('autosaveWalk');
  if(!saved) return;
  const data=JSON.parse(saved);
  document.getElementById('walkDate').value=data.date||new Date().toISOString().slice(0,10);
  if(document.getElementById('tagsInput')) document.getElementById('tagsInput').value=data.tags||'';
  if(data.sections) {
    populateSectionsFromTemplate(data.sections.map(s=>s.title));
    data.sections.forEach((sec,idx)=>{
      const secDiv=document.querySelectorAll('.section')[idx];
      sec.answers.forEach((a,aIdx)=>{
        const ta=secDiv.querySelectorAll('textarea')[aIdx];
        if(ta) ta.value=a.answer;
      });
    });
  }
}

function saveWalk(e){
  e.preventDefault();
  const date=document.getElementById('walkDate').value||new Date().toISOString().slice(0,10);
  const sections=Array.from(document.querySelectorAll('.section')).map(section=>{
    const title=section.querySelector('h3').textContent;
    const answers=Array.from(section.querySelectorAll('textarea')).map(input=>({question: input.placeholder, answer: input.value}));
    return {title, answers};
  });
  const tags=document.getElementById('tagsInput')?.value||'';
  const walk={id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), date, timestamp:new Date().toISOString(), sections, tags};
  const tx=db.transaction('walks','readwrite');
  tx.objectStore('walks').add(walk);
  tx.oncomplete=()=>{ loadHistory(); document.getElementById('walkForm').reset(); populateDefaultSectionsInForm(); localStorage.removeItem('autosaveWalk'); };
}

function loadHistory(){
  const container=document.getElementById('history');
  container.innerHTML='';
  const tx=db.transaction('walks','readonly');
  const store=tx.objectStore('walks');
  store.getAll().onsuccess=e=>{
    let entries=e.target.result||[];
    const searchTerm=document.getElementById('historySearch')?.value?.toLowerCase()||'';
    entries=entries.filter(entry=>{
      if(!searchTerm) return true;
      return entry.sections.some(sec=>sec.title.toLowerCase().includes(searchTerm) || sec.answers.some(a=>a.question.toLowerCase().includes(searchTerm)||a.answer.toLowerCase().includes(searchTerm))) || (entry.tags&&entry.tags.toLowerCase().includes(searchTerm));
    });
    entries.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
    const grouped={};
    entries.forEach(entry=>{
      const date=new Date(entry.date);
      const year=date.getFullYear();
      const week=getWeekNumber(date);
      const weekday=date.toLocaleDateString('en-GB',{weekday:'long'});
      const dayLabel=`${weekday} (${date.toLocaleDateString('en-GB')})`;
      const key=`${year}-W${week}`;
      if(!grouped[key]) grouped[key]={};
      if(!grouped[key][dayLabel]) grouped[key][dayLabel]=[];
      grouped[key][dayLabel].push(entry);
    });
    for(const weekKey of Object.keys(grouped).sort().reverse()){
      const weekDiv=document.createElement('div'); weekDiv.className='week-block'; weekDiv.innerHTML=`<h3>Week ${weekKey}</h3>`;
      const days=grouped[weekKey];
      for(const dayKey of Object.keys(days)){
        const dayDiv=document.createElement('div'); dayDiv.className='day-block'; dayDiv.innerHTML=`<h4>${dayKey}</h4>`;
        const ul=document.createElement('ul');
        days[dayKey].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).forEach(entry=>{
          const li=document.createElement('li');
          const time=new Date(entry.timestamp).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
          li.textContent=`${time} — ${entry.tags ? `[${entry.tags}] ` : ''}Walk Entry`;
          li.style.cursor='pointer';
          li.onclick=()=>showWalkSections(entry);
          ul.appendChild(li);
        });
        dayDiv.appendChild(ul);
        weekDiv.appendChild(dayDiv);
      }
      container.appendChild(weekDiv);
    }
  };
}

function getWeekNumber(date){
  const temp=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const dayNum=temp.getUTCDay()||7;
  temp.setUTCDate(temp.getUTCDate()+4-dayNum);
  const yearStart=new Date(Date.UTC(temp.getUTCFullYear(),0,1));
  return Math.ceil(((temp-yearStart)/86400000+1)/7);
}

function showWalkSections(walk){
  currentWalk=walk;
  const container=document.getElementById('sectionContainer');
  container.innerHTML='';
  walk.sections.forEach(sec=>{
    const card=document.createElement('div'); card.className=`section-card ${sec.title.replace(/\s+/g,'')}`;
    const header=document.createElement('h3'); header.textContent=sec.title;
    card.appendChild(header);
    const content=document.createElement('div'); content.className='section-content';
    sec.answers.forEach(a=>{
      const label=document.createElement('label'); label.textContent=a.question;
      const ta=document.createElement('textarea'); ta.value=a.answer; ta.rows=3; ta.readOnly=true;
      content.appendChild(label); content.appendChild(ta);
    });
    card.appendChild(content);
    header.onclick=()=>content.classList.toggle('collapsed');
    container.appendChild(card);
  });
  document.getElementById('sectionViewer').style.display='flex';
}

function copyCurrentEntry(){
  if(!currentWalk) return;
  let text=`Walk Date: ${currentWalk.date}
Tags: ${currentWalk.tags||''}

`;
  currentWalk.sections.forEach(sec=>{
    text+=`Section: ${sec.title}
`;
    sec.answers.forEach(a=>{ text+=`${a.question}: ${a.answer}
`; });
    text+='
';
  });
  navigator.clipboard.writeText(text).then(()=>alert('Entry copied to clipboard!'));
}

function backupAll(){
  const tx=db.transaction('walks','readonly');
  const store=tx.objectStore('walks');
  store.getAll().onsuccess=e=>{
    const data=JSON.stringify(e.target.result,null,2);
    const blob=new Blob([data],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='walk_journal_backup.json'; a.click(); URL.revokeObjectURL(url);
  };
}

function restoreBackup(file){
  const reader=new FileReader();
  reader.onload=e=>{
    const walks=JSON.parse(e.target.result);
    const tx=db.transaction('walks','readwrite');
    const store=tx.objectStore('walks');
    walks.forEach(walk=>store.put(walk));
    tx.oncomplete=loadHistory;
  };
  reader.readAsText(file);
}
