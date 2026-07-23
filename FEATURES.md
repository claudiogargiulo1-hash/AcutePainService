# APS Manager — Funzionalità Implementate

App mobile React Native / Expo per team ospedalieri di Acute Pain Service.
Piattaforme: **iOS** (primaria) e Android.
Lingua UI: **italiano** (default) + inglese.
Backend: **Supabase** (PostgreSQL, Auth, Edge Functions, Storage).

---

## Note di rilascio

### 1.2.0
- Il calcolo del rischio CPSP (dolore cronico post-chirurgico) ora avviene **server-side** tramite l'edge function `compute-cpsp-risk`, non più con una formula calcolata in locale: web e iOS usano esattamente la stessa formula.
- **Conseguenza pratica**: lo scoring richiede connessione di rete. Se la chiamata fallisce, i dati clinici della valutazione vengono comunque salvati regolarmente — il punteggio resta da calcolare e si può rigenerare in un secondo momento con il pulsante **"Riprova calcolo"**. Non è un bug, è il comportamento atteso in assenza di rete.
- Messaggi d'errore distinti in `CPSPScreen`: calcolo fallito per problemi di rete → "Calcolo non riuscito: verifica la connessione e riprova."; sessione scaduta (401) → "Sessione scaduta: effettua di nuovo il login."

---

## Architettura di navigazione

```
AppNavigator
├── OnboardingScreen          ← prima apertura, senza login
└── Stack (con tenant)
    ├── [non autenticato]
    │   ├── LoginScreen
    │   └── RegisterScreen    ← senza login
    └── [autenticato]
        ├── MainTabs
        │   ├── Dashboard
        │   ├── Pazienti
        │   ├── Notifiche
        │   └── Profilo
        ├── PatientDetail
        ├── AddPatient
        ├── NRSEntry          (modal)
        ├── AddIntervention   (modal)
        ├── Export
        ├── Stats
        ├── Opioid
        └── Users
```

### Gestione tenant (multi-ospedale)
- `tenant_code`, `tenant_id`, `tenant_name` salvati in `AsyncStorage`
- `TenantContext` espone `clearTenant()` per resettare a `OnboardingScreen` senza riavvio
- Ogni avvio controlla la presenza del codice tenant prima di mostrare il login

### Ruoli utente

| Ruolo | Permessi |
|---|---|
| `admin` | Tutto: pazienti, NRS, interventi, utenti, export, elimina DB |
| `medico` | Pazienti, NRS, interventi, dimissioni, eliminazioni |
| `infermiere` | Pazienti, NRS, eliminazione NRS |
| `paziente` | Sola lettura |

---

## Schermate

### 1. OnboardingScreen
Prima configurazione dell'app. Tre modalità selezionabili.

**Modalità scelta** (default)
- Card "Accedi a database esistente"
- Card "Crea nuovo database"

**Modalità accesso**
- Lista database disponibili recuperata da `manage-tenants` (`action: list`) con selezione rapida
- Campo codice manuale (auto-uppercase)
- Campo password database
- Pulsante **Accedi →** → verifica con `action: verify` → salva in `AsyncStorage`
- Link **"Password database dimenticata?"** → `Alert.prompt` iOS nativo → invia codice → `action: forgot_db_password` → Alert con l'email dell'amministratore a cui è stato inviato il link

**Modalità creazione**
- Nome ospedale *
- Password database * + conferma * (le due devono coincidere)
- Selezione reparti con chip multipli: Ortopedia, Chirurgia Generale, Ginecologia, Urologia, Toracica, Neurochirurgia, Vascolare, Cardiochirurgia, ORL, Oculistica, Maxillofacciale, Traumatologia, Pediatria, Altro (min 1 obbligatorio)
- Account amministratore: nome *, cognome *, email *, password *
- Crea via `action: create`
- **Schermata di successo**: mostra il codice database generato con invito a conservarlo

---

### 2. LoginScreen
Autenticazione con tre modalità selezionabili da tab switcher.

