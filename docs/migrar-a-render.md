# Mudarse de Vercel a Render

Escrito antes de empezar, para que el plan no dependa de la memoria de nadie.
Complementa `desplegar.md`, que describe cómo está armado hoy en Vercel.

## Por qué

**No es por plata, aunque también.** El plan Hobby de Vercel dice, con todas las
letras, *"the Hobby plan restricts users to non-commercial, personal use only"*.
Este producto se le cobra a barberías. El día que Vercel lo haga cumplir se caen
todos los clientes a la vez, sin aviso y sin nada que negociar.

Los números, verificados contra la documentación de ellos en agosto de 2026:

| | Vercel Pro | **Render Hobby** | Render Pro |
|---|---|---|---|
| Plan del espacio de trabajo | $20 | $0 | $25 |
| Máquina (Starter, 0.5 CPU / 512 MB) | incluida | $7 | $7 |
| Tarea programada | incluida | $1 | $1 |
| Dominio extra (hacen falta 3, Hobby trae 2) | — | $0.25 | — |
| **Total** | **$20** | **$8.25** | **$33** |

Ojo con la última columna: **si algún día hace falta el plan Pro de Render, sale
más caro que Vercel.** El ahorro vive mientras alcance el plan gratuito.

Render cambió los planes el 23 de abril de 2026 y separó el precio del espacio
de trabajo del de la máquina. Es el detalle que hace que "son 7 dólares" sea
falso.

## El momento

**Se hace ahora porque todavía no hay ningún cliente.** Tropi es una maqueta y
las demos son nuestras: hoy el corte no le arruina el día a nadie. Con la
primera barbería real adentro, esta misma mudanza pasa a ser una operación
delicada. Ver "Ninguna barbería de la base es un cliente todavía" en `CLAUDE.md`.

## Lo único que puede salir mal de verdad

**El comodín.** Todo el producto vive en `{slug}.turnosforbarber.com`. Si el
certificado comodín no sale, no hay migración que valga 12 dólares por mes.

Render lo soporta, y pide esto:

- Que el **dominio pelado también apunte a Render**. Sin eso el comodín no
  funciona.
- **Tres CNAME**, todos:
  - `*` → el subdominio `onrender.com` del servicio
  - `_acme-challenge` → `<id-del-servicio>.verify.renderdns.com`
  - `_cf-custom-hostname` → `<id-del-servicio>.hostname.renderdns.com`

Los certificados los emite y renueva Render solo, por Let's Encrypt.

⚠️ **Antes de tocar nada, averiguar dónde está la zona DNS.** Si hoy la manejan
los nameservers de Vercel, mudarla se lleva puestos los registros de **Resend**,
y ahí dejan de salir los mails de confirmación sin que nadie se entere: un fallo
de mail nunca rompe una reserva, a propósito. Si la zona está en otro lado
(el registrador, Cloudflare), esto no pasa y solo se cambian los CNAME.

## El orden

1. **Mirar la zona DNS.** Dónde está y quién la maneja. Decide todo lo demás.
2. **Crear el servicio en Render** desde el repositorio de GitHub.
   - Build: `npm run build` · Start: `npm start`
   - Node 24 (los scripts y los tests dan por sentado que TypeScript corre
     directo; no está declarado en `engines`, así que hay que fijarlo en Render).
3. **Cargar las variables de entorno** (lista abajo) **antes del primer build**.
   Las `NEXT_PUBLIC_*` se escriben adentro del código al construirlo, no se leen
   en cada visita: cargadas después, no entran.
4. **Verificar en el `onrender.com`** que la aplicación levanta. Sin subdominio
   no hay barbería, así que ahí se tiene que ver **la portada**. Con eso alcanza
   para saber que el build y el arranque están bien.
5. **Agregar los dominios en Render** y cambiar los CNAME. Acá empieza el corte.
6. **Esperar el certificado** del comodín y probar, en este orden:
   - `turnosforbarber.com` → la portada
   - `demo.turnosforbarber.com` → la barbería demo, y reservar de verdad
   - `tropi-barbershop.turnosforbarber.com` → otra barbería, con su marca
7. **Rearmar la tarea diaria** que vacía la demo (ver abajo).
8. **Correr las pruebas contra producción**, que es lo que dice `desplegar.md`:

