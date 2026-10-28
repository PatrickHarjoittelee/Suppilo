# ETJ-sopimuslinkki Suppilosta

Yritys- ja yhteyshenkilökortin **ETJ-sopimuslinkki** avaa tarkistuslomakkeen.
Valitse oikea yhteyshenkilö ja tarkista palvelut, määrät, pinta-ala ja lisätiedot.
**Jatka ETJ:hin** avaa ETJ:n nykyisen tilauslinkkilomakkeen esitäytettynä.
Kirjaudu ETJ:hin tarvittaessa ylläpitäjän tunnuksella ja vahvista lähetys siellä.
Pidä Suppilon välilehti auki, jotta luotu linkki ja sähköpostin lähetystulos
voidaan tallentaa alkuperäisen yritystilin historiaan.

Jos historian tallennus epäonnistuu, lomake näyttää luodun linkin ja
**Tallenna historiaan uudelleen** -painikkeen. Se yrittää vain historian
tallennusta, eikä luo uutta asiakaskoodia tai lähetä uutta sähköpostia.
Jos selain estää uuden välilehden, salli ponnahdusikkunat Suppilolle.
Jos suljet Suppilon tai kirjautuminen katkaisee välilehtien yhteyden,
linkin voi kopioida ETJ:n tulosnäkymästä. Älä lähetä uudelleen vain historian takia.

## Julkaisujärjestys

1. Julkaise ensin ETJ-repon muutos: `dashboard/suppilo-order.js` ja sitä
   käyttävä `dashboard/etj-plus.html`.
2. Julkaise sitten Suppilon `crm.html` ja `etj-contract.js`.
3. Testaa kirjautuminen ja linkin lähetys sovittuun sisäiseen testiosoitteeseen
   tuotannon asetuksilla sekä historian tallennus oikeaan yritystiliin.

Integraatio käyttää olemassa olevaa ETJ:n `/leads/send-link`-rajapintaa
ETJ:n omassa alkuperässä. Rajapinnan CORS- tai Entra-redirect-asetuksia
ei tarvitse laajentaa tätä toteutusta varten. ETJ tarkistaa edelleen
ylläpitäjäoikeuden. Tunnisteita, avaimia tai käyttöoikeustunnuksia ei siirretä
Suppiloon. URL-fragmentissa kulkee vain satunnainen pyyntötunniste;
asiakastiedot siirtyvät rajatulla `postMessage`-yhteydellä.

Sallitut alkuperät ovat Suppilossa `https://etj.sparaenergia.com` ja ETJ:ssä
`https://patrickharjoittelee.github.io`. Jos Suppilon domain vaihtuu,
päivitä ETJ:n sallittu alkuperä. Vastaanottajat tarkistavat lisäksi lähettävän
ikkunan ja pyyntötunnisteen. Keskeneräinen yhteys vanhenee 30 minuutissa.

## Toimintotestit

Pidä tämän PR:n Suppilo ja vastaavan PR:n ETJ rinnakkaisissa `Suppilo/`-
ja `ETJ/`-hakemistoissa. Vaihtoehtoinen ETJ:n dashboard-hakemisto annetaan
ympäristömuuttujalla `ETJ_DASHBOARD_DIR`.

```sh
npm --prefix tests ci
npm --prefix tests test
```

Testit käyttävät jsdomia sekä ETJ:n oikeita lomake- ja lähetysfunktioita.
ETJ-rajapinta ja CRM-tallennus korvataan testeissä simulaatioilla. Oikeita
sähköposteja ei lähetetä. Testit kattavat tietojen siirron, palveluvalinnat,
valitun henkilön puuttuvat tiedot, kirjautumisen yli säilyvän yhteyden,
väärän alkuperän/ikkunan hylkäämisen, asiakasroolin eston, historian
uudelleentallennuksen ja tavallisen ETJ-lomakkeen erottamisen CRM-pyynnöstä.
