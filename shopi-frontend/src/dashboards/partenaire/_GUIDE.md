# Dashboard Partenaire — React/TS

Dashboard du rôle **partenaire** (apporteur d'acteurs). Pattern
`activePage + PageRenderer`, conforme aux autres dashboards Shopi.

## 📂 Emplacement
```
src/dashboards/partenaire/
├── PartenaireApp.tsx              ← App principale (PageRenderer)
├── components/
│   ├── Sidebar.tsx                ← Menu latéral navy (sections + CTA)
│   ├── Topbar.tsx                 ← Barre haute (titre, signaler, générer)
│   ├── Toast.tsx                  ← useToasts() + <ToastStack/>
│   ├── KpiCard.tsx                ← Carte KPI réutilisable
│   ├── GenerateCodeModal.tsx      ← Modale génération code (2 étapes)
│   └── ReportModal.tsx            ← Modale signalement utilisateur
├── pages/
│   ├── OverviewPage.tsx           ← Héro + palier + KPIs + graphe + activité
│   ├── CodesPage.tsx              ← Codes de création (stats + historique)
│   ├── ActeursPage.tsx            ← Acteurs recrutés (grille filtrable + signaler)
│   ├── CommissionsPage.tsx        ← Solde + taux + historique
│   ├── SignalementsPage.tsx       ← Sécurité : bandeau + stats + liste
│   └── PlaceholderPage.tsx        ← Pages à brancher (invitations, paiements, stats, paramètres)
├── hooks/
│   └── usePartenaireState.ts      ← activePage + modales + génération code + signalement
├── data/
│   ├── types.ts                   ← PartenairePage, ActeurType, CreationCode, Signalement...
│   └── partenaireData.ts          ← Données mock + fmtGnf + TYPE_LABEL/ICON
└── styles/                        ← Un .module.css par composant/page (13 fichiers)
```

## 🔌 Branchement (router.tsx)
La route `/dashboard/partenaire/*` est déjà prévue. Remplace le placeholder :
```tsx
// avant : dashboards/partenaire/PartenaireApp.tsx (placeholder minimal)
// après : ce dossier complet — l'export default reste <PartenaireApp/>
```
Aucune prop requise (comme les autres dashboards) : l'app gère son propre état.

## 🎨 Styles
- **Variables globales** (`styles/variables.css`) : `--navy`, `--blue`, `--violet`,
  polices Fraunces/DM Sans — **jamais redéclarées** ici.
- Un CSS Module par composant, dans `styles/`.
- Imports : `pages/ → '../styles/X.module.css'`, `PartenaireApp → './styles/...'`.

## ⚙️ Backend à brancher (hooks/usePartenaireState.ts + data/partenaireData.ts)
```
POST /partenaire/codes              { type, destinataire } → { code }
GET  /partenaire/codes              → liste des codes
GET  /partenaire/acteurs            → acteurs recrutés
GET  /partenaire/commissions        → solde + lignes
POST /partenaire/signalements       { cible, motif, gravite, description } → { ref }
GET  /partenaire/signalements       → mes signalements
```
Le rattachement acteur↔partenaire se fait à la création de compte via le code
(côté auth : le code SHOPI-XXX-YYYYY lie le nouveau compte au partenaire émetteur).

## ✅ Fonctionnalités
- Génération de codes de création (Entreprise/Livreur/Correspondant/Client) + envoi WhatsApp/SMS/Copier
- Pilotage du réseau recruté (grille filtrable, commissions par acteur)
- **Signalement d'utilisateurs malveillants** (motif + gravité + description + suivi du traitement)
- Commissions + palier partenaire (Or → Platine)
