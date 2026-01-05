# 🚀 TASK-FORCE Solar CRM - Deployment Anleitung

## Schritt 1: Auf GitHub hochladen

1. Gehe zu **github.com** → **New Repository**
2. Name: `taskforce-solar-crm`
3. Visibility: **Private**
4. Klick **Create repository**

5. In deinem Terminal:
```bash
cd taskforce-crm
git init
git add .
git commit -m "Initial"
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/taskforce-solar-crm.git
git push -u origin main
```

---

## Schritt 2: Auf Vercel deployen

1. Gehe zu **vercel.com** → Login
2. Klick **"Add New..."** → **"Project"**
3. Wähle dein GitHub Repo **taskforce-solar-crm**
4. Bei **Environment Variables** diese eintragen:

### Diese eintragen (Werte hast du in deinen Notizen):
```
TWILIO_ACCOUNT_SID = (dein Twilio Account SID)
TWILIO_AUTH_TOKEN = (dein Twilio Auth Token)
TWILIO_PHONE_NUMBER = +4997180263000
ELEVENLABS_API_KEY = (dein ElevenLabs API Key)
ELEVENLABS_AGENT_ID = (dein ElevenLabs Agent ID)
```

### Diese 3 musst du noch erstellen (siehe Schritt 3):
```
TWILIO_API_KEY_SID = (aus Twilio)
TWILIO_API_KEY_SECRET = (aus Twilio)
TWILIO_TWIML_APP_SID = (aus Twilio)
```

5. Klick **"Deploy"**

---

## Schritt 3: Twilio API Keys erstellen

### 3a) API Key erstellen

1. Gehe zu: **console.twilio.com**
2. Links im Menü: **Account** → **API keys & tokens**
3. Klick **"Create API Key"**
4. Eingeben:
   - Friendly name: `TASKFORCE-CRM`
   - Key type: **Standard**
5. Klick **"Create API Key"**
6. **WICHTIG:** Kopiere sofort:
   - **SID** → Das ist dein `TWILIO_API_KEY_SID`
   - **Secret** → Das ist dein `TWILIO_API_KEY_SECRET`
   
   ⚠️ Das Secret wird nur EINMAL angezeigt!

7. In Vercel eintragen unter **Settings** → **Environment Variables**

---

### 3b) TwiML App erstellen

1. In Twilio Console: **Develop** → **Voice** → **Manage** → **TwiML Apps**
2. Klick **"Create new TwiML App"**
3. Eingeben:
   - Friendly name: `TASKFORCE-CRM`
   - Voice Request URL: `https://DEINE-APP.vercel.app/api/twilio/voice`
   - Method: **POST**
   
   (Ersetze DEINE-APP mit deiner Vercel URL, z.B. `taskforce-solar-crm.vercel.app`)

4. Klick **"Create"**
5. Kopiere die **SID** (beginnt mit `AP...`) → Das ist dein `TWILIO_TWIML_APP_SID`
6. In Vercel eintragen

---

## Schritt 4: Redeploy

Nach dem Eintragen der Environment Variables:

1. In Vercel → **Deployments**
2. Klick auf **"..."** beim letzten Deployment
3. Klick **"Redeploy"**
4. Fertig! 🎉

---

## ✅ Checkliste

- [ ] GitHub Repo erstellt
- [ ] Code gepusht
- [ ] Vercel Project erstellt
- [ ] Environment Variables eingetragen:
  - [ ] TWILIO_ACCOUNT_SID
  - [ ] TWILIO_AUTH_TOKEN
  - [ ] TWILIO_PHONE_NUMBER
  - [ ] TWILIO_API_KEY_SID ← musst erstellen
  - [ ] TWILIO_API_KEY_SECRET ← musst erstellen
  - [ ] TWILIO_TWIML_APP_SID ← musst erstellen
  - [ ] ELEVENLABS_API_KEY
  - [ ] ELEVENLABS_AGENT_ID
- [ ] TwiML App Voice URL gesetzt
- [ ] Redeploy gemacht
- [ ] Getestet: Anrufen funktioniert

---

## 🆘 Troubleshooting

### "Twilio nicht verfügbar"
→ API Keys noch nicht eingetragen oder falsch

### Anruf bricht sofort ab
→ TwiML App Voice URL prüfen (muss `/api/twilio/voice` sein)

### Voice Agent funktioniert nicht
→ ElevenLabs Agent muss auf "Live" stehen und Sprache auf Deutsch

---

## 📞 Support

Bei Fragen: FlowEffekt Automatisierung
