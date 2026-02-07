# YieldPro RMS - Documentation de Migration & Mapping Data

## 📋 Plan d'Action Stratégique
Ce document détaille les étapes pour migrer l'intelligence métier de l'ancienne version (index.com) vers la nouvelle architecture React/Supabase.

### 1. Phase de Consolidation Back-end
- Liaison dynamique entre les widgets du dashboard et les tables Supabase.
- Mise en place de vues SQL pour agréger les KPIs (RevPAR, ADR, Occupancy) en temps réel.
- Nettoyage automatique des données lors des imports Excel.

### 2. Migration de l'Algorithme "YieldPro"
- Porter les règles de calcul (Triggers) dans le hook `useRMSCalculations.ts`.
- Implémentation des multiplicateurs basés sur l'indice d'impact des événements.
- Gestion des seuils d'occupation dynamiques.

---

## 🗺️ Mapping des Données Supabase

### A. Performance Financière
- **Table**: `booking_export`
- **Mapping**:
    - `Montant total` ⮕ Revenue global.
    - `Nuits` ⮕ Calcul de l'ADR.
    - `Etat` ⮕ Filtrage des confirmations.

### B. Inventaire
- **Table**: `disponibilites`
- **Mapping**:
    - `disponibilites` ⮕ Chambres restantes (utilisé pour Occ %).
    - `ferme_a_la_vente` ⮕ Statut "Clos out".

### C. Intelligence Marché
- **Table**: `booking_apercu`
- **Mapping**:
    - `Votre hôtel le plus bas` ⮕ BAR (Best Available Rate).
    - `médiane du compset` ⮕ Référence marché.
    - `Demande du marché` ⮕ Indice de pression (1-10).

### D. Benchmarking Concurrence
- **Table**: `booking_tarifs`
- **Mapping**: Colonnes dynamiques par hôtel du compset (Madeleine, Arcade, Cordelia, etc.).

---

## 🎨 Guide de Style & Branding
- **Branding**: YieldPro RMS (Boutons, Logos, Graphiques).
- **Thème**: Strategic Dark (Slate-950) pour le Header et la Sidebar.
- **Charts**: YieldPro Smart Recommendation (BAR vs Compset vs Reco).