**Modalità Password**
- Campo email + campo password
- Pulsante login con spinner
- Link **"Password dimenticata?"** → richiede email compilata → `supabase.auth.resetPasswordForEmail` con `redirectTo: https://claudiogargiulo1-hash.github.io/aps-web` → Alert di conferma invio
- Link **"Non hai un account? Registrati"** → naviga a `RegisterScreen`

**Modalità PIN**
- Display visivo 6 punti (pieni/vuoti)
- Tastierino numerico 3×4 con tasto ⌫
- Auto-submit quando il 6° cifra viene inserito (con setTimeout 100ms)

**Modalità Biometrica** (visibile solo se disponibile sul device)
- Face ID / Touch ID via `expo-local-authentication`
- Credenziali cached in `expo-secure-store`
- Grande pulsante circolare 👁 con spinner durante verifica

**Comune**
- Toggle lingua 🇮🇹 IT / 🇬🇧 EN in alto a destra (posizione assoluta)
- Timeout sessione automatico 30 minuti con auto-signout

---

### 3. RegisterScreen
Richiesta accesso per nuovi utenti — **accessibile senza login**.

| Campo | Note |
|---|---|
| Codice Database * | Auto-uppercase |
| Nome * | Capitalizzato |
| Cognome * | Affiancato al Nome in riga doppia |
| Email * | Validazione regex, keyboard email |
| Reparto | Opzionale |
| Messaggio | Opzionale, textarea multiriga |

- Chiama `manage-users` con `action: register` usando solo l'anon key (nessuna sessione richiesta)
- Validazione email lato client prima dell'invio
- Alert di successo con testo esplicativo → `navigation.goBack()` a LoginScreen
- Link "Hai già un account? **Accedi**" in fondo

---

### 4. DashboardScreen
Panoramica operativa — **tab principale**.

**Header**
- Emoji saluto contestuale: ☀️ (mattina) / 🌤 (pomeriggio) / 🌙 (sera)
- Data corrente formattata in italiano
- Avatar con iniziali utente
- Pulsante 📈 → `StatsScreen`

**4 card statistiche** (griglia 2×2)
- 🏥 Pazienti attivi
- 🔴 NRS elevato (>6) — bordo rosso se >0
- ⚠️ Rilevazioni mancanti — bordo giallo se >0
- 📋 Rilevazioni totali oggi

Logica "mancante": per ogni paziente, conta gli slot orari dell'intervento già passati e confronta con le rilevazioni effettuate oggi.

**Lista pazienti** (max 8, ordinati per NRS decrescente)
- Dot colorato stato: verde (ok) / giallo (mancante) / rosso (NRS>6)
- Nome, reparto, letto, numero ricovero
- Ultimo intervento chirurgico (se presente)
- Badge "⚠️ Rilevazione mancante" se slot passato senza misura
- Badge NRS circolare colorato con valore
- Pulsante **+ NRS** → apre `NRSEntryScreen` come modal
- "Vedi tutti" → `PatientsScreen`

**Pull-to-refresh** con `RefreshControl`

---

### 5. PatientsScreen
Lista completa pazienti — **tab principale**.

**Header**
- Toggle **Attivi / Dimessi** (ricarica lista)
- Pulsante **+ Aggiungi paziente** (medico / infermiere / admin)

**Barra ricerca**
- Ricerca real-time su: cognome, nome, numero ricovero, reparto
- `clearButtonMode="while-editing"` nativo iOS

**Barra statistiche**
- Conteggio pazienti filtrati
- Dot 🔴 NRS>6 con contatore
- Dot 🟡 alert moderato con contatore

**Card paziente**
- Barra colorata sinistra (colore = NRS corrente)
- Nome, reparto · letto · numero ricovero
- Allergie in evidenza (⚠️ giallo)
- Badge NRS circolare: valore + etichetta "NRS" + ora misurazione
- Dash `–` se nessuna rilevazione
- Tocco → `PatientDetailScreen`

---

### 6. PatientDetailScreen
Scheda completa del singolo paziente.

