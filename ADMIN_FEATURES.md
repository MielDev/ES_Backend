# Documentation des API - Épicerie Solidaire

## Table des matières
- [Authentification](#authentification)
- [Gestion du Profil Étudiant](#gestion-du-profil-étudiant)
- [Rendez-vous](#rendez-vous)
- [Créneaux](#créneaux)
- [Administration](#administration)

## Authentification

### Inscription
**Endpoint:** `POST /api/auth/register`
**Description:** Inscription d'un nouvel utilisateur
**Body:**
```json
{
  "nom": "Dupont",
  "prenom": "Jean",
  "email": "jean.dupont@example.com",
  "password": "motdepasse123"
}
```

### Connexion
**Endpoint:** `POST /api/auth/login`
**Description:** Connexion d'un utilisateur
**Body:**
```json
{
  "email": "jean.dupont@example.com",
  "password": "motdepasse123"
}
```

### Profil utilisateur
**Endpoint:** `GET /api/auth/profile`
**Description:** Obtenir les informations du profil utilisateur connecté
**Authentification:** Requise

## Gestion du Profil Étudiant

### Inscription Étudiant
**Endpoint:** `POST /api/auth/register-student`
**Description:** Inscription d'un nouvel étudiant avec justificatif
**Content-Type:** `multipart/form-data`
**Champs requis:**
- `nom`: Nom de l'étudiant
- `prenom`: Prénom de l'étudiant
- `email`: Email de l'étudiant
- `password`: Mot de passe
- `telephone`: Numéro de téléphone
- `ecole_universite`: Établissement scolaire/universitaire
- `specialite`: Domaine d'études
- `justificatif`: Fichier justificatif (carte étudiante ou certificat de scolarité)

### Consulter son profil
**Endpoint:** `GET /api/auth/student-profile`
**Authentification:** Requise
**Description:** Récupère les informations du profil étudiant

### Mettre à jour son profil
**Endpoint:** `PUT /api/auth/student-profile`
**Authentification:** Requise
**Body:**
```json
{
  "nom": "Dupont",
  "prenom": "Jean",
  "email": "jean.dupont@example.com",
  "telephone": "06.12.34.56.78",
  "ecole_universite": "Université du Mans",
  "specialite": "Informatique"
}
```

## Rendez-vous

### Prendre un rendez-vous
**Endpoint:** `POST /api/appointments`
**Authentification:** Requise
**Body:**
```json
{
  "slotId": "123",
  "motif": "Courses alimentaires"
}
```

### Voir ses rendez-vous
**Endpoint:** `GET /api/appointments/me`
**Authentification:** Requise

### Annuler un rendez-vous
**Endpoint:** `DELETE /api/appointments/:id`
**Authentification:** Requise

### Voir tous les rendez-vous (Admin)
**Endpoint:** `GET /api/appointments`
**Authentification:** Admin requis

## Créneaux

### Voir les créneaux disponibles
**Endpoint:** `GET /api/slots`
**Authentification:** Requise

### Créer un créneau (Admin)
**Endpoint:** `POST /api/slots`
**Authentification:** Admin requis
**Body:**
```json
{
  "date": "2025-11-01",
  "heure_debut": "14:00",
  "heure_fin": "15:00",
  "capacite_max": 5
}
```

### Mettre à jour un créneau (Admin)
**Endpoint:** `PUT /api/slots/:id`
**Authentification:** Admin requis

### Supprimer un créneau (Admin)
**Endpoint:** `DELETE /api/slots/:id`
**Authentification:** Admin requis

### Générer des créneaux (Admin)
**Endpoint:** `POST /api/slots/generate`
**Description:** Génère automatiquement les créneaux selon la configuration
**Authentification:** Admin requis

## Administration

### Configuration des créneaux

#### Obtenir la configuration
**Endpoint:** `GET /api/admin/config`
**Authentification:** Admin requis

#### Mettre à jour la configuration
**Endpoint:** `POST /api/admin/config`
**Authentification:** Admin requis
**Body:**
```json
{
  "jour_semaine": "lundi",
  "heure_debut": "08:00",
  "heure_fin": "17:00",
  "nombre_passages_max": 5,
  "is_active": true
}
```

#### Supprimer une configuration
**Endpoint:** `DELETE /api/admin/config/:jour_semaine`
**Authentification:** Admin requis

### Gestion des utilisateurs

#### Lister tous les utilisateurs
**Endpoint:** `GET /api/admin/users`
**Authentification:** Admin requis

#### Activer/Désactiver un utilisateur
**Endpoint:** `PATCH /api/admin/users/:id/toggle-active`
**Authentification:** Admin requis

#### Modifier les limites de passages
**Endpoint:** `PATCH /api/admin/users/:id/passages`
**Authentification:** Admin requis
**Body:**
```json
{
  "passages_max_autorises": 10
}
```

### Validation des justificatifs

#### Utilisateurs en attente de validation
**Endpoint:** `GET /api/admin/users/pending-validation`
**Authentification:** Admin requis

#### Voir un justificatif
**Endpoint:** `GET /api/admin/users/:id/justificatif`
**Authentification:** Admin requis

#### Valider un justificatif
**Endpoint:** `PATCH /api/admin/users/:id/validate-justificatif`
**Authentification:** Admin requis
**Body:**
```json
{
  "status": "valide",
  "commentaire": "Justificatif valide"
}
```

#### Télécharger un justificatif (Admin)
**Endpoint:** `GET /api/auth/download-justificatif/:userId`
**Authentification:** Admin requis

## Gestion des rendez-vous (Admin)

### Valider un passage
**Endpoint:** `PATCH /api/admin/appointments/:id/validate`
**Authentification:** Admin requis
**Body:**
```json
{
  "status": "validé_admin",
  "note_admin": "Passage validé - 10kg achetés"
}
```

**Statuts disponibles:**
- `confirmé` (par défaut)
- `annulé`
- `terminé`
- `validé_admin` (validé par admin)
- `refusé_admin` (refusé par admin)

## Règles de réservation

### Politique d'annulation
- L'utilisateur peut annuler son rendez-vous via `DELETE /api/appointments/:id`
- Le créneau est immédiatement libéré pour les autres utilisateurs
- Un utilisateur ne peut avoir qu'un seul RDV confirmé par semaine (lundi à dimanche)

### Comportement de réservation
- Un utilisateur ne peut pas réserver plusieurs créneaux dans la même semaine
- Si un utilisateur annule un RDV, il peut le reprendre uniquement si :
  - Il n'a pas d'autre RDV confirmé cette semaine
  - Le créneau n'a pas été repris par un autre utilisateur

**Types de fichiers acceptés pour le justificatif:**
- Images: JPEG, PNG, GIF, WebP
- Documents: PDF
- Taille maximale: 5MB

**Réponse:**
```json
{
  "message": "Inscription réussie. Votre justificatif est en cours de validation.",
  "user": {
    "id": 1,
    "nom": "Martin",
    "prenom": "Jean",
    "email": "jean.martin@email.com",
    "telephone": "06.12.34.56.78",
    "ecole_universite": "Université du Mans",
    "specialite": "Informatique",
    "justificatif_status": "en_attente",
    "date_inscription": "2025-10-24T12:00:00.000Z"
  },
  "token": "jwt_token_here"
}
```

### Gestion du Profil Étudiant

**Consulter son profil:**
```http
GET /api/auth/student/profile
Authorization: Bearer VOTRE_TOKEN
```

**Mettre à jour son profil:**
```http
PUT /api/auth/student/profile
Authorization: Bearer VOTRE_TOKEN
Content-Type: application/json

{
  "nom": "Dupont",
  "prenom": "Jean",
  "email": "jean.dupont@example.com",
  "telephone": "06.12.34.56.78",
  "ecole_universite": "Université du Mans",
  "specialite": "Informatique"
}
```

### Validation des Justificatifs (Admin)

**Lister les utilisateurs en attente:**
```http
GET /api/admin/users/pending-validation
Authorization: Bearer ADMIN_TOKEN
```

**Consulter les détails d'un justificatif:**
```http
GET /api/admin/users/:id/justificatif
Authorization: Bearer ADMIN_TOKEN
```

**Valider ou refuser un justificatif:**
```http
PATCH /api/admin/users/:id/validate-justificatif
  "commentaire": "Justificatif valide - étudiant confirmé"
}
```

**Statuts possibles:**
- `en_attente` (par défaut)
- `validé` (utilisateur activé automatiquement)
- `refusé` (utilisateur reste inactif)

### Sécurité et Validation

- **Justificatif obligatoire** pour l'inscription
- **Validation admin** avant activation du compte
- **Types de fichiers** strictement contrôlés
- **Taille de fichier** limitée à 5MB
- **Stockage sécurisé** dans `/uploads/justificatifs/`
- **Accès admin** aux fichiers justificatifs

### Workflow Complet

1. **Étudiant s'inscrit** avec formulaire complet + justificatif
2. **Compte créé** avec statut `justificatif_status: 'en_attente'`
3. **Admin consulte** la liste des utilisateurs en attente
4. **Admin valide/refuse** le justificatif
5. **Étudiant activé** (si validé) ou reste inactif (si refusé)
6. **Étudiant peut** prendre des RDV selon les règles habituelles

## Workflow recommandé

1. **Configuration initiale:**
   - Définir les jours et heures disponibles avec `POST /api/admin/config`
   - Générer les créneaux avec `POST /api/slots/generate`

2. **Gestion des utilisateurs:**
   - Les nouveaux utilisateurs ont par défaut 1 passage autorisé
   - L'admin peut ajuster les limites avec `PATCH /api/admin/users/:id/passages`

3. **Validation des passages:**
   - Les utilisateurs réservent des créneaux normalement
   - L'admin valide les passages avec `PATCH /api/admin/appointments/:id/validate`
   - Chaque validation incrémente automatiquement le compteur de passages utilisés

4. **Gestion des achats:**
   - L'admin enregistre les achats avec `POST /api/admin/payments`
   - Le prix est calculé automatiquement selon la règle (kilos/2)

## Sécurité

- Toutes les routes admin nécessitent une authentification et des droits admin
- Les utilisateurs désactivés ne peuvent pas se connecter
- Les utilisateurs ayant atteint leur limite de passages ne peuvent plus réserver
- Seuls les admins peuvent modifier les configurations et valider les passages

## Workflow recommandé

1. **Configuration initiale:**
   - Définir les jours et heures disponibles avec `POST /api/admin/config`
   - Générer les créneaux avec `POST /api/slots/generate`
## Installation et Configuration

### 1. Installation des dépendances

```bash
npm install
```

### 2. Configuration de la base de données

```bash
# Créer le fichier .env avec les variables d'environnement
cp .env.example .env

# Modifier .env selon vos besoins
# DB_HOST=localhost
# DB_USER=votre_user
# DB_PASS=votre_password
# DB_NAME=epicerie_solidaire
# JWT_SECRET=votre_secret_jwt
```

### 3. Initialisation de la base de données

```bash
# Appliquer les migrations (création/modification des tables)
npm start  # Le serveur applique automatiquement les modifications avec { alter: true }

# OU re-créer complètement la base de données
npm run seed  # Supprime et recrée toutes les données de test
```

### 4. Créer un justificatif de test

```bash
npm run create-test-justificatif  # Crée un PDF de test dans uploads/justificatifs/
```

### 5. Démarrer le serveur

```bash
npm start  # Mode production
# OU
npm run dev  # Mode développement avec rechargement automatique
```

## Guide d'Utilisation Complet

### Pour les Étudiants

1. **Inscription :**
   ```bash
   # Via formulaire web avec upload de justificatif
   POST /api/auth/register-student
   ```

2. **Connexion :**
   ```bash
   POST /api/auth/student/login
   ```

3. **Consulter son profil :**
   ```bash
   GET /api/auth/student/profile
   ```

4. **Prendre un RDV :**
   ```bash
   POST /api/appointments
   ```

5. **Voir ses RDV :**
   ```bash
   GET /api/appointments/me
   ```

6. **Annuler un RDV :**
   ```bash
   DELETE /api/appointments/:id
   ```

### Pour les Administrateurs

1. **Validation des justificatifs :**
   ```bash
   GET /api/admin/users/pending-validation    # Liste des étudiants en attente
   GET /api/admin/users/:id/justificatif      # Détails d'un justificatif
   PATCH /api/admin/users/:id/validate-justificatif  # Valider/refuser
   ```

2. **Gestion des créneaux :**
   ```bash
   POST /api/slots/generate  # Générer les créneaux automatiquement
   ```

3. **Validation des passages :**
   ```bash
   PATCH /api/admin/appointments/:id/validate  # Valider un passage
   ```

## Structure des Fichiers

```
📁 Epicerie Solidaire Du Mans/ES_Backend/
├── 📄 server.js                    # Serveur principal
├── 📄 package.json                 # Dépendances et scripts
├── 📁 config/
│   └── 📄 db.js                   # Configuration base de données
├── 📁 models/                     # Modèles Sequelize
│   ├── 📄 user.model.js           # Étendu avec profil étudiant
│   ├── 📄 appointment.model.js    # Modèle des rendez-vous
│   └── 📄 ...                     # Autres modèles
├── 📁 controllers/                # Logique métier
│   ├── 📄 auth.student.controller.js  # Gestion des profils étudiants
│   ├── 📄 admin.controller.js     # Fonctionnalités administrateur
│   └── 📄 ...                     # Autres contrôleurs
├── 📁 routes/                     # Routes API
│   ├── 📄 auth.student.routes.js  # Routes inscription étudiant
│   ├── 📄 admin.routes.js         # Étendu avec validation
│   └── 📄 ...                     # Autres routes
├── 📁 middleware/                 # Middlewares
│   ├── 📄 auth.middleware.js      # Authentification
│   └── 📄 upload.middleware.js    # Upload de fichiers
├── 📁 uploads/                    # Fichiers uploadés
│   └── 📁 justificatifs/          # Justificatifs étudiants
└── 📁 seed/                       # Données de test
    └── 📄 seed.js                 # Données avec profils étudiants
```

## Sécurité

- **Authentification JWT** pour toutes les routes sensibles
- **Validation des types de fichiers** pour les uploads
- **Limite de taille** des fichiers (5MB)
- **Contrôle des permissions** admin/utilisateur
- **Validation des justificatifs** avant activation des comptes
- **Règle stricte** d'un RDV par semaine

## Tests

Lancer tous les tests dans l'ordre :

```bash
npm run seed                          # Initialiser la BD
npm start                             # Démarrer le serveur

# Tests fonctionnels
npm run test-simple                   # Annulation basique
npm run test-regle-stricte            # Règle avec exception
npm run test-semaine                  # Limite par semaine
npm run test-appointments             # Structure des RDV
npm run create-test-justificatif      # Justificatif de test
```

**🎯 Le système est maintenant complet avec inscription étudiant, validation des justificatifs, et gestion avancée des rendez-vous !**
