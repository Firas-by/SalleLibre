// SalleLibre - Frontend Web & Mobile Client (Ponytail Clean Architecture)
// Standard Native ES6+ (No external build tools or framework bloat)

const API_BASE = '/api';

// État applicatif local
let state = {
  token: localStorage.getItem('sallelibre_token') || null,
  user: JSON.parse(localStorage.getItem('sallelibre_user') || 'null'),
  salles: [],
  sessions: [],
  recommendation: null,
  lang: localStorage.getItem('sallelibre_lang') || 'FR',
  activeTab: 'salles',
  isOffline: false
};

// Traductions bilingues FR / EN
const I18N = {
  FR: {
    title: "SalleLibre",
    subtitle: "Repérage des salles libres de révision",
    tabSalles: "Salles en Direct",
    tabSessions: "Sessions d'Entraide",
    tabAdmin: "Administration Scolarité",
    login: "Connexion",
    logout: "Déconnexion",
    offlineMsg: "Mode hors-ligne : Affichage des dernières données enregistrées",
    free: "LIBRE",
    occupied: "OCCUPÉE",
    uncertain: "INCERTAINE",
    signalBtn: "Signaler",
    joinSession: "Rejoindre",
    spotsLeft: "places restantes",
    nextClass: "Prochain cours",
    noClass: "Aucun autre cours aujourd'hui",
    freeUntil: "Libre jusqu'à",
    outlets: "Prises murales",
    noOutlets: "Pas de prises",
    antiSpamWait: "Quota anti-spam : attendez 10 min entre deux signalements d'une même salle."
  },
  EN: {
    title: "SalleLibre",
    subtitle: "Real-time classroom finder & study hub",
    tabSalles: "Live Classrooms",
    tabSessions: "Study Beacons",
    tabAdmin: "School Administration",
    login: "Sign In",
    logout: "Sign Out",
    offlineMsg: "Offline mode: Showing cached campus data",
    free: "FREE",
    occupied: "OCCUPIED",
    uncertain: "UNCERTAIN",
    signalBtn: "Report",
    joinSession: "Join",
    spotsLeft: "spots left",
    nextClass: "Next class",
    noClass: "No more classes today",
    freeUntil: "Free until",
    outlets: "Power outlets",
    noOutlets: "No outlets",
    antiSpamWait: "Anti-spam limit: please wait 10 min between reports for the same room."
  }
};

// --- INITIALISATION AU CHARGEMENT DU DOM ---
document.addEventListener('DOMContentLoaded', () => {
  renderUserBadge();
  fetchSalles();
  fetchRecommendation();
  fetchSessions();

  // Écoute des événements de connectivité réseau
  window.addEventListener('online', () => setOfflineMode(false));
  window.addEventListener('offline', () => setOfflineMode(true));
});

// --- GESTION DE LA LANGUE ---
function toggleLanguage() {
  state.lang = state.lang === 'FR' ? 'EN' : 'FR';
  localStorage.setItem('sallelibre_lang', state.lang);
  document.getElementById('langLabel').innerText = state.lang === 'FR' ? 'EN' : 'FR';
  applyLanguage();
  renderSalles();
}

function applyLanguage() {
  const t = I18N[state.lang];
  document.getElementById('appSubtitle').innerText = t.subtitle;
  document.getElementById('tabSallesText').innerText = t.tabSalles;
  document.getElementById('tabSessionsText').innerText = t.tabSessions;
  document.getElementById('tabAdminText').innerText = t.tabAdmin;
  document.getElementById('loginBtnText').innerText = t.login;
}

// --- NAVIGATION PAR ONGLETS ---
function switchTab(tabId) {
  state.activeTab = tabId;
  document.getElementById('sectionSalles').style.display = tabId === 'salles' ? 'block' : 'none';
  document.getElementById('sectionSessions').style.display = tabId === 'sessions' ? 'block' : 'none';
  document.getElementById('sectionAdmin').style.display = tabId === 'admin' ? 'block' : 'none';

  document.getElementById('tabBtnSalles').classList.toggle('active', tabId === 'salles');
  document.getElementById('tabBtnSessions').classList.toggle('active', tabId === 'sessions');
  document.getElementById('tabBtnAdmin').classList.toggle('active', tabId === 'admin');

  if (tabId === 'admin') {
    fetchHeatmap();
  } else if (tabId === 'sessions') {
    fetchSessions();
  }
}

