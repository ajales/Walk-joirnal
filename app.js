// Walk Journal - Finalized build
let db;
const request = indexedDB.open("WalkJournalDB", 5);

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

// Default section titles and questions
const DEFAULT_SECTION_TITLES = ["Ambient","Frozen","ISB","FOTM","Fridge","General"];
const DEFAULT_QUESTIONS = ["Findings","Reasoning","Solution"];

function init() {
  loadHistory();
  document.getElementById('walkForm').addEventListener('submit', saveWalk);
  document.getElementById('addSection').addEventListener('click', () => addSection());
  document.getElementById('viewHistoryBtn').addEventListener('click', () => document.getElementById('historyViewer').style.display='flex');
  document.getElementById('closeHistoryBtn').addEventListener('click', () => document.getElementById('historyViewer').style.display='none');
  document.getElementById('closeEntryDetailBtn').addEventListener('click', () => document.getElementById('entryDetailViewer').style.display='none');
  document.getElementById('closeSectionViewer').addEventListener('click', () => document.getElementById('sectionViewer').style.display='none');
  document.getElementById('addSectionViewerBtn').addEventListener('click', ()=> addSectionInViewer());
  populateDefaultSectionsInForm();
}

// Populate the walk creation form with the six fixed sections and 3 questions each
function populateDefaultSectionsInForm() {
  const container = document.getElementById('sectionsContainer');
  container.innerHTML = '';
  DEFAULT_SECTION_TITLES.forEach(title => {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'section';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    h3.setAttribute('data-fixed','true'); // mark fixed title
    sectionDiv.appendChild(h3);

    DEFAULT_QUESTIONS.forEach(q => {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = q;
      sectionDiv.appendChild(input);
    });

    // Keep the Add Question button per section
    const addQBtn = document.createElement('button');
    addQBtn.type = 'button';
    addQBtn.textContent = 'Add Question';
    addQBtn.onclick = () => {
      const q = document.createElement('input');
      q.type = 'text';
      q.placeholder = 'New question';
      sectionDiv.insertBefore(q, addQBtn);
    };
    sectionDiv.appendChild(addQBtn);

    container.appendChild(sectionDiv);
  });
}

// Allow adding a new editable section (not one of the 6 fixed ones)
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

// Save a walk - collects sections and questions and stores in IndexedDB
function saveWalk(e) {
  e.preventDefault();
  const date = document.getElementById('walkDate').value || new Date().toISOString().slice(0,10);
  const sections = Array.from(document.querySelectorAll('.section')).map(section => {
    const title = section.querySelector('h3').textContent;
    const answers = Array.from(section.querySelectorAll('input[type="text"]')).map(input => ({
      question: input.placeholder || 'Question',
      answer: input.value || ''
    }));
    return { title, answers };
  });

  const walk = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), date, timestamp: new Date().toISOString(), sections };
  const tx = db.transaction('walks', 'readwrite');
  tx.objectStore('walks').add(walk);
  tx.oncomplete = () => {
    loadHistory();
    document.getElementById('walkForm').reset();
    populateDefaultSectionsInForm();
  };
}

// Load history list (simple list of dates) - also used elsewhere
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

// Show sections in the full-screen swipe viewer with editable answers and add-question capability
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
        const input=document.createElement('input'); input.type='text'; input.value=a.answer || '';
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

  // Add section button in viewer (adds at end and persists)
  function addSectionInViewer(){
    const newTitle = prompt('Enter new section title:');
    if(!newTitle) return;
    const newSection = { title: newTitle, answers: [] };
    walk.sections.push(newSection);
    const tx=db.transaction('walks','readwrite'); const store=tx.objectStore('walks'); const getReq=store.get(walk.id);
    getReq.onsuccess=()=>{ const data=getReq.result; data.sections.push(newSection); store.put(data); renderSections(); currentIndex = walk.sections.length-1; container.style.transition='transform 0.3s ease'; container.style.transform=`translateX(-${currentIndex*100}%)`; };
  }

  // expose helper to outer scope
  window.addSectionInViewer = addSectionInViewer;
  document.getElementById('addSectionViewerBtn').onclick = addSectionInViewer;
}

// HISTORY VIEWER: grouped by ISO week -> day name (newest first)
document.getElementById('viewHistoryBtn').onclick = () => {
  const viewer = document.getElementById('historyViewer');
  const container = document.getElementById('historyContainer');
  viewer.style.display = 'flex';
  container.innerHTML = '<p>Loading...</p>';

  const tx = db.transaction('walks', 'readonly');
  const store = tx.objectStore('walks');
  const request = store.getAll();

  request.onsuccess = () => {
    const entries = request.result || [];
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const grouped = {};
    entries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const year = date.getFullYear();
      const week = getWeekNumber(date);
      const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
      const dayLabel = `${weekday} (${date.toLocaleDateString('en-GB')})`;
      const key = `${year}-W${week}`;

      if (!grouped[key]) grouped[key] = {};
      if (!grouped[key][dayLabel]) grouped[key][dayLabel] = [];
      grouped[key][dayLabel].push(entry);
    });

    container.innerHTML = '';
    for (const weekKey of Object.keys(grouped).sort().reverse()) {
      const weekDiv = document.createElement('div');
      weekDiv.className = 'week-block';
      weekDiv.innerHTML = `<h3>Week ${weekKey}</h3>`;

      const days = grouped[weekKey];
      for (const dayKey of Object.keys(days)) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-block';
        dayDiv.innerHTML = `<h4>${dayKey}</h4>`;

        const ul = document.createElement('ul');
        days[dayKey]
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .forEach(entry => {
            const li = document.createElement('li');
            const time = new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            li.innerHTML = `<strong>${time}</strong> — ${entry.title || '(Untitled Walk)'}`;
            li.style.cursor = 'pointer';
            li.onclick = () => showEntryDetails(entry.id);
            ul.appendChild(li);
          });

        dayDiv.appendChild(ul);
        weekDiv.appendChild(dayDiv);
      }

      container.appendChild(weekDiv);
    }
  };
};

document.getElementById('closeHistoryBtn').onclick = () => {
  document.getElementById('historyViewer').style.display = 'none';
};

// ENTRY DETAIL VIEWER: show full sections/questions/answers for an entry
function showEntryDetails(entryId) {
  const tx = db.transaction('walks', 'readonly');
  const store = tx.objectStore('walks');
  const req = store.get(entryId);
  req.onsuccess = () => {
    const entry = req.result;
    if (!entry) return;

    const viewer = document.getElementById('entryDetailViewer');
    const container = document.getElementById('detailContainer');
    const title = document.getElementById('detailTitle');

    viewer.style.display = 'flex';
    title.textContent = entry.title || 'Walk Entry Details';
    container.innerHTML = '';

    entry.sections.forEach(sec => {
      const secDiv = document.createElement('div');
      secDiv.className = 'detail-section';
      secDiv.innerHTML = `<h3>${sec.title}</h3>`;
      sec.answers.forEach(a => {
        const qa = document.createElement('p');
        qa.innerHTML = `<strong>${a.question}:</strong> ${a.answer || '(no answer)'}`;
        secDiv.appendChild(qa);
      });
      container.appendChild(secDiv);
    });
  };
}

// Helper: ISO week number
function getWeekNumber(date) {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((temp - yearStart) / 86400000 + 1) / 7);
  return weekNo;
}
