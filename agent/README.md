# GoCinema HDM Agent

Դրամարկղի համակարգչում աշխատող տեղական ծառայություն։  
VPS-ը (`gocinema.am`) ՀԴՄ-ին **ուղղակի չի միանում** — բրաուզերը կանչում է `http://127.0.0.1:3100`։

```
Դրամարկղ PC բրաուզեր  →  https://gocinema.am (VPS)
         │
         └── HTTP → http://127.0.0.1:3100 (այս agent)
                          │
                          └── TCP → ՀԴՄ 192.168.123.6:8080
```

## Դրամարկղի PC — տեղադրում

1. Պատճենել ամբողջ `agent/` պանակը PC-ում (օր. `C:\GoCinema\agent`)
2. Տեղադրել [Node.js LTS](https://nodejs.org/) (≥ 20)
3. Ստեղծել `.env` `.env.example`-ից և լրացնել իրական արժեքները
4. Տեղադրել և գործարկել.

```bat
cd C:\GoCinema\agent
npm install
npm start
```

Կամ կրկնակի սեղմել `start.cmd`։

Ստուգում.

- բացել `http://127.0.0.1:3100/health`
- պետք է լինի `{"ok":true,...}`

## Windows ավտոմատ գործարկում

### Տարբերակ A — Task Scheduler

1. Task Scheduler → Create Task
2. Trigger: *At log on*
3. Action: Start a program
   - Program: `C:\GoCinema\agent\start.cmd`
4. Settings: *Run whether user is logged on or not* (ըստ ցանկության)

### Տարբերակ B — pm2

```bat
npm install -g pm2
cd C:\GoCinema\agent
pm2 start npm --name hdm-agent -- start
pm2 save
pm2 startup
```

## VPS (`gocinema.am`) — պարտադիր env

Build/restart-ից **առաջ** VPS `.env`-ում.

```env
NEXT_PUBLIC_HDM_AGENT_ENABLED=true
NEXT_PUBLIC_HDM_AGENT_URL=http://127.0.0.1:3100
NEXT_PUBLIC_HDM_AGENT_KEY=<նույն արժեքը ինչ AGENT_API_KEY>
```

`NEXT_PUBLIC_*` փոփոխությունից հետո **պարտադիր rebuild**.

```bash
npm run build
# ապա ձեր սովորական restart (pm2 / systemd / nginx+next)
```

`NEXT_PUBLIC_HDM_AGENT_URL` մնում է `127.0.0.1` — որովհետև բրաուզերը **դրամարկղի PC**-ից է կանչում agent-ը, ոչ VPS-ից։

## Agent `.env` (արտադրություն)

```env
AGENT_HOST=127.0.0.1
AGENT_PORT=3100
AGENT_API_KEY=<գաղտնի բանալի>
AGENT_ALLOW_ORIGIN=https://gocinema.am

HDM_HOST=192.168.123.6
HDM_PORT=8080
HDM_PASSWORD=...
HDM_CASHIER=3
HDM_PIN=...
HDM_DEFAULT_DEP=1
HDM_USE_EXT_POS=true
```

ՀԴՄ էկրանում Auto system IP = դրամարկղի PC-ի LAN IP (օր. `192.168.123.2`)։

## Թեստ (`gocinema.am`)

1. Դրամարկղի PC-ում agent-ը աշխատում է (`/health` OK)
2. Բացել `https://gocinema.am/admin/hdm`
3. `GET /health` / `GET /v1/diagnose` / `GET /v1/operators`
4. `POST /v1/login` → `POST /v1/print-receipt`
5. Դրամարկղ վաճառք՝ `https://gocinema.am/admin/box-office`

Եթե տեսնում եք «agent հասանելի չէ» — agent-ը offline է, կամ բրաուզերը բացված է ոչ դրամարկղի PC-ից։