// --- APPELS D'API & CACHE LOCAL ---
async function fetchSalles(forceRefresh = false) {
  try {
    const res = await fetch(`${API_BASE}/salles/disponibles`);
    if (!res.ok) throw new Error('Erreur de réponse serveur');
    const data = await res.json();
    state.salles = data.salles || [];
    
    // Sauvegarde dans le cache local (NFR-04)
    localStorage.setItem('sallelibre_cache', JSON.stringify({
      salles: state.salles,
      timestamp: new Date().toLocaleTimeString()
    }));
    setOfflineMode(false);
  } catch (err) {
    console.warn('Réseau indisponible, chargement du cache hors-ligne...', err);
    const cached = localStorage.getItem('sallelibre_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      state.salles = parsed.salles;
      setOfflineMode(true, parsed.timestamp);
    }
  }
  renderSalles();
}

async function fetchRecommendation() {
  try {
    const res = await fetch(`${API_BASE}/salles/recommandation`);
    if (res.ok) {
      const data = await res.json();
      if (data.succes && data.salle) {
        state.recommendation = data.salle;
        const box = document.getElementById('recommendationBox');
        document.getElementById('recRoomName').innerText = `Salle ${data.salle.numero} - Bâtiment ${data.salle.batiment}`;
        document.getElementById('recRoomDetails').innerText = 
          `${data.salle.capacite} places • ${data.salle.prises ? 'Prises électriques' : 'Pas de prises'} • Score : ${data.salle.scoreRecommandation} pts`;
        box.style.display = 'flex';
      }
    }
  } catch (err) {
    console.debug('Recommandation non disponible', err);
  }
}

async function fetchSessions() {
  try {
    const res = await fetch(`${API_BASE}/sessions-etude`);
    if (res.ok) {
      const data = await res.json();
      state.sessions = data.sessions || [];
      renderSessions();
    }
  } catch (err) {
    console.warn('Impossible de charger les sessions d étude', err);
  }
}

function setOfflineMode(isOffline, timestamp = '') {
  state.isOffline = isOffline;
  const banner = document.getElementById('offlineBanner');
  const bannerText = document.getElementById('offlineBannerText');
  if (isOffline) {
    banner.classList.add('visible');
    bannerText.innerText = `${I18N[state.lang].offlineMsg} (Sauvegardé à ${timestamp || new Date().toLocaleTimeString()})`;
  } else {
    banner.classList.remove('visible');
  }
}

// --- RENDU GRAPHIQUE DES SALLES ---
function applyFilters() {
  renderSalles();
}

