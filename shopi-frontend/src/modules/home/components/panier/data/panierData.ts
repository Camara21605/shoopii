/*
 * ============================================================
 * FICHIER : src/modules/home/components/panier/data/panierData.ts
 *
 * RÔLE    : Référentiels et utilitaires de la page commande.
 *           (Les anciennes listes fictives — articles, livreurs,
 *           correspondants, adresses, vitesses — ont été retirées : la page
 *           n'utilise que des données réelles.)
 * ============================================================
 */

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