**Header con azioni**
- ← Indietro
- Nome + reparto/letto/ricovero
- **+ NRS** (verde) → `NRSEntryScreen`
- **💊 MEO** → `OpioidScreen`
- **✏️** → `AddPatientScreen` in modalità edit (medico/admin)
- **🏠 Dimetti** → Alert conferma → `Alert.prompt` per note opzionali → `is_active: false` + `discharge_date` (medico/admin)
- **🗑** → Alert conferma eliminazione paziente (medico/admin)

**3 tab**

**Tab NRS** (default)
- Grafico lineare `LineChart` (react-native-chart-kit), ultime 24 misurazioni, bezier, fromZero
- Etichette orarie ogni 4 punti (HH:mm)
- Legenda: 0–3 verde / 4–6 giallo / 7–10 rosso
- Lista misurazioni recenti (max 48):
  - Badge circolare NRS colorato
  - Data/ora (dd/MM/yyyy HH:mm)
  - Slot orario programmato
  - Terapia somministrata + dose
  - Note cliniche
  - NRS a riposo (R) e in movimento (M)
  - ✏️ modifica → `NRSEntryScreen` edit mode
  - 🗑 elimina con conferma (medico/infermiere/admin)

**Tab Info**
- Anagrafica: nome completo, data nascita, codice fiscale, sesso
- Ricovero: numero, reparto, letto, data ammissione
- Clinica: peso kg, altezza cm, classe ASA
- Allergie evidenziate in giallo con sfondo
- Note cliniche

**Tab Interventi**
- Pulsante "+ Aggiungi intervento" (medico/admin)
- Per ogni intervento:
  - Nome e categoria
  - Data/ora intervento
  - Chirurgo e anestesista
  - Orario fine intervento
  - Indicazione "⏰ NRS programmati: +6h · +12h · +24h · +48h"
  - Tipo/i anestesia + farmaci
  - Blocchi regionali + farmaci locoregionali (se presenti)
  - Protocollo dolore
  - **Terapia post-op strutturata**: oppioidi a dose fissa con MEO/die per singolo farmaco e totale; oppioidi PRN con MEO/dose; altri farmaci
  - ✏️ modifica → `AddInterventionScreen` edit mode
  - 🗑 elimina con conferma (medico/admin)

---

### 7. AddPatientScreen
Form creazione/modifica paziente (modalità edit se `patientId` in params).

**Sezione Anagrafica**
- Nome * / Cognome *
- Data di nascita * (YYYY-MM-DD) con placeholder esempio
- Codice Fiscale (auto-uppercase)
- Sesso: segmented control M ♂ / F ♀ / Altro ⚧

**Sezione Ricovero**
- N° Ricovero *
- Reparto *
- Letto
- Data ricovero (YYYY-MM-DD, default: oggi)

**Sezione Dati Clinici**
- Peso (kg) — decimal-pad
- Altezza (cm) — decimal-pad
- Classe ASA: segmented control 1–5 (toggle, deselezionabile)
- Allergie — textarea multiriga, placeholder con esempi
- Note cliniche — textarea multiriga

Validazione con errori inline: obbligatori nome, cognome, data nascita, numero ricovero, reparto.

---

### 8. NRSEntryScreen
Registrazione/modifica rilevazione NRS (presentata come modal).

**Header paziente**
- Nome, reparto, letto, numero ricovero
- Badge protocollo analgesico dell'intervento attivo

**Slot orario**
- Chip orizzontali con gli orari programmati dell'intervento (o default: 08:00 / 12:00 / 16:00 / 20:00 / 24:00)
- Auto-selezione dello slot passato più vicino all'ora attuale

**NRS principale (0–10)** — obbligatorio
- Selettore circolare colorato (verde → rosso)
- Legenda testo: 0 nessun dolore / 10 dolore massimo

**Dettaglio NRS**
- NRS a riposo — compact selector 0–10
- NRS in movimento — compact selector 0–10

**Terapia somministrata**
- Campo farmaco (es. Morfina / Ketorolac)
- Campo dose (es. 5mg EV)

**Note** — textarea multiriga

Salvataggio bloccato se NRS principale non selezionato.
In edit mode carica i dati esistenti da `nrs_measurements`.

---

### 9. AddInterventionScreen
Form registrazione/modifica intervento chirurgico (modal).