function renderSalles() {
  const grid = document.getElementById('roomsGrid');
  const batiment = document.getElementById('filterBatiment').value;
  const minCapacite = parseInt(document.getElementById('filterCapacite').value) || 0;
  const prisesOnly = document.getElementById('filterPrises').checked;

  const filtered = state.salles.filter(s => {
    if (batiment !== 'ALL' && s.batiment !== batiment) return false;
    if (s.capacite < minCapacite) return false;
    if (prisesOnly && !s.prises) return false;
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
        🔍 Aucune salle ne correspond aux critères sélectionnés.
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(s => {
    const t = I18N[state.lang];
    const statusText = s.statut === 'LIBRE' ? t.free : (s.statut === 'OCCUPEE' ? t.occupied : t.uncertain);
    
    // Prochain cours ou temps restant
    let nextInfo = t.noClass;
    if (s.prochainCours) {
      nextInfo = `📅 ${t.nextClass} : ${s.prochainCours.matiere} à <strong>${s.prochainCours.heureDebut}</strong>`;
    }

    // Sessions d'entraide actives sur cette salle
    const activeSession = state.sessions.find(sess => sess.salleNumero === s.numero && sess.actif);
    let sessionHtml = '';
    if (activeSession) {
      sessionHtml = `
        <div class="beacon-badge">
          <span>🎯 <strong>${activeSession.matiere}</strong> (${activeSession.placesDisponibles} ${t.spotsLeft})</span>
          <button class="btn btn-outline btn-sm" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="joinSession(${activeSession.id})">
            ${t.joinSession}
          </button>
        </div>
      `;
    }

    return `
      <div class="room-card" id="card-${s.numero}">
        <div>
          <div class="room-card-header">
            <div class="room-title">
              Salle ${s.numero}
              <span class="badge-batiment">Bâtiment ${s.batiment}</span>
            </div>
            <span class="status-badge ${s.statut}">${statusText}</span>
          </div>

          <div class="room-features">
            <span class="feature-item">👥 ${s.capacite} places</span>
            <span class="feature-item">${s.prises ? '🔌 ' + t.outlets : '⚡ ' + t.noOutlets}</span>
            ${s.ambiance ? `<span class="feature-item">🤫 ${s.ambiance}</span>` : ''}
          </div>

          <div class="room-next-class">
            ${nextInfo}
          </div>

          ${sessionHtml}
        </div>

        <div class="room-card-actions">
          <button class="btn btn-outline btn-sm" style="flex: 1;" onclick="openSignalModal('${s.numero}')">
            📢 ${t.signalBtn}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// --- RENDU DES SESSIONS D'ENTRAIDE ---
function renderSessions() {
  const grid = document.getElementById('sessionsGrid');
  if (state.sessions.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted); background: white; border-radius: 12px; border: 1px solid var(--border);">
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">Aucune session d'entraide active actuellement.</p>
        <button class="btn btn-primary btn-sm" onclick="openCreateSessionModal()">Lancer la première session</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.sessions.map(s => `
    <div class="room-card">
      <div>
        <div class="room-card-header">
          <div class="room-title">
            ${s.matiere}
            <span class="badge-batiment">Salle ${s.salleNumero}</span>
          </div>
          <span class="status-badge LIBRE">${s.placesDisponibles} places</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
          Initié par <strong>${s.createurEmail || s.createurId}</strong>
        </p>
      </div>
      <div class="room-card-actions">
        <button class="btn btn-primary btn-sm" style="width: 100%;" onclick="joinSession(${s.id})">
          🤝 Rejoindre cette table
        </button>
      </div>
    </div>
  `).join('');
}

async function joinSession(sessionId) {
  if (!state.token) {
    alert('Veuillez vous connecter avec votre adresse universitaire pour rejoindre une session.');
    openLoginModal();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/sessions-etude/${sessionId}/rejoindre`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();
    if (res.ok) {
      alert(`🎉 Félicitations ! Vous avez réservé votre place. Places restantes : ${data.placesRestantes}`);
      fetchSessions();
      fetchSalles();
    } else {
      alert(`⚠️ ${data.erreur || 'Impossible de rejoindre la session.'}`);
    }
  } catch (err) {
    alert('Erreur réseau lors de la réservation.');
  }
}

// --- AUTHENTIFICATION ---
function openLoginModal() {
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('loginModal').classList.add('active');
}

function fillLogin(email, pwd) {
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = pwd;
}

async function submitLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const motDePasse = document.getElementById('loginPassword').value;
  const errDiv = document.getElementById('loginError');

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, motDePasse })
    });
    const data = await res.json();

    if (res.ok && data.succes) {
      state.token = data.token;
      state.user = data.utilisateur;
      localStorage.setItem('sallelibre_token', data.token);
      localStorage.setItem('sallelibre_user', JSON.stringify(data.utilisateur));

      closeModal('loginModal');
      renderUserBadge();
      alert(`Bienvenue ${data.utilisateur.nom || data.utilisateur.email} !`);
    } else {
      errDiv.innerText = data.erreur || 'Identifiants invalides.';
      errDiv.style.display = 'block';
    }
  } catch (err) {
    errDiv.innerText = 'Impossible de contacter le serveur d authentification.';
    errDiv.style.display = 'block';
  }
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('sallelibre_token');
  localStorage.removeItem('sallelibre_user');
  renderUserBadge();
  switchTab('salles');
}

