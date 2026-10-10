// UI and subtitle translations. Nepali remains romanized in the source strings.
export const introLinesEn = [
  'A sad story.',
  'There once was a small village blanketed in snow.',
  'A Bahun named Hari, with a ponytail and no topi, lived there.',
  'The city’s greed began to reach into the quiet village.',
  'The villagers feared rumors that Maoists would come.',
  "Muna, Hari's crush, lived in the village too.",
  'One day, while Hari meditated, Maoists arrived and took Muna.',
  'Hari later learned what had happened. Rage churned within him.',
  'He went home, took his grandfather’s khukuri from the drawer, and set out.',
  'Can he save Muna?'
];

const en = new Map([
  ['Hari dhalyo... (R)','Hari has fallen... (R)'],
  ['Hari hindyo — Munako khojima.','Hari sets out to find Muna.'],
  ['Gaunko rakshaklai pahadka devataharule pahilai chinisakeka chhan.','The mountain gods already know the one who will guard this village.'],
  ['Mantri: "Bajet khaeko manchhelai marchhas?!"','Minister: “You’ll kill someone for stealing the budget?!”'],
  ['Mantri: "Ta marchhas! Ma sadhain banchhu!!!"','Minister: “You will die! I will live forever!”'],
  ['Mantri: "Yo gaun ra pahad aba saharko sampatti ho."','Minister: “This village and mountain belong to the city.”'],
  ['Mantri: "Aaja, gaunko rakshak. Aau timro bhagya heraun!"','Minister: “Come, village guardian. Let us test your prophecy!”'],
  ['Mantri: "Farkera jaau. Yo timro yuddha hoina!"','Minister: “Turn back. This fight is not yours!”'],
  ['Mantri: "Timro gaunle malai rokna sakdaina!"','Minister: “Your village cannot stop me!”'],
  ['Mantri: "Aba yo pahad nai mero ayudh ho!"','Minister: “Now the mountain itself is my weapon!”'],
  ['Mantri parasta! Munalai fukau.','The minister is defeated! Untie Muna.'],
  ['Mantri parasta!','The minister is defeated!'],
  ['Hari: "Muna! Ma aye! Maile mantri ko Satyanas gare Aba Hamro maya lai kosaile rokna sakdaina"','Hari: “Muna! I am here! I defeated the minister. Nothing can stop our love now.”'],
  ['Muna: "Hari Dhanyabad ... tara... timilai euta kura bhannu cha."','Muna: “Thank you, Hari... but... I have something to tell you.”'],
  ['Muna: "Timro maya ma suikarna sakdina — mero mutu arkaisanga cha."','Muna: “I can’t accept your love—my heart belongs to someone else.”'],
  ['Hari: "Ke?! Arko... ko?!"','Hari: “What?! Someone else... who?!”'],
  ['Muna: "Raju!"','Muna: “Raju!”'],
  ['Raju: "Ke chaaaa mero baaby — hinda na, Kathmandu jaaun kina late garira"','Raju: “There you are, baby! Come on, let’s go to Kathmandu. Why are we late?”'],
  ['Muna: "La hus Hari! Bheti rakhumla! Au Raju Jum"','Muna: “All right, Hari! See you around! Come on, Raju, let’s go.”'],
  ['Hari: "...muji."','Hari: “...muji.”'],
  ['Hari: "Ko hos ta? Ma bata Muna chorne? Feri?!"','Hari: “Who are you? Stealing Muna from me again?!”'],
  ['Raju: "Ae! Ke gareko?!"','Raju: “Hey! What did you do?!”'],
  ['Muna: "Hari! Timile Raju lai kina hanyo?!"','Muna: “Hari! Why did you hit Raju?!”'],
  ['Muna: "Ma timisanga jadina! Raju, jau!"','Muna: “I’m not going with you! Raju, let’s go!”']
]);

export function subtitleText(text,language){
  return language==='en' ? (en.get(text)||text) : text;
}