**Classificazione**
- Categoria — chip orizzontali scrollabili: ortopedico, addominale, toracico, urologico, ginecologico, vascolare, neurochirurgico, altro
- Tipo specifico — chip contestuali per categoria (es. ortopedico: 14 sottotipi tra cui protesi anca/ginocchio, artroscopia, osteosintesi, artrodesi colonna, discectomia…)
- Auto-compila il nome intervento dalla selezione sottotipo
- Nome intervento * (editabile manualmente)
- Chirurgo
- Anestesista

**Sezione Anestesia**
- Tipo anestesia — **selezione multipla**: generale, spinale, epidurale, locoregionale, sedazione, locale
- Farmaci anestesia — textarea

**Sezione locoregionale** (appare se anestesia include epidurale/locoregionale/spinale, oppure protocollo include blocco_nervoso/epidurale_continua)
- Blocchi effettuati — textarea (es. Blocco femorale, Epidurale L3-L4)
- Farmaci locoregionali — textarea (es. Ropivacaina 0.2% 10ml)

**Sezione Terapia del Dolore**
- Protocollo — **selezione multipla**: PCA, epidurale_continua, blocco_nervoso, sistemico_ev, sistemico_orale

**Prescrizione oppioidi strutturata**
- Selezione farmaco tra 15 oppioidi (chip orizzontali)
- Dose in mg (decimal-pad)
- Via di somministrazione (contestuale al farmaco)
- Toggle **Al bisogno (PRN)**
- Frequenza (se non PRN): 1x/die, 2x/die, 3x/die, 4x/die, 6x/die, 8x/die
- Preview MEO immediata durante digitazione
- Calcolo MEO/die per farmaco (dose × fattore × frequenza)
- Totale MEO/die terapia fissa
- Lista oppioidi aggiunti con possibilità di spostare tra fissa ↔ PRN
- Rimozione singolo farmaco

- Altri farmaci (paracetamolo, FANS, ecc.) — textarea

**Impostazioni alert**
- Soglia alert NRS (0–10, default 6)
- Orario fine intervento (YYYY-MM-DD HH:MM) → genera NRS programmati automatici a +6h, +12h, +24h, +48h

**Note** — textarea

---

### 10. NotificationsScreen
Centro notifiche — **tab principale**.

**Header**
- Contatore notifiche non lette
- Pulsante "Segna tutte come lette"

**FlatList** (max 100, ordinate per data desc, aggiornate al focus tab)
- Icona per tipo: 🔴 `nrs_alert` / ⚠️ `missing_measurement` / 🔔 generica
- Colore priorità: `critical` rosso / `high` giallo / normale teal
- Titolo (bold se non letta) e corpo (2 righe max)
- Tempo relativo localizzato (es. "2 ore fa") via `date-fns` locale IT/EN
- Sfondo azzurro + bordo sinistro per non lette
- Dot colorato a destra per non lette
- Tocco → segna come letta + naviga a `PatientDetailScreen` se collegata a paziente

---

### 11. ProfileScreen
Profilo utente e impostazioni — **tab principale**.

**Avatar e identità**
- Cerchio con iniziali nome/cognome
- Badge ruolo colorato: admin viola / medico teal / infermiere verde / paziente giallo

**Card Informazioni**
- Email, reparto, matricola, telefono

**Card Preferenze**
- Toggle lingua 🌍 italiano/inglese via `Switch` nativo

**Strumenti admin** (solo ruolo `admin`)
- "📊 Esporta Dati CSV" → `ExportScreen`
- "👤 Gestione Utenti" → `UsersScreen`

**Logout** con Alert di conferma (stile destructive)

---

### 12. StatsScreen
Dashboard analytics — accessibile da `DashboardScreen`.

**Selettore periodo**: 7 / 14 / 30 giorni (ricarica tutto)

**3 KPI card** (con bordo colorato in alto)
- 🏥 Pazienti attivi (somma per reparto)
- 🔴 % alert NRS (misurazioni ≥7 / totale nel periodo)
- ⚠️ Rilevazioni mancanti (pazienti senza NRS nelle ultime 12h)