function renderUserBadge() {
  const badge = document.getElementById('userBadge');
  const loginBtn = document.getElementById('loginBtn');
  const karma = document.getElementById('karmaScore');
  const email = document.getElementById('userEmail');

  if (state.user && state.token) {
    badge.style.display = 'flex';
    loginBtn.style.display = 'none';
    email.innerText = state.user.email;
    karma.innerText = `⭐ ${state.user.karmaScore || 100} Karma`;
  } else {
    badge.style.display = 'none';
    loginBtn.style.display = 'inline-flex';
  }
}

// --- GESTION DU SIGNALEMENT ---
function openSignalModal(salleNumero) {
  if (!state.token) {
    alert('Veuillez vous connecter avec votre adresse institutionnelle pour signaler l état d une salle.');
    openLoginModal();
    return;
  }
  document.getElementById('signalSalleNumero').value = salleNumero;
  document.getElementById('signalError').style.display = 'none';
  document.getElementById('signalModal').classList.add('active');
}

async function submitSignalement() {
  const salleNumero = document.getElementById('signalSalleNumero').value;
  const etat = document.querySelector('input[name="signalEtat"]:checked').value;
  const ambiance = document.getElementById('signalAmbiance').value;
  const errDiv = document.getElementById('signalError');

  try {
    const res = await fetch(`${API_BASE}/signalements`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ salleNumero, etat, ambiance })
    });
    const data = await res.json();

    if (res.ok && data.succes) {
      closeModal('signalModal');
      alert(`✅ Signalement enregistré avec succès pour la salle ${salleNumero} !`);
      fetchSalles();
    } else {
      errDiv.innerText = data.erreur || 'Erreur lors du signalement.';
      errDiv.style.display = 'block';
    }
  } catch (err) {
    errDiv.innerText = 'Erreur réseau lors de l enregistrement.';
    errDiv.style.display = 'block';
  }
}

// --- GESTION DE CREATION DE SESSION D'ENTRAIDE ---
function openCreateSessionModal() {
  if (!state.token) {
    alert('Connexion requise pour lancer une session d étude.');
    openLoginModal();
    return;
  }
  // Remplir le select avec les salles libres
  const select = document.getElementById('sessionSalleSelect');
  select.innerHTML = state.salles.map(s => `<option value="${s.numero}">Salle ${s.numero} (${s.batiment})</option>`).join('');
  document.getElementById('sessionError').style.display = 'none';
  document.getElementById('sessionModal').classList.add('active');
}

async function submitCreateSession() {
  const salle = document.getElementById('sessionSalleSelect').value;
  const matiere = document.getElementById('sessionMatiere').value.trim();
  const places = parseInt(document.getElementById('sessionPlaces').value) || 2;
  const errDiv = document.getElementById('sessionError');

  if (!matiere) {
    errDiv.innerText = 'Veuillez saisir une matière.';
    errDiv.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/sessions-etude`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ salle, matiere, places })
    });
    const data = await res.json();

    if (res.ok && data.succes) {
      closeModal('sessionModal');
      alert(`🎉 Session d'étude ouverte en salle ${salle} ! (+5 points Karma attribués)`);
      fetchSessions();
      fetchSalles();
    } else {
      errDiv.innerText = data.erreur || 'Impossible de créer la session.';
      errDiv.style.display = 'block';
    }
  } catch (err) {
    errDiv.innerText = 'Erreur réseau.';
    errDiv.style.display = 'block';
  }
}

// --- MODULE ADMIN CSV & HEATMAP ---
async function handleCSVUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const csvContent = e.target.result;
    sendCSVContent(csvContent);
  };
  reader.readAsText(file);
}

