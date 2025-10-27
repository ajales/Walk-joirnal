let db;
const DEFAULT_SECTION_TITLES = ["Ambient","Frozen","ISB","FOTM","Fridge","General"];
const DEFAULT_QUESTIONS = ["Findings","Reasoning","Solution"];

const request = indexedDB.open("WalkJournalDB", 1);
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

function init(){
  const dateInput = document.getElementById('walkDate');
  const today = new Date();
  dateInput.value = today.toISOString().slice(0,10); // YYYY-MM-DD

  populateDefaultSections();

  document.getElementById('walkForm').addEventListener('submit', saveWalk);
  document.getElementById('viewHistoryBtn').addEventListener('click', loadHistory);
}

function populateDefaultSections(){
  const container = document.getElementById('sectionsContainer');
  container.innerHTML='';
  DEFAULT_SECTION_TITLES.forEach(title => {
    const sectionDiv = document.createElement('div');
    sectionDiv.className='section';
    const h3 = document.createElement('h3'); h3.textContent = title;
    sectionDiv.appendChild(h3);
    DEFAULT_QUESTIONS.forEach(q => {
      const ta = document.createElement('textarea'); ta.placeholder=q; ta.rows=3;
      sectionDiv.appendChild(ta);
    });
    container.appendChild(sectionDiv);
  });
}

function saveWalk(e){
  e.preventDefault();
  const date=document.getElementById('walkDate').value;
  const tags=document.getElementById('tagsInput').value;
  const sections = Array.from(document.querySelectorAll('.section')).map(section=>{
    const title = section.querySelector('h3').textContent;
    const answers = Array.from(section.querySelectorAll('textarea')).map(t=>({question:t.placeholder, answer:t.value}));
    return {title, answers};
  });
  const walk={id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), date, timestamp:new Date().toISOString(), sections, tags};
  const tx=db.transaction('walks','readwrite');
  tx.objectStore('walks').add(walk);
  tx.oncomplete = ()=>{ alert("Walk saved!"); loadHistory(); };
}

function loadHistory(){
  const viewer = document.getElementById('historyViewer');
  const container = document.getElementById('history');
  container.innerHTML='';
  const tx=db.transaction('walks','readonly');
  const store=tx.objectStore('walks');
  store.getAll().onsuccess=e=>{
    const walks=e.target.result || [];
    walks.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
    walks.forEach(walk=>{
      const li=document.createElement('li');
      const dateStr = new Date(walk.date).toLocaleDateString('en-GB',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
      const timeStr = new Date(walk.timestamp).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
      li.textContent = dateStr + " " + timeStr + (walk.tags ? " ["+walk.tags+"]" : "");
      li.style.cursor='pointer';
      li.style.marginBottom='8px';
      li.onclick = ()=>{
        if(li.querySelector('.entry-content')){
          li.querySelector('.entry-content').remove();
          return;
        }
        const content = document.createElement('div');
        content.className='entry-content';
        walk.sections.forEach(sec=>{
          const secDiv = document.createElement('div'); secDiv.className='entry-section';
          const h4 = document.createElement('h4'); h4.textContent=sec.title;
          secDiv.appendChild(h4);
          sec.answers.forEach(a=>{
            const ta = document.createElement('textarea'); ta.value=a.answer; ta.rows=2; ta.readOnly=true;
            secDiv.appendChild(ta);
          });
          content.appendChild(secDiv);
        });
        li.appendChild(content);
      };
      container.appendChild(li);
    });
    viewer.style.display='block';
  };
}