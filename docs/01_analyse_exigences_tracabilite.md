# SalleLibre - Analyse des Exigences et Matrice de Traçabilité

**Projet :** SalleLibre - Application mobile de repérage des salles libres pour réviser  
**Référence :** Cahier des charges Version 1.0 (Octobre 2026)  
**Auteur :** Équipe d'Ingénierie Logicielle  

---

## 1. Introduction et Périmètre du Système

### 1.1 Contexte du Projet
À l'approche des sessions d'examens universitaires, les étudiants font face à une saturation chronique des bibliothèques universitaires. Simultanément, plusieurs salles d'enseignement restent inoccupées au cours de la journée en raison de créneaux vacants ou de cours déprogrammés. Les étudiants perdent un temps précieux à arpenter les couloirs pour trouver une salle libre. L'affichage papier à l'entrée des bâtiments est statique et rarement actualisé.

### 1.2 Objectifs Opérationnels
1. **Temps Réel :** Afficher en temps réel la disponibilité des salles d'étude et de révision sur le campus.
2. **Gain de Temps :** Réduire le temps de recherche d'une salle à moins de 30 secondes pour 90 % des étudiants.
3. **Collaboration Participative (Crowdsourcing) :** Permettre aux étudiants d'actualiser l'état réel des salles par signalement direct (libre / occupée).
4. **Gestion Décentralisée des Emplois du Temps :** Offrir à la scolarité un mécanisme d'importation automatisé de grilles horaires au format CSV avec détection précise des anomalies.

---

## 2. Typologie des Utilisateurs et Acteurs du Système

| Acteur | Rôle et Responsabilités | Privilèges d'Accès |
|---|---|---|
| **Visiteur / Non-connecté** | Consultation passive des informations publiques, parcours d'onboarding, sélection de langue. | Lecture seule (salles libres, créneaux). Signalement interdit. |
| **Étudiant Connecté** | Consultation avancée, filtrage (bâtiment, capacité, prises), signalement de l'état réel d'une salle. | Lecture et création de signalements (soumis au quota de 1 signalement par salle / 10 min). |
| **Administrateur Scolarité** | Importation des emplois du temps (CSV), supervision des salles, consultation des anomalies de format. | Accès complet aux fonctions d'administration et aux endpoints protégés. |
| **Système (Background Service)** | Calcul d'état d'incertitude (>30 min), calcul du prochain cours, anonymisation RGPD des signalements (>24h). | Traitements automatisés planifiés côté serveur. |

---

## 3. Exigences Fonctionnelles Détaillées (B1 à B4)

### Groupe B1 : Affichage des Salles Libres
- **REF-B1.1 :** Le système doit calculer et renvoyer la liste des salles libres à l'heure exacte de la consultation selon l'emploi du temps officiel.
- **REF-B1.2 :** Le système doit permettre le filtrage multicritère des salles :
  - Par bâtiment (ex: Bâtiment A, Bâtiment B, Bâtiment C).
  - Par capacité minimale (ex: 20, 30, 50 places).
  - Par présence de prises électriques (Oui / Non).