async function testUploadSample(isInvalid) {
  const csvContent = isInvalid
    ? "salle,jour,heureDebut,heureFin,matiere\nA01,1,08:30,10:30,Génie Logiciel\nA02,1,10:30,12:30,Base de Données\nB01,1,14:00,16:00,Réseaux\nB02,1,17:00,15:00,Algorithmique" // Ligne 4 : heureDebut > heureFin
    : "salle,jour,heureDebut,heureFin,matiere\nA01,1,08:30,10:30,Génie Logiciel\nA02,1,10:30,12:30,Base de Données\nB01,1,14:00,16:00,Réseaux\nC01,1,08:30,12:30,Systèmes d Exploitation";
  
  sendCSVContent(csvContent);
}

async function sendCSVContent(csvString) {
  const resDiv = document.getElementById('csvResultMsg');
  resDiv.innerHTML = `<span style="color: var(--text-muted);">Analyse et validation en cours...</span>`;

  try {
    const res = await fetch(`${API_BASE}/admin/emplois-du-temps/import`, {
      method: 'POST',
      headers: {
        'Authorization': state.token ? `Bearer ${state.token}` : '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contenuCSV: csvString })
    });
    const data = await res.json();

    if (res.ok && data.succes) {
      resDiv.innerHTML = `
        <div class="alert alert-success">
          ✅ <strong>Succès :</strong> ${data.message || 'Emploi du temps importé avec succès !'} (${data.creneauxImportes} créneaux ajoutés).
        </div>
      `;
      fetchSalles();
    } else {
      resDiv.innerHTML = `
        <div class="alert alert-error">
          ❌ <strong>Rejet de l'import :</strong> ${data.erreur || 'Fichier CSV non conforme.'}
          ${data.ligne ? `<br><strong>Ligne défaillante : ${data.ligne}</strong>` : ''}
        </div>
      `;
    }
  } catch (err) {
    resDiv.innerHTML = `<div class="alert alert-error">Erreur lors de l envoi au serveur.</div>`;
  }
}

async function fetchHeatmap() {
  const container = document.getElementById('heatmapContainer');
  try {
    const res = await fetch(`${API_BASE}/salles/heatmap`);
    if (res.ok) {
      const data = await res.json();
      const batiments = ['A', 'B', 'C'];
      const heures = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];

      let html = `<table class="heatmap-table"><thead><tr><th>Bâtiment</th>`;
      heures.forEach(h => html += `<th>${h}</th>`);
      html += `</tr></thead><tbody>`;

      batiments.forEach(b => {
        html += `<tr><td><strong>Bâtiment ${b}</strong></td>`;
        heures.forEach((h, idx) => {
          const occ = (b.charCodeAt(0) + idx) % 3; // Démo répartition
          const label = occ === 0 ? 'Calme' : (occ === 1 ? 'Moyen' : 'Saturé');
          html += `<td class="heatmap-cell-${occ}">${label}</td>`;
        });
        html += `</tr>`;
      });

      html += `</tbody></table>`;
      container.innerHTML = html;
    }
  } catch (err) {
    container.innerHTML = `<p style="color: var(--text-muted);">Heatmap non disponible.</p>`;
  }
}

async function triggerRgpdPurge() {
  const msgDiv = document.getElementById('rgpdResultMsg');
  msgDiv.innerHTML = 'Traitement RGPD en cours...';
  try {
    const res = await fetch(`${API_BASE}/admin/rgpd/anonymiser`, {
      method: 'POST',
      headers: { 'Authorization': state.token ? `Bearer ${state.token}` : '' }
    });
    const data = await res.json();
    if (res.ok) {
      msgDiv.innerHTML = `<span style="color: #065f46;">✅ Purge effectuée : ${data.enregistrementsAnonymises || 0} signalements anonymisés.</span>`;
    } else {
      msgDiv.innerHTML = `<span style="color: #991b1b;">⚠️ ${data.erreur || 'Échec de la purge.'}</span>`;
    }
  } catch (err) {
    msgDiv.innerHTML = `<span style="color: #991b1b;">Erreur réseau.</span>`;
  }
}

// --- UTILITAIRES MODALES ---
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function focusRoomFromRec() {
  if (!state.recommendation) return;
  const card = document.getElementById(`card-${state.recommendation.numero}`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.outline = '3px solid #4f46e5';
    setTimeout(() => { card.style.outline = 'none'; }, 2000);
  }
}
