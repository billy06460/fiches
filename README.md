# PREJ Missions

Une seule application Android qui regroupe :
- la **décision de fouille individuelle** (une page par personne détenue),
- la **fiche retour mission**,
- le **carnet de bord** (fiche véhicule + photos).

## Fonctionnement
1. Au lancement : **Créer une nouvelle mission** (numéro, date, chauffeur, chef d'escorte, 1 agent contact + jusqu'à 4 de plus).
2. Ces informations remplissent automatiquement les trois documents.
3. Sur la page de la mission : signer une fois (signature reprise dans la fouille et la fiche retour), puis ouvrir chaque document pour finir de le remplir. Un ✓ apparaît quand il est complet.
4. Sur l'accueil : toucher le rond de la **mission du jour**, puis **Valider et envoyer les PDF**. Chaque document part dans son propre MMS, sans ouvrir Messages.

## Construire l'APK avec GitHub
1. Créer un dépôt GitHub, y envoyer **tout le contenu** de ce dossier (y compris le dossier caché `.github`).
2. Onglet **Actions** → « Construire l'APK » se lance tout seul (sinon **Run workflow**).
3. Au premier passage, une clé de signature est créée et ajoutée au dépôt : les versions suivantes pourront être installées **par-dessus** sans perdre les missions.
4. Après 5 à 10 minutes : ouvrir l'exécution terminée → **Artifacts** → `PREJ-Missions-apk` → dézipper → `app-debug.apk`.

## Installation sur le téléphone
1. Copier l'APK sur le téléphone et l'ouvrir (autoriser l'installation d'applications inconnues).
2. C'est une **nouvelle application** : elle s'installe à côté des anciennes (fouille, carnet de bord).
3. Activer l'envoi automatique : bandeau **Activer** sur l'accueil → **Ouvrir les réglages** → menu **⋮** → **Autoriser les paramètres restreints** → revenir dans l'appli → **Autoriser** les SMS.

## Réglages (roue dentée)
- Adresses @justice.fr pour la fouille et la fiche retour.
- Carnet de bord : **Paramètres responsable**, mot de passe **1402** (2 adresses, unité, couleur du PDF).
- Ma signature et ma qualité, valeurs par défaut de la fouille, thème et couleur, journal des envois.

## Si un envoi échoue
La fenêtre d'envoi propose pour chaque document : **Messages** (ouvre l'appli SMS avec le PDF, adresse copiée) ou **Partager** le PDF.
Vérifier que les données mobiles sont activées et que l'opérateur autorise les MMS vers une adresse e-mail.
