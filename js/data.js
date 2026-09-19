const NIVEAUX = ["Maternelle","CI","CP","CE1","CE2","CM1","CM2","6e","5e","4e","3e","2nde","1ere","Tle"];
const PRENOMS = ["Aïcha","Kokou","Fadilath","Bienvenu","Rahamath","Espoir","Sefako","Latifa","Comlan","Zeynab","Emile","Rachidath","Prudence","Wassiath","Dossou","Fifamè"];
const NOMS = ["Adjovi","Houngbédji","Sossou","Agbossou","Alassane","Da Silva","Kpodjro","Aïhounton","Zannou","Gbaguidi"];

function seedRand(seed){let s=seed;return()=>{s=(s*9301+49297)%233280;return s/233280;};}
const rnd = seedRand(42);

function genStudents(n){
  const arr=[];
  const canaux = ["WhatsApp","SMS","Appel"];
  for(let i=0;i<n;i++){
    const prenom = PRENOMS[Math.floor(rnd()*PRENOMS.length)];
    const nom = NOMS[Math.floor(rnd()*NOMS.length)];
    const niveau = NIVEAUX[Math.floor(rnd()*NIVEAUX.length)];
    const montantDu = [75000,90000,120000,150000][Math.floor(rnd()*4)];
    const fraisConnexeDu = [15000,20000,25000][Math.floor(rnd()*3)];
    const statutRand = rnd();
    let statut, paye, priorite;
    if(statutRand<0.55){statut="a_jour"; paye=montantDu; priorite="aucune";}
    else if(statutRand<0.8){statut="retard_leger"; paye=Math.round(montantDu*0.5); priorite="moyenne";}
    else {statut="retard_critique"; paye=Math.round(montantDu*0.15); priorite="haute";}
    const fraisConnexePaye = rnd()>0.4 ? fraisConnexeDu : Math.round(fraisConnexeDu*0.3);
    arr.push({
      id:i+1, matricule:"MED-"+String(i+1).padStart(4,"0"), nom:prenom+" "+nom, niveau, montantDu, paye,
      reste: montantDu-paye, statut, priorite,
      fraisConnexeDu, fraisConnexePaye, fraisConnexeReste: fraisConnexeDu-fraisConnexePaye,
      retardJours: statut==="a_jour"?0:(statut==="retard_leger"?Math.floor(rnd()*10)+3:Math.floor(rnd()*20)+15),
      canalEfficace: canaux[Math.floor(rnd()*canaux.length)],
      parentTel: "01 "+Math.floor(rnd()*90+10)+" "+Math.floor(rnd()*90+10)+" "+Math.floor(rnd()*90+10)+" "+Math.floor(rnd()*90+10)
    });
  }
  return arr;
}
const students = genStudents(100);

const totalDu = students.reduce((a,s)=>a+s.montantDu,0);
const totalPaye = students.reduce((a,s)=>a+s.paye,0);
const totalReste = totalDu-totalPaye;
const tauxRecouv = Math.round((totalPaye/totalDu)*100);
const critiques = students.filter(s=>s.statut==="retard_critique");
const legers = students.filter(s=>s.statut==="retard_leger");

const totalFraisConnexeDu = students.reduce((a,s)=>a+s.fraisConnexeDu,0);
const totalFraisConnexePaye = students.reduce((a,s)=>a+s.fraisConnexePaye,0);

// ---- Rôles ----
let currentRole = 'fondateur';
const ROLES = {
  fondateur: { label: "Fondateur", classe: null },
  directeur: { label: "Directeur", classe: null },
  secretaire: { label: "Secrétaire", classe: null },
  enseignant: { label: "Enseignant CM1", classe: "CM1" },
};


