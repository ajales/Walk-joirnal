let db;
const request = indexedDB.open("WalkJournalDB", 2);

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
const TEMPLATE_SETS = { "Standard Walk": DEFAULT_SECTION_TITLES, "Quick Check": ["Ambient","General"] };

function init(){
  const dateInput = document.getElementById('walkDate');
  if(dateInput) dateInput.value = new Date().toISOString().slice(0,10);

  document.getElementById('startWalkBtn')?.addEventListener('click', ()=>{
    document.getElementById('startPage').style.display='none';
    document.getElementById('walkForm').style.display='block';
    const sel=document.getElementById('templateSelect').value;
    if(sel && TEMPLATE_SETS[sel]) populateSectionsFromTemplate(TEMPLATE_SETS[sel]);
    else populateDefaultSectionsInForm();
  });

  document.getElementById('walkForm')?.addEventListener('submit', saveWalk);
  document.getElementById('sectionsContainer')?.addEventListener('input', autosave);
  document.getElementById('viewHistoryBtn')?.addEventListener('click', ()=>loadHistory());
  document.getElementById('closeHistoryBtn')?.addEventListener('click', ()=>document.getElementById('historyViewer').style.display='none');
}

function populateDefaultSectionsInForm(){
  const container = document.getElementById('sectionsContainer');
  container.innerHTML='';
  DEFAULT_SECTION_TITLES.forEach(title=>{
    const sectionDiv = document.createElement('div');
    sectionDiv.className='section';
    const h3 = document.createElement('h3'); h3.textContent = title;
    sectionDiv.appendChild(h3);
    DEFAULT_QUESTIONS.forEach(q=>{
      const ta = document.createElement('textarea'); ta.placeholder = q; ta.rows=3;
      sectionDiv.appendChild(ta);
    });
    container.appendChild(sectionDiv);
  });
  autosave();
}

function populateSectionsFromTemplate(sectionTitles){
  const container = document.getElementById('sectionsContainer');
  container.innerHTML='';
  sectionTitles.forEach(title=>{
    const sectionDiv = document.createElement('div');
    sectionDiv.className='section';
    const h3 = document.createElement('h3'); h3.textContent = title;
    sectionDiv.appendChild(h3);
    DEFAULT_QUESTIONS.forEach(q=>{
      const ta=document.createElement('textarea'); ta.placeholder=q; ta.rows=3;
      sectionDiv.appendChild(ta);
    });
    container.appendChild(sectionDiv);
  });
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
  tx.oncomplete=()=>{ loadHistory(); localStorage.removeItem('autosaveWalk'); };
}

function loadHistory(){
  const viewer=document.getElementById('historyViewer');
  const container=document.getElementById('history');
  container.innerHTML='';
  const tx=db.transaction('walks','readonly');
  const store=tx.objectStore('walks');
  store.getAll().onsuccess=e=>{
    const entries=e.target.result||[];
    entries.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
    entries.forEach(entry=>{
      const li=document.createElement('li');
      const time=new Date(entry.timestamp).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
      li.textContent=`${entry.date} ${time}`;
      container.appendChild(li);
    });
    viewer.style.display='block';
  };
}
