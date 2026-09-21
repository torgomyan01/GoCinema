# GoCinema

`ssh -L 3306:127.0.0.1:3306 root@81.177.139.105`

## HDM (ՊԵԿ)

- VPS-ում աշխատում է կայքը (`gocinema.am`)
- ՀԴՄ agent-ը աշխատում է **դրամարկղի PC**-ում (`agent/`)
- Տես `agent/README.md`

## Շաբաթական հաշվետվություն

Ադմինը երկուշաբթի կայք մտնելիս ավտոմատ ուղարկում է նախորդ շաբաթվա հաշվետվությունները արտադրողի email-ին։ Resend `RESEND_FROM=GoCinema <info@gocinema.am>`։

## Վճարում (vPost / ITF) — մեկ փուլ

Նպատակ՝ **մեկ փուլով գանձում** առանց սառեցման (`payment_deposited` անմիջապես)։

ITF դոկումենտացիա՝ https://itfllc.am/hy/documentation/vpost  
`/order/new` API-ում փուլ ընտրելու պարամետր **չկա** — ռեժիմը միացնում է ITF-ը մերչանտի հաշվին։

Խնդրեք ITF support-ին (օրինակ)՝

> Խնդրում ենք GoCinema մերչանտի համար միացնել **մեկ փուլով (single-phase / one-stage) վճարում**, որպեսզի գումարը քարտից միանգամից ելքագրվի (`payment_deposited`), առանց նախնական սառեցման (`payment_approved`) և առանց Confirmation քայլի։

Մինչև ITF-ը փոխի կարգավորումը՝ կայքը approved տեսնելիս ավտոմատ կանչում է `confirm-payment` (գումարը չի մնում hold-ում)։  
Երկու փուլի հին ռեժիմի համար (միայն եթե հատուկ պետք է)՝ `PAYMENT_TWO_PHASE=true`։
