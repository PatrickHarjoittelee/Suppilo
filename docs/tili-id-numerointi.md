# Tilien ID-numerointi

Kaikki crm.html:n tilinluontipolut käyttävät samaa laskentaa: manuaalinen
Lisää tili, yhden ChatGPT-ehdokkaan esitäytetty lomake, JSON/TXT-erätuonti,
älykäs eräprospektointi, signaaliseurannan uudet liidit ja yhteyshenkilölomake.
Tuonnissa annettua ID:tä ei käytetä tilin tunnisteena.

Jokainen tallennus lukee Google Sheetsistä koko `Tilit!A:A`-sarakkeen.
Lisäksi luetaan tilirivit puuttuvien tunnisteiden tarkistamiseksi sekä
`Tili-ID-historia`, `CRM-tila!A:A` ja `Yhteyshenkilöt!B:B` aiempien
tunnisteiden säilyttämiseksi. Selaimen tililistan viimeinen tai suurin ID ei
määrää seuraavaa numeroa. Rivijärjestyksellä ei ole merkitystä.

Normaalin sarjan suurinta tunnettua numeroa kasvatetaan yhdellä. Käyttäjän
toimittamassa lähtöhistoriassa sarja ulottuu vähintään tunnisteeseen
`ID20260517`; tätä pienempiä numeroita tai sarjan aukkoja ei oteta uudelleen
käyttöön. Numero ei ole päivämäärä eikä laskuri nollaudu vuodenvaihteessa.

Täsmälleen seitsemän korjaustunnistetta `ID20269901`–`ID20269907` ovat
pysyvästi varattuja, mutta ne eivät nosta normaalin sarjan laskuria.
Jos normaali suurin tunniste on `ID20260517`, seuraavat ovat
`ID20260518`, `ID20260519` jne. Jos Sheetsissä tai historiassa on suurempi
normaali tunniste, jatketaan siitä. Kun normaali sarja aikanaan saavuttaa
korjausnumerot, ne ohitetaan: `ID20269900` → `ID20269908`.

Erässä annetaan peräkkäiset vapaat numerot yhdellä laskennalla. Tili,
CRM-tila ja yhteyshenkilöt saavat samat viittaustunnisteet. Kokonaan tyhjät
rivit sallitaan, mutta uusia tilejä kirjoitetaan viimeisen käytetyn rivin
jälkeen. Tietoja sisältävä rivi ilman ID:tä, virheellinen ID tai nykyisten
tilien duplikaatti pysäyttää lisäyksen ennen kirjoituksia.

Ensimmäinen lisäys tai poisto luo tarvittaessa `Tili-ID-historia`-välilehden.
Se säilyttää tunnisteet myös tilin poiston jälkeen. Historia kirjoitetaan
ennen tilin luontia tai poistamista. Jos tilikirjoitus epäonnistuu, numero
jää varatuksi ja seuraava yritys saa uuden numeron. Tämä voi jättää aukon.
Jos historian lukeminen tai kirjoittaminen epäonnistuu, tiliä ei luoda eikä
poisteta. Historiaa ei saa tyhjentää tai poistaa.

Ennen tämän korjauksen käyttöönottoa kokonaan kaikista lähteistä hävitettyjä
tunnisteita ei voi palauttaa nykyisestä A-sarakkeesta. Lähtötason 60517
alapuoliset aukot säilyvät varattuina; sitä suuremmat vanhat poistot
huomioidaan, jos ne löytyvät CRM-tilasta, yhteyshenkilöviittauksista tai
historiasta. Jos vanha poistettu suurin normaali numero oli tätäkin suurempi
eikä siitä ole mitään jälkeä, se täytyy palauttaa historiaan varmuuskopiosta
ennen käyttöönottoa. Tässä muutoksessa ei lueta eikä muuteta tuotanto-CRM:ää.

Ratkaisu on yhden käyttäjän malli. Saman sivun tallennukset tehdään jonossa,
mutta erillisten välilehtien samanaikaisille kirjoituksille ei rakenneta
hajautettua lukitusta. Jokainen tallennus lukee lähdetiedot uudelleen.

Testit: `cd tests` ja `npm run test:account-ids`. Testit käyttävät paikallista
Sheets-jäljitelmää eivätkä ota yhteyttä Googleen tai lähetä sähköposteja.