```
node --env-file=.env.local scripts/probar-cliente.mts demo https://demo.turnosforbarber.com
node --env-file=.env.local scripts/probar-mail.mts
node --env-file=.env.local scripts/probar-recuperar.mts
node --env-file=.env.local scripts/probar-solicitud.mjs https://turnosforbarber.com
```

9. **Dejar Vercel andando una semana**, apagado del DNS pero sin borrar. Es el
   botón de volver atrás.

**Volver atrás es cambiar los CNAME de nuevo a Vercel.** Nada más. Por eso el
proyecto de Vercel no se borra hasta que pase una semana tranquila.

## Las variables de entorno

Las `NEXT_PUBLIC_*` viajan al navegador y se congelan al construir. El resto son
solo de servidor.

| Variable | Nota |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Saltea RLS. Nunca con prefijo `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `turnosforbarber.com`, sin protocolo ni puerto |
| `NEXT_PUBLIC_APP_URL` | `https://turnosforbarber.com` |
| `NEXT_PUBLIC_CONTACT_WHATSAPP` | |
| `NEXT_PUBLIC_CONTACT_EMAIL` | |
| `NEXT_PUBLIC_PRECIO_MENSUAL` · `_MONEDA` | |
| `NEXT_PUBLIC_PRECIO_MENSUAL_ALT` · `_MONEDA_ALT` | |
| `SOLICITUDES_MAIL` | A dónde llega el aviso de la portada |
| `CRON_SECRET` | Lo único que protege `/api/limpiar-demo` |
| `RESEND_API_KEY` | |
| `RESEND_FROM` | Con el dominio verificado, no `onboarding@resend.dev` |
| `DEV_TENANT_SLUG` | **Vacía o ausente.** En producción se ignora, pero dejarla cargada invita a un accidente. |

**Supabase no hay que tocarlo.** El dominio no cambia, así que los *Redirect
URLs* (`https://*.turnosforbarber.com/**`) siguen sirviendo igual. Si alguna vez
cambia el dominio, eso sí hay que actualizarlo o el link de recuperar contraseña
deja de volver.

## La tarea que vacía la demo

Hoy la dispara `vercel.json` una vez por día. En Render las tareas programadas
son **un servicio aparte, con un mínimo de $1 por mes**.

Se puede evitar: `/api/limpiar-demo` es un endpoint HTTP y el repositorio ya
está en GitHub, así que una acción programada de GitHub lo llama gratis. El
`CRON_SECRET` va como secreto del repositorio y viaja en el header
`Authorization: Bearer`.

Sea como sea, **hay que rearmarla el mismo día**. Sin limpieza, en unas semanas
la demo no tiene un horario libre para mostrar, y una demo llena no demuestra
nada.

Y la regla que no se afloja: ese borrado filtra siempre por `tenant_id`. Ese
`eq` es lo único que separa "vaciar la demo" de "borrarle la agenda a un
cliente".

## Lo que hay que mirar después, sin apuro

- **512 MB de RAM.** Next.js entra, pero la optimización de imágenes come
  memoria. La máquina siguiente cuesta $25 y se lleva el ahorro entero. Si
  aprieta, hay margen: las capturas de la portada ya vienen optimizadas del
  script y se podrían servir sin pasar por el optimizador.
- **5 GB de ancho de banda.** Medido contra producción: la portada pesa 584 KB
  por visita nueva (incluye la demo adentro del iframe) y la página de una
  barbería 283 KB. O sea unas 9.000 visitas de portada por mes. **Las barberías
  no son el riesgo; un reel que funcione, sí.** Pasado el límite son $0.15 por
  GB, así que un mes bueno de Instagram cuesta dos dólares, no un susto.
- **Sumar barberías no cambia la factura.** El comodín cuenta como un solo
  dominio, tenga 1 barbería o 40. Recién suma $0.25 por mes el día que una
  quiera su propio dominio.
- **En el plan gratuito no hay registro de pedidos HTTP.** Es el motivo más
  probable de tener que pasar a Pro alguna vez: el día que una dueña diga "no me
  anda" y no haya dónde mirar.

## Fuentes

Verificado en agosto de 2026. Si pasó tiempo, volver a mirar: Render ya cambió
los planes una vez este año.

- <https://render.com/docs/new-workspace-plans>
- <https://render.com/docs/custom-domains>
- <https://render.com/docs/compute-plans>
- <https://render.com/docs/cronjobs>
- <https://vercel.com/docs/plans/hobby>
