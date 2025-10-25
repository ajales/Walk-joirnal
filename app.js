let db;
const request = indexedDB.open("WalkJournalDB", 4);

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

function init() {
  loadHistory();
  document.getElementById('walkForm').addEventListener('submit', saveWalk);
  document.getElementById('addSection').addEventListener('click', () => addSection());
  document.getElementById('exportCsv').addEventListener('click', exportCSV);
  addSection(); // initial section
}

function addSection(title="New Section") {
  const container = document.getElementById('sectionsContainer');
  const sectionDiv = document.createElement('div');
  sectionDiv.className = 'section';
  
  const h3 = document.createElement('h3');
  h3.contentEditable = true;
  h3.textContent = title;
  sectionDiv.appendChild(h3);

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Enter a question';
  sectionDiv.appendChild(input);

  const addQBtn = document.createElement('button');
  addQBtn.type = 'button';
  addQBtn.textContent = 'Add Question';
  addQBtn.onclick = () => {
    const q = document.createElement('input');
    q.type = 'text';
    q.placeholder = 'Enter a question';
    sectionDiv.insertBefore(q, addQBtn);
  };
  sectionDiv.appendChild(addQBtn);

  container.appendChild(sectionDiv);
}

function saveWalk(e) {
  e.preventDefault();
  const date = document.getElementById('walkDate').value || new Date().toISOString().slice(0,10);
  const sections = Array.from(document.querySelectorAll('.section')).map(section => {
    const title = section.querySelector('h3').textContent;
    const answers = Array.from(section.querySelectorAll('input[type="text"]')).map(input => ({
      question: input.placeholder || "Question",
      answer: input.value
    }));
    return { title, answers };
  });

  const walk = { id: crypto.randomUUID(), date, sections };
  const tx = db.transaction('walks', 'readwrite');
  tx.objectStore('walks').add(walk);
  tx.oncomplete = () => {
    loadHistory();
    document.getElementById('walkForm').reset();
    document.getElementById('sectionsContainer').innerHTML = '';
    addSection();
  };
}

function loadHistory() {
  const container = document.getElementById('history');
  container.innerHTML = '';
  const tx = db.transaction('walks', 'readonly');
  const store = tx.objectStore('walks');
  store.openCursor(null, 'prev').onsuccess = e => {
    const cursor = e.target.result;
    if(cursor){
      const div = document.createElement('div');
      div.className = 'walk-item';
      div.textContent = cursor.value.date;

      div.onclick = () => showWalkSections(cursor.value);
      addSwipeHandlers(div, cursor.value.id);

      container.appendChild(div);
      cursor.continue();
    }
  };
}

// Swipe-to-delete animation
function addSwipeHandlers(div, walkId) {
  let startX=0, currentX=0, swiping=false;
  div.addEventListener('touchstart', e => { startX=e.changedTouches[0].screenX; swiping=true; div.classList.add('swiping'); });
  div.addEventListener('touchmove', e => {
    if(!swiping) return;
    currentX=e.changedTouches[0].screenX;
    const deltaX=currentX-startX;
    div.style.transform=`translateX(${deltaX}px)`;
  });
  div.addEventListener('touchend', e => {
    swiping=false;
    div.classList.remove('swiping');
    const deltaX=currentX-startX;
    if(Math.abs(deltaX)>100 && deltaX<0){ 
      div.style.transition='transform 0.3s ease';
      div.style.transform='translateX(-100%)';
      setTimeout(()=>{ const tx=db.transaction('walks','readwrite'); tx.objectStore('walks').delete(walkId).oncomplete=loadHistory; },300);
    } else { div.style.transition='transform 0.3s ease'; div.style.transform='translateX(0)'; }
  });
}

// Section swipe viewer
function showWalkSections(walk) {
  const viewer=document.getElementById('sectionViewer');
  const container=document.getElementById('sectionContainer');
  viewer.style.display='block';
  container.innerHTML='';

  const renderSections = () => {
    container.innerHTML='';
    walk.sections.forEach((sec,sIdx)=>{
      const card=document.createElement('div');
      card.className='section-card';
      const title=document.createElement('h3'); title.textContent=sec.title; card.appendChild(title);

      sec.answers.forEach((a,aIdx)=>{
        const label=document.createElement('label'); label.textContent=a.question;
        const input=document.createElement('input'); input.type='text'; input.value=a.answer;
        input.addEventListener('input',()=>{ const tx=db.transaction('walks','readwrite'); const store=tx.objectStore('walks'); const getReq=store.get(walk.id); getReq.onsuccess=()=>{ const data=getReq.result; data.sections[sIdx].answers[aIdx].answer=input.value; store.put(data); }; });
        label.appendChild(input); card.appendChild(label);
      });

      const addQBtn=document.createElement('button');
      addQBtn.type='button'; addQBtn.textContent='Add Question';
      addQBtn.onclick=()=>{ const newQ=prompt('Enter new question:'); if(newQ){ sec.answers.push({question:newQ,answer:''}); const tx=db.transaction('walks','readwrite'); const store=tx.objectStore('walks'); const getReq=store.get(walk.id); getReq.onsuccess=()=>{ const data=getReq.result; data.sections[sIdx].answers.push({question:newQ,answer:''}); store.put(data); renderSections(); }; } };
      card.appendChild(addQBtn);

      container.appendChild(card);
    });
  };

  renderSections();

  // Swipe navigation
  let currentIndex=0, startX=0, currentX=0, swiping=false;
  container.addEventListener('touchstart', e=>{ startX=e.changedTouches[0].screenX; swiping=true; container.style.transition='none'; });
  container.addEventListener('touchmove', e=>{ if(!swiping) return; currentX=e.changedTouches[0].screenX; const deltaX=currentX-startX; container.style.transform=`translateX(${-currentIndex*100+deltaX/window.innerWidth*100}%)`; });
  container.addEventListener('touchend', e=>{ swiping=false; const deltaX=currentX-startX; if(deltaX<-50 && currentIndex<walk.sections.length-1) currentIndex++; if(deltaX>50 && currentIndex>0) currentIndex--; container.style.transition='transform 0.3s ease'; container.style.transform=`translateX(-${currentIndex*100}%)`; });

  document.getElementById('closeSectionViewer').onclick=()=>{ viewer.style.display='none'; };

  // Add section button in viewer
  document.getElementById('addSectionViewerBtn').onclick = () => {
    const newTitle = prompt('Enter new section title:');
    if(!newTitle) return;
    const newSection = { title: newTitle, answers: [] };
    walk.sections.push(newSection);
    const tx=db.transaction('walks','readwrite'); const store=tx.objectStore('walks'); const getReq=store.get(walk.id);
    getReq.onsuccess=()=>{ const data=getReq.result; data.sections.push(newSection); store.put(data); renderSections(); currentIndex = walk.sections.length-1; container.style.transition='transform 0.3s ease'; container.style.transform=`translateX(-${currentIndex*100}%)`; };
  };
}

function exportCSV(){
  const tx=db.transaction('walks','readonly'); const store=tx.objectStore('walks'); let walks=[];
  store.openCursor().onsuccess=e=>{ const cursor=e.target.result; if(cursor){ walks.push(cursor.value); cursor.continue(); } else {
    let csv='Date,Section,Question,Answer\n';
    walks.forEach(w=>{ w.sections.forEach(sec=>{ sec.answers.forEach(a=>{ csv+=`"${w.date}","${sec.title}","${a.question}","${a.answer}"\n`; }); }); });
    const blob=new Blob([csv],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='walks.csv'; a.click(); URL.revokeObjectURL(url);
  }};
}