// ---- Personnel ----
const STAFF = [
  { id:1, matricule:"ENS-0001", nom:"M. Sossou", niveau:"Licence en Lettres Modernes", classes:["CM1"], role:"Enseignant", tel:"01 45 12 33 21", email:"sossou.m@medecon.bj", photo:"" },
  { id:2, matricule:"ENS-0002", nom:"Mme Gbaguidi", niveau:"Master en Mathématiques", classes:["Tle","3e"], role:"Enseignant", tel:"01 67 88 04 12", email:"gbaguidi.m@medecon.bj", photo:"" },
  { id:3, matricule:"ENS-0003", nom:"M. Aïhounton", niveau:"Licence en Histoire-Géographie", classes:["4e","5e"], role:"Enseignant", tel:"01 23 90 44 07", email:"aihounton.m@medecon.bj", photo:"" },
  { id:4, matricule:"ENS-0004", nom:"Mme Da Silva", niveau:"CAP Petite Enfance", classes:["Maternelle","CP"], role:"Enseignant", tel:"01 78 22 61 39", email:"dasilva.m@medecon.bj", photo:"" },
  { id:5, matricule:"SEC-0001", nom:"Mme Adjovi", niveau:"BTS Secrétariat de Direction", classes:[], role:"Secrétaire", tel:"01 55 30 82 14", email:"adjovi.m@medecon.bj", photo:"" },
  { id:6, matricule:"DIR-0001", nom:"M. Kpodjro", niveau:"Master en Sciences de l'Éducation", classes:[], role:"Directeur", tel:"01 40 17 95 62", email:"kpodjro.m@medecon.bj", photo:"" },
  { id:7, matricule:"FON-0001", nom:"Mr Houndji", niveau:"Master en Gestion", classes:[], role:"Fondateur", tel:"01 92 66 08 55", email:"houndji.m@medecon.bj", photo:"" },
];
let staffNextId = 8;

// ---- Emploi du temps ----
const JOURS = ["Lun","Mar","Mer","Jeu","Ven"];
const CRENEAUX = ["8h-9h","9h-10h","10h-11h","11h-12h","15h-16h"];
const ENSEIGNANTS = ["M. Sossou","Mme Gbaguidi","M. Aïhounton","Mme Da Silva"];
const MATIERES = ["Mathématiques","Français","Sciences","Histoire-Géo","Anglais"];
function seedRand2(seed){let s=seed;return()=>{s=(s*9301+49297)%233280;return s/233280;};}
const rnd2 = seedRand2(7);
let scheduleData = [];
JOURS.forEach(j=>{
  CRENEAUX.forEach(c=>{
    if(rnd2()>0.35){
      scheduleData.push({
        jour:j, creneau:c,
        classe: NIVEAUX[Math.floor(rnd2()*8)+2],
        matiere: MATIERES[Math.floor(rnd2()*MATIERES.length)],
        enseignant: ENSEIGNANTS[Math.floor(rnd2()*ENSEIGNANTS.length)],
      });
    }
  });
});
let scheduleView = 'classe';
let scheduleFilter = 'CM1';

// ---- Annonces ----
const announcements = [
  { id:1, auteur:"Mr Houndji", role:"Fondateur", portee:"École entière", titre:"Rentrée décalée au 16 septembre", date:"Il y a 2 jours" },
  { id:2, auteur:"Mme Adjovi", role:"Secrétaire", portee:"École entière", titre:"Cotisation cantine à régler avant le 20", date:"Il y a 4 jours" },
  { id:3, auteur:"M. Sossou", role:"Enseignant CM1", portee:"CM1", titre:"Sortie pédagogique vendredi — prévoir 500 F", date:"Hier" },
  { id:4, auteur:"Mme Gbaguidi", role:"Enseignant Tle", portee:"Tle", titre:"Devoir surveillé de maths reporté à jeudi", date:"Aujourd'hui" },
];


let moneySubTab = 'vue';
let activeClassFilter = 'toutes';

// ---- Nav ----
const SCHOOL_TABS = ['students','staff','grades','schedule','announce'];
let schoolSubSection = 'students';

// ---- Compteur de matricule élève ----
let studentMatriculeCounter = 101;

// ---- Gestion du composant photo (bouton unique + menu déployé, partagé student/staff/settings-logo) ----
const photoData = { student: "", staff: "", "settings-logo": "" };

// ---- Vue parent (desktop et mobile, même fonction) ----
let parentSelectedChild = null;

// ---- Paramètres de l'école (marque blanche) ----
const schoolSettings = {
  nom: "Complexe Scolaire Mèdécon",
  couleur: "#0F4C3A",
  logo: ""
};

