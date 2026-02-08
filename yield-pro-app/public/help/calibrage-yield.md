# Guide de calibrage Yield - Application RMS Hotel (45 chambres)

## 1) Objectif
Ce guide aide à calibrer les paramètres de l'application pour produire des **tarifs suggérés robustes**.
Le principe est de combiner:
- demande du marché
- positionnement concurrentiel
- niveau de remplissage attendu
- contraintes commerciales (OTA, commissions, promotions)

## 2) Donnees minimales a fiabiliser
Verifier en priorite:
- `booking_export`: dates d'arrivee/depart, montant total, statut, type chambre, origine
- `booking_apercu`: `Votre hôtel le plus bas`, `médiane du compset`, `Demande du marché`
- `booking_tarifs`: tarifs concurrents par date (ignorer les valeurs `0`, tarif inconnu)
- `planning_tarifs`: grilles et plans OTA exploites pour simulation

## 3) Parametrage de base recommande (45 chambres)
- Fenetre pilotage: `Semaine` et `1 mois` pour l'operationnel, `3 mois` pour la tendance.
- Annulations: masquées par defaut, puis controle complementaire avec filtre.
- Seuils demande (Demande du marché):
  - Vert: `< 45%`
  - Orange: `45% - 69%`
  - Rouge: `>= 70%`

## 4) Logique tarif suggere (recommandee)
1. Calculer la base interne:
   - tarif moyen prevu = montant / (chambres * nuits)
2. Mesurer l'ecart marche:
   - comparer au `plus bas concurrent` et a la `médiane compset`
3. Appliquer pression demande:
   - demande forte + stock limite => hausse progressive
   - demande faible + ecart trop haut vs compset => ajustement baissier controle
4. Encadrer les bornes:
   - plancher (cout + marge mini)
   - plafond (acceptabilite marche/segment)

## 5) Regles metier deja integrees
- Type chambre `Deux Chambres Adjacentes ...` compte pour **2 chambres minimum**.
- Tarif concurrent `0` = inconnu, **exclu** des calculs.
- Prix moyen utilise: `montant / (chambres * nuits)` avec fallback nuits via `depart - arrivee`.

## 6) Calibration par saison
- Basse saison:
  - prioriser occupation
  - elasticite plus forte
  - promotions controlees (remises total)
- Haute saison / pics:
  - prioriser ADR net
  - limiter remises
  - revaloriser sur jours rouges

## 7) OTA et commissions
En simulation:
- activer/desactiver la commission OTA
- verifier impact sur `Total net`
- comparer remises `par nuit` vs `sur total`

Recommandation:
- arbitrer avec le **net** apres commission, pas le brut.

## 8) Routine hebdomadaire conseillee
- Lundi: revue 30 jours (demande, ecart compset, stock)
- Mercredi: ajustements fins (segments/OTA)
- Vendredi: verrouillage week-end + evenements

## 9) Alertes a surveiller
- Jours rouges avec prix interne sous plus bas concurrent
- Forte demande et trop d'inventaire encore ouvert
- Chute brutale du net apres remise+commission
- Donnees incomplètes (dates manquantes, tarifs 0 massifs)

## 10) Checklist avant publication tarif
- Donnees fraiches (bouton rafraichir)
- Date debut/fin correctes
- Vue jour/plage verifiee
- Comparaison `plus bas concurrent` et `médiane compset`
- Validation net (commission/remise)

---
Version: 1.0