**Andamento NRS medio** — `LineChart` bezier (visibile se ≥2 punti)
- Asse X: date (dd/MM)
- Dataset: NRS medio giornaliero
- Legenda colori lieve / moderato / severo
- Fallback: calcolo diretto da tabella `nrs_measurements` se la RPC `get_nrs_daily_stats` non è disponibile

**Pazienti per reparto** — barre orizzontali proporzionali (colori distinti ciclici)

**Tipi di intervento per categoria** — barre orizzontali

**Dettaglio sottotipi intervento** — raggruppati per categoria con barre proporzionali

**Pazienti senza rilevazione recente** (>12h, ordinati per ore desc)
- Nome, reparto
- Ore dall'ultima rilevazione: rosso se >24h, giallo se 12–24h; "Mai" se nessuna
- Ultimo NRS registrato
- ✅ Messaggio "tutti aggiornati" se lista vuota

---

### 13. ExportScreen
Export dati — accessibile da `ProfileScreen` (solo admin).

**5 export individuali**
| Tabella | Contenuto |
|---|---|
| Pazienti | Anagrafica e dati clinici |
| Interventi | Procedure chirurgiche |
| Rilevazioni NRS | Misurazioni dolore |
| Notifiche | Log alert generati |
| Utenti | Profili personale sanitario |

**Export completo** ("📦 Esporta Tutto")
- Tutte le 5 tabelle in un unico file con sezioni `=== NOME ===`

**Formato**: CSV UTF-8 con escape corretto per virgole/apici/newline
**Filename**: `APS_<Tabella>_YYYY-MM-DD.csv` / `APS_Export_Completo_YYYY-MM-DD.csv`
**Condivisione**: sheet nativo iOS/Android via `expo-sharing`; fallback a salvataggio locale
**Nota GDPR** in fondo alla schermata

---

### 14. OpioidScreen
Calcolo equivalenti morfina (MEO) — accessibile da `PatientDetailScreen`.

**Header**
- Nome paziente (se passato nei params)
- Pulsante "+ Aggiungi"

**Pannello sommario MEO** (2 card affiancate)
- Totale MEO cumulativo (tab attiva)
- MEO ultime 24h — rosso con alert "⚠️ Dose elevata" se >90mg

**Tab Somministrato / Prescritto**

**Lista record**
- Badge MEO calcolato
- Nome farmaco, dose mg, via di somministrazione (emoji contestuale)
- Data/ora somministrazione localizzata
- Note opzionali
- 🗑 elimina con Alert conferma

**Tabella di riferimento MEO** (CDC 2022, NIH HEAL 2024, StatPearls 2024) — 15 farmaci:

| Farmaco | Fattore MEO | Note |
|---|---|---|
| Morfina orale | ×1 | Standard di riferimento |
| Morfina EV/SC | ×3 | 10mg EV = 30mg orale |
| Oramorph | ×1 | Morfina solfato orale |
| Ossicodone orale | ×1.5 | CDC 2022 |
| Ossicodone EV | ×3 | |
| Idromorfone orale | ×4 | 7.5mg = 30mg morfina |
| Idromorfone EV | ×20 | 1.5mg EV = 30mg morfina orale |
| Fentanyl TTS | ×2.4 | Inserire mcg/h |
| Fentanyl EV | ×100 | 0.1mg = 10mg morfina orale |
| Tramadolo orale/EV | ×0.2 | NIH HEAL 2024 |
| Buprenorfina SL | ×30 | CDC 2022 |
| Buprenorfina TDS | ×2.4 | Inserire mcg/h |
| Tapentadolo | ×0.4 | Palexia |
| Codeina | ×0.15 | |

**Modal nuova registrazione**
- Tipo: somministrato / prescritto
- Farmaco: picker modale con nome, nota clinica, fattore
- Dose mg (decimal-pad) + preview MEO in tempo reale
- Via di somministrazione (contestuale al farmaco)
- Data/ora (default: ora corrente, formato YYYY-MM-DDTHH:MM)
- Note — textarea

---

### 15. UsersScreen
Gestione utenti — accessibile da `ProfileScreen` (solo admin).

