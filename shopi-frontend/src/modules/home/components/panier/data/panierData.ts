/*
 * ============================================================
 * FICHIER : src/modules/home/components/panier/data/panierData.ts
 *
 * RÔLE    : Types + données mock pour la page commande/panier.
 *           Remplacer par appels API (GET /panier, GET /livreurs…)
 * ============================================================
 */

export interface CartItem    { id:number; em:string; name:string; shop:string; price:number; old:number|null; qty:number; vt:string; }
export interface Livreur     { id:number; em:string; nm:string; zn:string; rt:string; tr:string; on:boolean; base:number; src:'both'|'c'|'b'; }
export interface Correspondant{ id:number; em:string; nm:string; rg:string; tp:string; rt:string; fee:number; }
export interface Speed        { m:number; l:string; e:string; }
export interface AdresseEnr   { id:string; icon:string; label:string; ville:string; detail:string; }
export interface PayMode      { id:string; icon:string; nm:string; sub:string; }

export const CART_ITEMS: CartItem[] = [
  { id:1, em:'📱', name:'iPhone 15 Pro 256GB',  shop:'TechStore Conakry', price:12500000, old:14000000, qty:1, vt:'Titanium · 256GB' },
  { id:2, em:'🎧', name:'Sony WH-1000XM5',      shop:'TechStore Conakry', price:2100000,  old:2600000,  qty:1, vt:'Noir · ANC'       },
  { id:3, em:'🔌', name:'Chargeur MagSafe 15W', shop:'TechStore Conakry', price:350000,   old:null,     qty:2, vt:'Blanc'            },
];

export const LIVREURS: Livreur[] = [
  { id:1, em:'🛵', nm:'Mamadou Diallo',  zn:'Kaloum · Dixinn',  rt:'4.9', tr:'1 240', on:true,  base:20000, src:'both' },
  { id:2, em:'🚴', nm:'Fatoumata K.',    zn:'Ratoma · Matoto',  rt:'4.8', tr:'987',   on:true,  base:18000, src:'c'    },
  { id:3, em:'🚗', nm:'Ibrahima Sylla',  zn:'Matam · Commune',  rt:'4.7', tr:'2 100', on:false, base:22000, src:'b'    },
  { id:4, em:'🛵', nm:'Kadiatou Mariam', zn:'Conakry Centre',   rt:'5.0', tr:'3 400', on:true,  base:15000, src:'both' },
];

export const CORRESPONDANTS: Correspondant[] = [
  { id:1, em:'👨‍💼', nm:'Amadou Bah',     rg:'Conakry', tp:'Régional', rt:'4.9', fee:35000 },
  { id:2, em:'👩‍💼', nm:'Mariama Diallo', rg:'Conakry', tp:'Local',    rt:'4.8', fee:30000 },
];

export const SPEEDS: Record<string, Speed> = {
  eco: { m:1.0, l:'Économique 🐢', e:'3–4h'   },
  std: { m:1.3, l:'Standard 🚴',   e:'1–2h'   },
  exp: { m:1.8, l:'Express 🚀',    e:'45 min' },
  ult: { m:2.5, l:'Ultra ⚡',      e:'20 min' },
};

export const ADRESSES: AdresseEnr[] = [
  { id:'home', icon:'fa-house',     label:'Domicile', ville:'Kaloum, Conakry', detail:'Quartier Almamya' },
  { id:'work', icon:'fa-briefcase', label:'Bureau',   ville:'Ratoma, Conakry', detail:'Cité ministère'   },
];

export const PAY_MODES: PayMode[] = [
  { id:'omo',    icon:'🏦', nm:'Orange Money',  sub:'Paiement mobile'    },
  { id:'mtn',    icon:'💛', nm:'MTN Money',     sub:'Paiement mobile'    },
  { id:'card',   icon:'💳', nm:'Carte bancaire', sub:'Visa / Mastercard' },
  { id:'cash',   icon:'💵', nm:'À la livraison', sub:'Espèces'           },
  { id:'wire',   icon:'🏛️', nm:'Virement',      sub:'Banque locale'      },
  { id:'wallet', icon:'👛', nm:'Wallet Shopi',   sub:'Solde : 85 000 GNF'},
];

export const VILLES = [
  {value:'conakry',label:'Conakry'},{value:'kindia',label:'Kindia'},
  {value:'boke',label:'Boké'},{value:'labe',label:'Labé'},
  {value:'kankan',label:'Kankan'},{value:'nzerekore',label:'Nzérékoré'},
];

export const COMMUNES: Record<string,{value:string;label:string}[]> = {
  conakry:[
    {value:'kaloum',label:'Kaloum'},{value:'dixinn',label:'Dixinn'},
    {value:'matam',label:'Matam'},{value:'ratoma',label:'Ratoma'},{value:'matoto',label:'Matoto'},
  ],
  kindia:[{value:'kindia',label:'Kindia'}], boke:[{value:'boke',label:'Boké'}],
  labe:[{value:'labe',label:'Labé'}], kankan:[{value:'kankan',label:'Kankan'}],
  nzerekore:[{value:'nzerekore',label:'Nzérékoré'}],
};

export const fmt = (n:number) => n.toLocaleString('fr') + ' GNF';
export const lvFeeCalc = (base:number, mul:number) => Math.round(base * mul / 1000) * 1000;
