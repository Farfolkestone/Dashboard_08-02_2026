# Guide de calibrage Yield - Application RMS Hôtel (45 chambres)

## 1) Objectif
Ce guide aide à calibrer les paramètres de l'application pour produire des **tarifs suggérés robustes**.
Le principe est de combiner:
- demande du marché
- positionnement concurrentiel
- niveau de remplissage attendu
- contraintes commerciales (OTA, commissions, promotions)

## 2) Données minimales à fiabiliser
Vérifier en priorité:
- `booking_export`: dates d'arrivée/de départ, montant total, statut, type de chambre, origine
- `booking_apercu`: `Votre hôtel le plus bas`, `médiane du compset`, `Demande du marché`
- `booking_tarifs`: tarifs concurrents par date (ignorer les valeurs `0`, tarif inconnu)
- `planning_tarifs`: grilles et plans OTA exploités pour la simulation

## 3) Paramétrage de base recommandé (45 chambres)
- Fenêtre de pilotage: `Semaine` et `1 mois` pour l'opérationnel, `3 mois` pour la tendance
- Annulations: masquées par défaut, puis contrôle complémentaire avec filtre
- Seuils de demande (Demande du marché):
  - Vert: `< 45%`
  - Orange: `45% - 69%`
  - Rouge: `>= 70%`

## 4) Logique de tarif suggéré (recommandée)
1. Calculer la base interne:
   - tarif moyen prévu = montant / (chambres * nuits)
2. Mesurer l'écart marché:
   - comparer au `plus bas concurrent` et à la `médiane compset`
3. Appliquer la pression demande:
   - demande forte + stock limité => hausse progressive
   - demande faible + écart trop haut vs compset => ajustement baissier contrôlé
4. Encadrer les bornes:
   - plancher (coût + marge minimale)
   - plafond (acceptabilité marché/segment)

## 5) Règles métier intégrées
- Type de chambre `Deux Chambres Adjacentes ...` compte pour **2 chambres minimum**
- Tarif concurrent `0` = inconnu, **exclu** des calculs
- Prix moyen utilisé: `montant / (chambres * nuits)` avec fallback nuits via `départ - arrivée`

## 6) Calibration par saison
- Basse saison:
  - prioriser l'occupation
  - élasticité plus forte
  - promotions contrôlées (remises totales)
- Haute saison / pics:
  - prioriser ADR net
  - limiter les remises
  - revaloriser sur les jours rouges

## 7) OTA et commissions
En simulation:
- activer/désactiver la commission OTA
- vérifier l'impact sur le `Total net`
- comparer remises `par nuit` vs `sur total`

Recommandation:
- arbitrer avec le **net** après commission, pas le brut

## 8) Routine hebdomadaire conseillée
- Lundi: revue 30 jours (demande, écart compset, stock)
- Mercredi: ajustements fins (segments/OTA)
- Vendredi: verrouillage week-end + événements

## 9) Alertes à surveiller
- Jours rouges avec prix interne sous le plus bas concurrent
- Forte demande et trop d'inventaire encore ouvert
- Chute brutale du net après remise + commission
- Données incomplètes (dates manquantes, tarifs 0 massifs)

## 10) Checklist avant publication tarif
- Données fraîches (bouton rafraîchir)
- Date de début / fin correctes
- Vue jour/plage vérifiée
- Comparaison `plus bas concurrent` et `médiane compset`
- Validation du net (commission/remise)

---
Version: 1.1