**Sezione "Richieste in attesa"** (visibile solo se presenti, con badge contatore arancione)
- Dati: nome/cognome, email, reparto, data richiesta, messaggio opzionale tra virgolette
- **✅ Approva** → modal selezione ruolo (chip admin/medico/infermiere/paziente, default infermiere) → conferma → `action: approve_request` con ruolo scelto
- **❌ Rifiuta** → Alert conferma → `action: reject_request`
- Dati caricati via `action: list_requests`

**Lista utenti attivi**
- Avatar con iniziali e colore ruolo
- Nome, email, reparto, badge Attivo/Inattivo
- Selector ruolo inline (4 chip) → `action: update_role`
- **🔑 Reset pw** → modal con campo nuova password (min 6 caratteri) → `action: reset_password`
- **🚫 Disattiva / ✅ Riattiva** → Alert conferma → `action: toggle_active` (disabilitato su se stessi)

**+ Nuovo** (header) → modal creazione utente
- Campi: nome*, cognome*, email*, password*, reparto, badge, telefono
- Selector ruolo
- `action: create`

**⚠️ Zona Pericolosa** (card con bordo rosso, in fondo)
- Descrizione conseguenze irreversibili
- Pulsante rosso **"🗑 Elimina Database"**
- Step 1: Alert con elenco dati che verranno eliminati + conferma "Continua"
- Step 2: Modal con:
  - Campo **Password database**
  - Campo **Conferma** (deve contenere esattamente la stringa `ELIMINA`, bordo rosso quando corretto)
- `manage-tenants` con `action: delete`, `code`, `password`, `confirmText`
- Dopo successo: `AsyncStorage.multiRemove(['tenant_code','tenant_id','tenant_name'])` → `supabase.auth.signOut()` → `clearTenant()` → ritorno a `OnboardingScreen`

---

## Servizi trasversali

### Edge Functions Supabase

| Funzione | Actions |
|---|---|
| `manage-users` | `create`, `update_role`, `toggle_active`, `reset_password`, `register`, `list_requests`, `approve_request`, `reject_request` |
| `manage-tenants` | `list`, `verify`, `create`, `forgot_db_password`, `delete` |

### Tabelle database

| Tabella | Descrizione |
|---|---|
| `profiles` | Utenti con ruoli (`admin`, `medico`, `infermiere`, `paziente`) e `status` (`pending`/attivo) |
| `patients` | Pazienti con dati anagrafici, clinici e di ricovero |
| `interventions` | Interventi chirurgici con protocollo analgesico, NRS schedule, soglia alert |
| `nrs_measurements` | Rilevazioni dolore 0–10 con NRS rest/movement, terapia, slot orario |
| `notifications` | Notifiche in-app con `title`/`body` IT e `title_en`/`body_en` EN, priorità |
| `opioid_records` | Registrazioni oppioidi con calcolo MEO |

### Autenticazione (`useAuth`)
- Email/password via Supabase Auth
- Biometrica via `expo-local-authentication` con credenziali in `expo-secure-store`
- PIN a 6 cifre
- `refreshSession` per mantenere sessione attiva
- Auto-signout dopo 30 minuti di inattività

### Internazionalizzazione
- `i18next` con bundle `it` (default) e `en`
- Toggle in `LoginScreen` e `ProfileScreen`
- Notifiche bilingui (`title`/`body` IT + `title_en`/`body_en` EN)
- Date via `date-fns` con locale IT/EN contestuale

### Tema (`src/utils/theme.ts`)
- `Colors`, `Typography`, `Spacing`, `Radius`, `Shadow`
- Helper NRS: `getNrsColor(n)`, `getNrsBackground(n)`, `getAlertColor(level)`
- Colori alert: `verde` (0–3) / `giallo` (4–6) / `rosso` (7–10)

### Build / Distribuzione
- Bundle ID iOS: `it.ior.aps-manager`
- EAS Project ID: `39d907c6-bf0b-44ca-a628-7a2ef0ef55a9`

| Profilo EAS | Target | Note |
|---|---|---|
| `development` | Dev client | Distribuzione interna |
| `preview` | TestFlight / internal track | |
| `production` | App Store | Auto-incremento build number |