- **REF-B1.3 :** Le système doit calculer et afficher pour chaque salle l'heure du prochain cours prévu sur la journée (`Prochain cours à HH:MM` ou `Aucun cours prévu aujourd'hui`).

### Groupe B2 : Gestion des Signalements Participatifs
- **REF-B2.1 :** Tout étudiant authentifié peut soumettre un signalement d'état réel : `LIBRE` ou `OCCUPEE`.
- **REF-B2.2 :** Le système refuse formellement et bloque tout signalement soumis par un utilisateur non authentifié (Code HTTP `401 Unauthorized`).
- **REF-B2.3 :** Règle d'incertitude : Une salle libre selon l'emploi du temps est marquée automatiquement comme **INCERTAINE** si aucun signalement n'a été reçu depuis plus de 30 minutes.
- **REF-B2.4 :** Règle anti-spam : Un même étudiant ne peut émettre qu'un seul signalement pour une même salle toutes les 10 minutes (Code HTTP `429 Too Many Requests` avec durée d'attente restante).

### Groupe B3 : Gestion des Emplois du Temps
- **REF-B3.1 :** L'administrateur de la scolarité peut importer une grille horaire via un fichier structuré CSV.
- **REF-B3.2 :** En cas d'incohérence ou d'erreur de syntaxe dans le fichier CSV, le système rejette l'importation globale en transactionnel et renvoie explicitement le numéro de la ligne en erreur ainsi que la cause précise du rejet.

### Groupe B4 : Résilience et Continuité de Service
- **REF-B4.1 :** En cas d'inaccessibilité du serveur (panne réseau, arrêt du service), l'application mobile affiche les dernières données enregistrées dans le cache local ainsi que l'horodatage exact de la dernière mise à jour.
- **REF-B4.2 :** Si le terminal ne dispose d'aucune connexion réseau (Wi-Fi déconnecté), l'application avertit l'utilisateur par un bandeau explicite que les données affichées sont susceptibles d'être périmées.

---

## 4. Exigences Non Fonctionnelles

| Identifiant | Catégorie | Description Spécifique | Critère d'Acceptation |
|---|---|---|---|
| **NFR-01** | Ergonomie & UI | Interface sobre et moderne (palette universitaire), optimisée pour un usage à une seule main sur écran 5,5 pouces. | Éléments d'action accessibles dans la zone du pouce inférieur, contrastes conformes WCAG AA. |
| **NFR-02** | Facteurs Humains | Recherche de salle libre instantanée sans formation préalable. | 90 % d'un panel de 10 étudiants trouvent une salle en moins de 30 secondes. Moins de 2 % d'erreurs de signalement. |
| **NFR-03** | Internationalisation | Bilinguisme natif dès l'accueil : Français et Anglais. | Bascule instantanée de la langue sans rechargement de l'application. |
| **NFR-04** | Onboarding | Présentation de l'application en 3 étapes guidées expliquant la finalité, le fonctionnement collaboratif et la confidentialité des données. | Écran d'accueil 3 étapes avant la première connexion. |
| **NFR-05** | Performance | Temps de réponse sur le Wi-Fi campus inférieur à 2 secondes pour la liste des salles. | Requête API + rendu < 2000 ms. |
| **NFR-06** | Synchronisation | Écart maximal de 1 minute entre l'heure locale affichée et l'horloge du serveur. | Horodatages serveur au format ISO 8601 UTC. |
| **NFR-07** | Disponibilité | Service accessible 7j/7 de 7h00 à 22h00 avec un SLA de 98 %. | Architecture résiliente et reprise rapide. |
| **NFR-08** | Robustesse | L'application ne doit jamais planter (crash) en cas d'erreur serveur ou de coupure réseau inopinée. | Gestion globale des exceptions et affichage de messages d'erreur contextualisés. |
| **NFR-09** | Maintenabilité | Ajout d'un nouveau bâtiment réalisable par un développeur tiers en moins d'une heure. | Découpage modulaire, schéma normalisé en base de données. |
| **NFR-10** | Portabilité | Le backend Node.js doit exposer une API REST agnostique réutilisable pour une application iOS future sans altération côté serveur. | Endpoints REST JSON standardisés sans couplage spécifique Android. |
| **NFR-11** | Sécurité d'Accès | Authentification stricte réservée aux adresses e-mail institutionnelles validées (ex: `@univ.tn` ou domaine configurable). | Vérification du domaine e-mail à l'inscription / connexion. |
| **NFR-12** | Protection RGPD | Notification claire de l'étudiant quant aux données collectées avant la première connexion. Anonymisation irréversible des signalements après 24 heures. | Nettoyage des identifiants étudiants sur les signalements de plus de 24 heures. |

---

## 5. Matrice de Traçabilité des Exigences

| Id Exigence | Description Sommaire | Entité / Élément UML Associé | Composant Logiciel Implémenté | Méthode de Vérification & Test |
|---|---|---|---|---|
| **B1.1** | Liste des salles libres en temps réel | `Salle`, `Creneau`, `SalleService.calculerEtat()` | `GET /api/salles/disponibles` + Dashboard Web Réactif | Test unitaire du calcul de créneau + vérification terminal |
| **B1.2** | Filtres bâtiment, capacité, prises | `Salle.batiment`, `Salle.capacite`, `Salle.prises` | Query parameters API + Filtres Web Dynamiques | Test d'intégration multi-filtres |
| **B1.3** | Heure du prochain cours | `Creneau.heureDebut`, `SalleDTO.prochainCours` | Calcul dans `CreneauRepository` + affichage carte salle | Test unitaire de sélection du cours immédiatement postérieur |
| **B2.1** | Signalement libre / occupé | `Signalement.etat`, `SignalementService.creer()` | `POST /api/signalements` + Boutons d'action Web | Test API avec payload étudiant valide |
| **B2.2** | Rejet signalement non-authentifié | `AuthMiddleware`, `Role.ETUDIANT` | Middleware de vérification JWT | Test API sans token (attendu HTTP 401) |
| **B2.3** | Incertitude après 30 minutes | `RegleIncertitude`, `EtatSalle.INCERTAINE` | Évaluateur de fraîcheur dans `SalleService` | Test unitaire avec signalement simulé à T - 31 minutes |
| **B2.4** | Quota 1 signalement / salle / 10 min | `CooldownService`, `SignalementRateLimiter` | Middleware Redis/In-Memory Cooldown | Test double signalement à 2 min d'intervalle (attendu HTTP 429) |
| **B3.1** | Import CSV emploi du temps | `AdminController`, `CsvParserService` | `POST /api/admin/emplois-du-temps/import` | Test upload fichier CSV valide |
| **B3.2** | Rejet CSV erroné avec numéro de ligne | `CsvValidationException`, `CsvErrorDTO` | Validateur ligne par ligne + modale admin | Test upload CSV corrompu à la ligne 4 (attendu ligne 4 signalée) |
| **B4.1** | Cache hors-ligne et heure MAJ | `LocalCacheService`, `OfflineStorage` | LocalStorage Web Client | Coupure serveur et vérification affichage dernière liste |
| **B4.2** | Avertissement perte connexion | `ConnectivityService`, `NetworkBanner` | Événements navigator.onLine & Offline Banner | Simulation mode offline et vérification du bandeau |
| **NFR-03**| Internationalisation FR / EN | `AppLocalizations`, `LocaleNotifier` | Fichiers de localisation i18n | Bascule linguistique dans les paramètres |
| **NFR-04**| Onboarding 3 étapes | `OnboardingScreen`, `PageController` | Modale d'accueil & RGPD Web | Parcours premier lancement |
| **NFR-11**| E-mail institutionnel | `RegexEmailValidator`, `User.emailEtablissement` | Validateur d'inscription et de login | Tentative avec e-mail grand public (ex: @gmail.com rejeté) |
| **NFR-12**| Anonymisation 24 heures | `AnonymisationTask`, `Signalement.etudiantId` | Job planifié `AnonymizerCron` | Test du job sur enregistrements > 24h (anonymisation effective) |
